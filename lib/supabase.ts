
import { createClient } from '@supabase/supabase-js';
import { Status, InspectionStatus, Contact, ContactType, Job, PipelineStage, Conversation, Message, ConversationSource, Role } from '../types.ts';
import { toE164, toDisplay } from '../utils/phoneUtils.ts';

const SUPABASE_URL = 'https://nyscciinkhlutvqkgyvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55c2NjaWlua2hsdXR2cWtneXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyODMxMzMsImV4cCI6MjA4MTg1OTEzM30.4c3QmNYFZS68y4JLtEKwzVo_nQm3pKzucLOajSVRDOA';

// Centralized Outbound Logic: Master n8n webhook for Twilio processing
const N8N_MASTER_OUTBOUND_WEBHOOK = 'https://restorationai.app.n8n.cloud/webhook/master-outbound-sms'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * AUTHENTICATION
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', user.id)
      .maybeSingle(); 
      
    if (error) {
      console.warn("Profile fetch warning:", error.message);
      return { ...user, profile: null };
    }
    
    return { ...user, profile };
  } catch (err) {
    console.error("Critical Auth Error:", err);
    return null;
  }
};

export const signOut = () => supabase.auth.signOut();

/**
 * MESSAGING & CONVERSATIONS
 */
export const fetchConversations = async (companyId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map(c => ({
    id: String(c.id), 
    contactId: c.contact_id,
    lastMessage: c.last_message || '',
    lastMessagePreview: c.last_message_preview, 
    last_message_at: c.last_message_at,
    timestamp: c.last_message_at 
      ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'New',
    source: c.source as ConversationSource,
    status: c.status as any,
    urgency: c.urgency as any,
    isStarred: c.is_starred,
    isUnread: c.is_unread,
    isInternal: c.category === 'internal_chat',
    category: c.category as 'company_inbox' | 'internal_chat',
    messages: [] 
  }));
};

export const createConversation = async (contactId: string, companyId: string, source: ConversationSource = ConversationSource.SMS): Promise<Conversation> => {
  const now = new Date().toISOString();
  
  const { data: contact } = await supabase.from('contacts').select('type').eq('id', contactId).single();
  const category = contact?.type === ContactType.STAFF ? 'internal_chat' : 'company_inbox';

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      contact_id: contactId,
      company_id: companyId,
      source: source,
      status: 'ai-active',
      urgency: 'Medium',
      category: category,
      last_message: 'Conversation started',
      last_message_preview: 'Conversation started',
      last_message_at: now
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    contactId: data.contact_id,
    lastMessage: data.last_message,
    lastMessagePreview: data.last_message_preview,
    last_message_at: data.last_message_at,
    timestamp: 'Just now',
    source: data.source as ConversationSource,
    status: data.status,
    urgency: data.urgency,
    isStarred: data.is_starred,
    isUnread: data.is_unread,
    category: data.category,
    messages: []
  };
};

export const fetchMessages = async (conversationId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map(m => ({
    id: m.id,
    sender: (m.sender_type.toLowerCase() === 'user' ? 'agent' : 
             m.sender_type.toLowerCase() === 'contact' ? 'contact' : 
             m.sender_type.toLowerCase() === 'ai' ? 'ai' : 'system') as any,
    sender_type: m.sender_type,
    message_type: m.message_type,
    senderId: m.sender_id,
    content: m.content,
    timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    source: m.source as any,
    status: m.status as any,
    direction: m.direction as 'inbound' | 'outbound',
    twilioSid: m.twilio_sid || m.external_id,
    mediaUrls: m.media_urls || [],
    errorMessage: m.error_message
  }));
};

/**
 * sendMessageToDb Refactor:
 * Now purely triggers the n8n Master Webhook. 
 * n8n handles the Supabase INSERT to capture Twilio SIDs and avoid double-logging.
 */
