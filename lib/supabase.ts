import { createClient } from '@supabase/supabase-js';
import { Status, InspectionStatus, Contact, ContactType, Job, PipelineStage, Conversation, Message, ConversationSource } from '../types.ts';
import { toE164, toDisplay } from '../utils/phoneUtils.ts';

const SUPABASE_URL = 'https://nyscciinkhlutvqkgyvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55c2NjaWlua2hsdXR2cWtneXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyODMxMzMsImV4cCI6MjA4MTg1OTEzM30.4c3QmNYFZS68y4JLtEKwzVo_nQm3pKzucLOajSVRDOA';

// Provided n8n webhook for Twilio outbound processing
const N8N_OUTBOUND_WEBHOOK = 'https://restorationai.app.n8n.cloud/webhook/twilio/send-message'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * AUTHENTICATION
 */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single();
    
  return { ...user, profile };
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
  
  return data.map(c => ({
    id: c.id,
    contactId: c.contact_id,
    lastMessage: c.last_message || '',
    timestamp: new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    source: c.source as ConversationSource,
    status: c.status as any,
    urgency: c.urgency as any,
    isStarred: c.is_starred,
    isUnread: c.is_unread,
    isInternal: c.is_internal,
    messages: [] 
  }));
};

export const fetchMessages = async (conversationId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map(m => ({
    id: m.id,
    sender: m.sender_type as any,
    senderId: m.sender_id,
    content: m.content,
    timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    source: m.source as any,
    status: m.status as any,
    direction: m.direction as 'inbound' | 'outbound',
    twilioSid: m.twilio_sid,
    mediaUrls: m.media_urls,
    errorMessage: m.error_message
  }));
};

export const sendMessageToDb = async (msg: Partial<Message>, conversationId: string, companyId: string) => {
  // 1. Fetch contact and company info for the outbound routing
  const { data: convData } = await supabase
    .from('conversations')
    .select('contact_id, company_id')
    .eq('id', conversationId)
    .single();

  let toPhone = '';
  let fromPhone = '';

  if (convData) {
    const [contactRes, companyRes] = await Promise.all([
      supabase.from('contacts').select('phone').eq('id', convData.contact_id).single(),
      supabase.from('companies').select('agent_phone_1').eq('id', convData.company_id).single()
    ]);
    // These are already E.164 if stored correctly
    toPhone = contactRes.data?.phone || '';
    fromPhone = companyRes.data?.agent_phone_1 || '';
  }

  // 2. Insert into Database as 'queued' and 'outbound'
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      company_id: companyId,
      sender_type: msg.sender,
      sender_id: msg.senderId,
      content: msg.content,
      direction: 'outbound',
      source: msg.source,
      status: 'queued'
    })
    .select()
    .single();

  if (error) throw error;

  // 3. Update conversation metadata
  await supabase
    .from('conversations')
    .update({ 
      last_message: msg.content, 
      last_message_at: new Date().toISOString(),
      is_unread: false 
    })
    .eq('id', conversationId);

  // 4. Trigger n8n for Twilio processing
  if (N8N_OUTBOUND_WEBHOOK && msg.source !== ConversationSource.INTERNAL) {
    try {
      fetch(N8N_OUTBOUND_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: data.id,
          companyId,
          conversationId,
          content: msg.content,
          source: msg.source,
          to: toPhone,
          from: fromPhone
        })
      });
    } catch (e) {
      console.error("Failed to notify n8n workflow:", e);
    }
  }

  return data;
};

/**
 * UTILITY FUNCTIONS
 */
const convertTo12h = (time24: string): string => {
  if (!time24) return '08:00 AM';
  const parts = time24.split(':');
  let hours = parseInt(parts[0]);
  const minutes = parts[1] || '00';
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const convertTo24h = (time12: string): string => {
  if (!time12 || time12 === 'None') return '08:00:00';
  const [time, period] = time12.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
};

const cleanStatus = (status: string): string => {
  if (!status) return '';
  const cleaned = status.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
  if (cleaned.toLowerCase().includes('active')) return Status.ACTIVE;
  if (cleaned.toLowerCase().includes('off duty')) return Status.OFF_DUTY;
  if (cleaned.toLowerCase().includes('available')) return InspectionStatus.AVAILABLE;
  if (cleaned.toLowerCase().includes('unavailable')) return InspectionStatus.UNAVAILABLE;
  return cleaned;
};

/**
 * DATA FETCHERS
 */
export const fetchCompanySettings = async (companyId: string) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

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
    agentPhone1: toDisplay(data.agent_phone_1), // Format for UI
    dispatchStrategy: data.dispatch_strategy,
    timezone: data.timezone,
    notificationPreference: data.notification_preference,
    maxLeadTechs: data.max_lead_techs,
    maxAssistantTechs: data.max_assistant_techs,
    owners: managementContacts.map((m: any) => ({ ...m, phone: toDisplay(m.phone) })), // Format for UI
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
};