export const sendMessageToDb = async (msg: Partial<Message>, conversationId: string, companyId: string) => {
  // 1. Resolve Routing Details (To/From numbers)
  const { data: convData } = await supabase
    .from('conversations')
    .select('contact_id, company_id, source')
    .eq('id', conversationId)
    .single();

  if (!convData) throw new Error("Conversation sync error: Routing context not found.");

  const [contactRes, companyRes] = await Promise.all([
    supabase.from('contacts').select('phone').eq('id', convData.contact_id).single(),
    supabase.from('companies').select('agent_phone_1').eq('id', convData.company_id).single()
  ]);

  const toPhone = contactRes.data?.phone || '';
  const fromPhone = companyRes.data?.agent_phone_1 || '';

  // 2. Classify Sender (Ensure manual staff replies are 'user')
  const advisorSenderType = msg.sender === 'ai' ? 'ai' : (msg.sender === 'agent' ? 'user' : 'system');

  // 3. Trigger Master Outbound Webhook 
  // We no longer perform a local supabase.insert here to prevent double-logging.
  if (N8N_MASTER_OUTBOUND_WEBHOOK) {
    try {
      const response = await fetch(N8N_MASTER_OUTBOUND_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          conversation_id: conversationId,
          to: toPhone,
          from: fromPhone,
          message: msg.content || null, // MMS support (content can be null)
          media_url: msg.mediaUrls && msg.mediaUrls.length > 0 ? msg.mediaUrls[0] : null,
          sender_type: advisorSenderType,
          internal_id: `WEB-${Date.now()}` 
        })
      });

      if (!response.ok) {
        throw new Error(`Master Gateway Offline: ${response.statusText}`);
      }
      
      return { success: true };
    } catch (e: any) {
      console.error("Master Webhook Signal Failure:", e);
      throw e;
    }
  }

  throw new Error("Master Outbound Webhook is not configured.");
};

/**
 * DATA FETCHERS
 */
export const fetchCompanySettings = async (companyId: string) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    let managementContacts = data.management_contacts;
    if (!managementContacts || !Array.isArray(managementContacts) || managementContacts.length === 0) {
      managementContacts = [{ name: data.owner_1_name || '', phone: data.owner_1_phone || '', email: data.owner_1_email || '' }];
    }

    const joinedDateFormatted = data.joined_date 
      ? new Date(data.joined_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'New Account';

    return {
      id: data.id,
      name: data.name,
      agentName: data.agent_name,
      agentPhone1: toDisplay(data.agent_phone_1),
      dispatchStrategy: data.dispatch_strategy,
      timezone: data.timezone,
      notificationPreference: data.notification_preference,
      maxLeadTechs: data.max_lead_techs,
      maxAssistantTechs: data.max_assistant_techs,
      owners: managementContacts.map((m: any) => ({ ...m, phone: toDisplay(m.phone) })),
      onsiteResponseMinutes: data.onsite_response_minutes ?? 60,
      centerZipCode: data.center_zip_code || '',
      serviceMileRadius: data.service_mile_radius ?? 45,
      services: data.services || [],
      ghlLocationId: data.id,
      status: data.status || 'Active',
      minimumSchedulingNotice: data.minimum_scheduling_notice ?? 4,
      defaultInspectionDuration: data.default_inspection_duration ?? 120,
      appointmentBufferTime: data.appointment_buffer_time ?? 30,
      serviceAreas: data.service_areas || '',
      joinedDate: joinedDateFormatted,
      ownerName: managementContacts[0]?.name || '',
      plan: 'Pro AI',
      totalDispatches: 0,
      customFieldConfig: [],
      twilioSubaccountSid: data.twilio_subaccount_sid,
      stripeCustomerId: data.stripe_customer_id
    };
  } catch (err) {
    console.error("fetchCompanySettings error:", err);
    return null;
  }
};