export const syncCompanySettingsToSupabase = async (companyData: any) => {
  const primaryRecipient = companyData.owners?.[0] || { name: '', phone: '', email: '' };
  
  // Transform phones to E.164 before saving
  const ownersE164 = companyData.owners.map((o: any) => ({ ...o, phone: toE164(o.phone) }));

  const { data, error } = await supabase
    .from('companies')
    .upsert({
      id: companyData.id,
      name: companyData.name,
      agent_name: companyData.agentName,
      agent_phone_1: toE164(companyData.agentPhone1), // Store as E.164
      dispatch_strategy: companyData.dispatchStrategy,
      timezone: companyData.timezone,
      notification_preference: companyData.notificationPreference,
      max_lead_techs: companyData.maxLeadTechs,
      max_assistant_techs: companyData.maxAssistantTechs,
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
      twilio_subaccount_sid: companyData.twilioSubaccountSid,
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
  return data.map((tech: any) => {
    const rawSchedules = tech.technician_schedules || [];
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const formattedSchedule = dayOrder.map(day => {
      const match = rawSchedules.find((s: any) => s.day_name === day);
      return match ? {
        day: match.day_name,
        enabled: match.is_enabled,
        is24Hours: match.is_24h,
        start: match.start_time ? convertTo12h(match.start_time) : '08:00 AM',
        end: match.end_time ? convertTo12h(match.end_time) : '05:00 PM',
        override: match.override_status || 'None'
      } : { day, enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' };
    });
    return {
      id: tech.id,
      name: tech.name,
      role: tech.role,
      phone: toDisplay(tech.phone), // Format for UI
      email: tech.email || '',
      clientId: tech.client_id,
      emergencyPriority: tech.emergency_priority,
      emergencyPriorityNumber: tech.emergency_priority_number,
      emergencyStatus: cleanStatus(tech.emergency_status) || Status.OFF_DUTY,
      emergencySchedule: formattedSchedule,
      inspectionPriority: tech.inspection_priority,
      inspectionPriorityNumber: tech.inspection_priority_number,
      inspectionStatus: cleanStatus(tech.inspection_status) || InspectionStatus.UNAVAILABLE,
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
    phone: toE164(techData.phone || '(555) 555-5555'), // Store as E.164
    client_id: techData.client_id,
    emergency_priority: techData.emergency_priority,
    inspection_priority: techData.inspection_priority,
    emergency_priority_number: techData.emergency_priority_number || 99,
    inspection_priority_number: techData.inspection_priority_number || 99
  };
  if (techData.emergency_status) payload.emergency_status = cleanStatus(techData.emergency_status);
  if (techData.inspection_status) payload.inspection_status = cleanStatus(techData.inspection_status);
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
    is_24h: s.is24Hours || false,
    start_time: (s.start === 'None' || !s.start) ? null : convertTo24h(s.start),
    end_time: (s.end === 'None' || !s.end) ? null : convertTo24h(s.end),
    override_status: s.override || 'None'
  }));
  const { data, error: insertError } = await supabase.from('technician_schedules').insert(rows);
  if (insertError) throw new Error(insertError.message);
  return data;
};

export const fetchCalendarEvents = async (clientId: string) => {
  const { data, error } = await supabase.from('calendar_events').select('*').eq('client_id', clientId);
  if (error) throw new Error(error.message);
  return data.map((event: any) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    startTime: event.start_time,
    endTime: event.end_time,
    contactId: event.contact_id,
    assignedTechnicianIds: event.assigned_technician_ids || [],
    status: event.status,
    location: event.location,
    loss_type: event.loss_type,
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
    contact_id: event.contact_id,
    assigned_technician_ids: event.assignedTechnicianIds,
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
  return data.map((c: any) => ({
    id: c.id,
    name: c.name,
    phone: toDisplay(c.phone), // Format for UI
    email: c.email,
    address: c.address,
    tags: c.tags || [],
    type: c.type as ContactType,
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
    phone: toE164(contact.phone), // Store as E.164
    email: contact.email,
    address: contact.address,
    tags: contact.tags,
    type: contact.type,
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
  if (error) throw new Error(error.message);
  return data.map((j: any) => ({
    id: j.id,
    contactId: j.contact_id,
    title: j.title,
    stage: j.stage as PipelineStage,
    lossType: j.loss_type || 'Other',
    assignedTechIds: j.assigned_tech_ids || [],
    urgency: j.urgency as any || 'Medium',
    estimatedValue: Number(j.estimated_value) || 0,
    timestamp: new Date(j.created_at).toLocaleDateString(),
    customFields: j.custom_fields || {},
    notes: [], readings: [], financials: [], documents: []
  }));
};

export const syncJobToSupabase = async (job: Job, clientId: string) => {
  const { data, error } = await supabase.from('jobs').upsert({
    id: job.id,
    client_id: clientId,
    contact_id: job.contactId,
    title: job.title,
    stage: job.stage,
    loss_type: job.lossType,
    urgency: job.urgency,
    estimated_value: job.estimatedValue,
    assigned_tech_ids: job.assignedTechIds,
    custom_fields: job.customFields
  }, { onConflict: 'id' }).select();
  if (error) throw new Error(error.message);
  return data;
};