export const syncCompanySettingsToSupabase = async (companyData: any) => {
  const primaryRecipient = companyData.owners?.[0] || { name: '', phone: '', email: '' };
  const ownersE164 = companyData.owners.map((o: any) => ({ ...o, phone: toE164(o.phone) }));

  const { data, error } = await supabase
    .from('companies')
    .upsert({
      id: companyData.id,
      name: companyData.name,
      agent_name: companyData.agentName,
      agent_phone_1: toE164(companyData.agentPhone1),
      dispatch_strategy: companyData.dispatch_strategy,
      timezone: companyData.timezone,
      notification_preference: companyData.notificationPreference,
      max_lead_techs: companyData.max_lead_techs,
      max_assistant_techs: companyData.max_assistant_techs,
      management_contacts: ownersE164,
      owner_1_name: primaryRecipient.name,
      owner_1_phone: toE164(primaryRecipient.phone),
      owner_1_email: primaryRecipient.email,
      onsite_response_minutes: companyData.onsiteResponseMinutes,
      center_zip_code: companyData.centerZipCode,
      service_mile_radius: companyData.serviceMileRadius,
      services: companyData.services,
      service_areas: companyData.serviceAreas,
      minimum_scheduling_notice: companyData.minimumSchedulingNotice,
      default_inspection_duration: companyData.defaultInspectionDuration,
      appointment_buffer_time: companyData.appointmentBufferTime,
      status: companyData.status,
      twilio_subaccount_sid: companyData.twilio_subaccount_sid,
      stripe_customer_id: companyData.stripeCustomerId
    }, { onConflict: 'id' })
    .select();
  if (error) throw new Error(error.message);
  return data;
};

export const fetchTechniciansFromSupabase = async (clientId: string) => {
  const { data, error } = await supabase
    .from('technicians')
    .select('*, technician_schedules (*)')
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);
  return (data || []).map((tech: any) => {
    const rawSchedules = tech.technician_schedules || [];
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const formattedSchedule = dayOrder.map(day => {
      const match = rawSchedules.find((s: any) => s.day_name === day);
      return match ? {
        day: match.day_name,
        enabled: match.is_enabled,
        is24Hours: match.is_24h,
        start: match.start_time ? match.start_time.slice(0, 5) : '08:00',
        end: match.end_time ? match.end_time.slice(0, 5) : '17:00',
        override: match.override_status || 'None'
      } : { day, enabled: true, is24Hours: false, start: '08:00', end: '17:00', override: 'None' };
    });
    return {
      id: tech.id,
      name: tech.name,
      role: tech.role as Role,
      phone: toDisplay(tech.phone),
      email: tech.email || '',
      clientId: tech.client_id,
      emergencyPriority: tech.emergency_priority,
      emergencyPriorityNumber: tech.emergency_priority_number,
      emergencyStatus: tech.emergency_status || Status.OFF_DUTY,
      emergencySchedule: formattedSchedule,
      inspectionPriority: tech.inspection_priority,
      inspectionPriorityNumber: tech.inspection_priority_number,
      inspectionStatus: tech.inspection_status || InspectionStatus.UNAVAILABLE,
      inspectionStatusDate: tech.inspection_status_date,
      inspectionSchedule: formattedSchedule
    };
  });
};

export const syncTechnicianToSupabase = async (techData: any) => {
  const payload: any = {
    id: techData.id,
    name: techData.name,
    role: techData.role,
    phone: toE164(techData.phone || '(555) 555-5555'),
    client_id: techData.client_id,
    emergency_priority: techData.emergency_priority,
    inspection_priority: techData.inspection_priority,
    emergency_priority_number: techData.emergency_priority_number || 99,
    inspection_priority_number: techData.inspection_priority_number || 99
  };
  const { data, error } = await supabase.from('technicians').upsert(payload).select();
  if (error) throw new Error(error.message);
  return data;
};

export const syncScheduleToSupabase = async (techId: string, schedule: any[]) => {
  await supabase.from('technician_schedules').delete().eq('technician_id', techId);
  const rows = schedule.map(s => ({
    technician_id: techId,
    day_name: s.day,
    is_enabled: s.enabled,
    is_24h: s.is_24h || false,
    start_time: s.start || null,
    end_time: s.end || null,
    override_status: s.override || 'None'
  }));
  const { data, error: insertError } = await supabase.from('technician_schedules').insert(rows);
  if (insertError) throw new Error(insertError.message);
  return data;
};

export const fetchCalendarEvents = async (clientId: string) => {
  const { data, error } = await supabase.from('calendar_events').select('*').eq('client_id', clientId);
  if (error) throw new Error(error.message);
  return (data || []).map((event: any) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    startTime: event.start_time,
    endTime: event.end_time,
    contactId: event.contact_id,
    jobId: event.job_id,
    assignedTechnicianIds: event.assigned_technician_ids || [],
    status: event.status,
    location: event.location,
    lossType: event.loss_type,
    description: event.description
  }));
};

export const syncCalendarEventToSupabase = async (event: any, clientId: string) => {
  const { data, error } = await supabase.from('calendar_events').upsert({
    id: event.id,
    type: event.type,
    title: event.title,
    start_time: event.startTime,
    end_time: event.endTime,
    contact_id: event.contactId,
    // Fix: Ensure empty jobId is sent as null to satisfy foreign key constraints
    job_id: event.jobId || null,
    assigned_technician_ids: event.assigned_technician_ids,
    status: event.status,
    location: event.location,
    loss_type: event.lossType,
    description: event.description,
    client_id: clientId
  }).select();
  if (error) throw new Error(error.message);
  return data;
};

export const fetchContactsFromSupabase = async (clientId: string) => {
  const { data, error } = await supabase.from('contacts').select('*').eq('client_id', clientId);
  if (error) throw new Error(error.message);
  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: toDisplay(c.phone),
    email: c.email,
    address: c.address,
    street: c.street,
    city: c.city,
    state: c.state,
    postalCode: c.postal_code,
    country: c.country,
    tags: c.tags || [],
    type: c.type as ContactType,
    role: c.role as Role,
    pipelineStage: c.pipeline_stage,
    notes: c.notes,
    company: c.company,
    vipStatus: c.vip_status,
    customFields: {}
  }));
};

export const syncContactToSupabase = async (contact: Contact, clientId: string) => {
  const { data, error } = await supabase.from('contacts').upsert({
    id: contact.id,
    name: contact.name,
    first_name: contact.firstName,
    last_name: contact.lastName,
    phone: toE164(contact.phone),
    email: contact.email,
    address: contact.address,
    street: contact.street,
    city: contact.city,
    state: contact.state,
    postal_code: contact.postalCode,
    country: contact.country,
    tags: contact.tags,
    type: contact.type,
    role: contact.role,
    pipeline_stage: contact.pipelineStage,
    client_id: clientId,
    notes: contact.notes,
    company: contact.company,
    vip_status: contact.vipStatus
  }).select();
  if (error) throw new Error(error.message);
  return data;
};

export const fetchJobsFromSupabase = async (clientId: string): Promise<Job[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((j: any) => ({
    id: j.id,
    contactId: j.contact_id,
    propertyManagerId: j.property_manager_id,
    title: j.title,
    stage: j.stage as PipelineStage,
    status: j.status as 'Open' | 'Closed', 
    lossType: j.loss_type || 'Other',
    assignedTechIds: j.assigned_tech_ids || [],
    urgency: j.urgency as any || 'Medium',
    estimatedValue: Number(j.estimated_value) || 0,
    timestamp: new Date(j.created_at).toLocaleDateString(),
    customFields: j.custom_fields || {},
    notes: j.notes || [], 
    readings: j.readings || [], 
    financials: j.financials || [], 
    documents: j.documents || []
  }));
};

export const syncJobToSupabase = async (job: Job, clientId: string) => {
  const { data, error } = await supabase.from('jobs').upsert({
    id: job.id,
    client_id: clientId,
    contact_id: job.contactId,
    property_manager_id: job.propertyManagerId || null,
    title: job.title,
    stage: job.stage,
    status: job.status, 
    loss_type: job.lossType,
    urgency: job.urgency,
    estimated_value: job.estimatedValue,
    assigned_tech_ids: job.assignedTechIds,
    custom_fields: job.customFields,
    notes: job.notes 
  }, { onConflict: 'id' }).select();
  if (error) throw new Error(error.message);
  return data;
};
