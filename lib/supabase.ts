
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nyscciinkhlutvqkgyvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55c2NjaWlua2hsdXR2cWtneXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyODMxMzMsImV4cCI6MjA4MTg1OTEzM30.4c3QmNYFZS68y4JLtEKwzVo_nQm3pKzucLOajSVRDOA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetches the specific company settings from Supabase
 */
export const fetchCompanySettings = async (companyId: string) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(error.message);
  }

  // Map database columns back to RestorationCompany interface
  return {
    id: data.id,
    name: data.name,
    agentName: data.agent_name,
    agentPhone1: data.agent_phone_1,
    dispatchStrategy: data.dispatch_strategy,
    timezone: data.timezone,
    notificationPreference: data.notification_preference,
    maxLeadTechs: data.max_lead_techs,
    maxAssistantTechs: data.max_assistant_techs,
    // Note: The DB currently stores owner1 specifically
    owners: [
      { 
        name: data.owner_1_name || '', 
        phone: data.owner_1_phone || '', 
        email: data.owner_1_email || '' 
      }
    ],
    onsiteResponseMinutes: data.onsite_response_minutes,
    centerZipCode: data.center_zip_code,
    serviceMileRadius: data.service_mile_radius,
    services: data.services || [],
    ghlLocationId: data.id,
    status: 'Active',
    // Providing safe defaults for fields that do not exist in the Supabase schema
    minimumSchedulingNotice: 4,
    serviceAreas: 'San Luis Obispo',
    joinedDate: 'Jan 2024',
    ownerName: data.owner_1_name || '',
    plan: 'Pro AI',
    totalDispatches: 145,
    customFieldConfig: []
  };
};

/**
 * Persists all company settings to Supabase
 */
export const syncCompanySettingsToSupabase = async (companyData: any) => {
  // Map the first owner to owner_1 columns for DB compatibility
  const primaryOwner = companyData.owners?.[0] || { name: '', phone: '', email: '' };
  
  // Explicitly mapping only the columns known to exist in the database
  const { data, error } = await supabase
    .from('companies')
    .upsert({
      id: companyData.id,
      name: companyData.name,
      agent_name: companyData.agentName,
      agent_phone_1: companyData.agentPhone1,
      dispatch_strategy: companyData.dispatchStrategy,
      timezone: companyData.timezone,
      notification_preference: companyData.notificationPreference,
      max_lead_techs: companyData.maxLeadTechs,
      max_assistant_techs: companyData.maxAssistantTechs,
      owner_1_name: primaryOwner.name,
      owner_1_phone: primaryOwner.phone,
      owner_1_email: primaryOwner.email,
      onsite_response_minutes: companyData.onsiteResponseMinutes,
      center_zip_code: companyData.centerZipCode,
      service_mile_radius: companyData.serviceMileRadius,
      services: companyData.services
    })
    .select();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Fetches all technicians and their nested schedules from Supabase
 */
export const fetchTechniciansFromSupabase = async (clientId: string) => {
  const { data, error } = await supabase
    .from('technicians')
    .select(`
      *,
      technician_schedules (*)
    `)
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
      phone: tech.phone,
      email: tech.email || '',
      clientId: tech.client_id,
      emergencyPriority: tech.emergency_priority,
      emergencyPriorityNumber: tech.emergency_priority_number,
      emergencyStatus: tech.emergency_status || '🔴 Off Duty',
      emergencySchedule: formattedSchedule,
      inspectionPriority: tech.inspection_priority,
      inspectionPriorityNumber: tech.inspection_priority_number,
      inspectionStatus: tech.inspection_status || '⛔ Unavailable',
      inspectionStatusDate: tech.inspection_status_date,
      inspectionSchedule: formattedSchedule
    };
  });
};

export const syncTechnicianToSupabase = async (techData: any) => {
  const { data, error } = await supabase
    .from('technicians')
    .upsert({
      id: techData.id,
      name: techData.name,
      role: techData.role,
      phone: techData.phone || '(555) 555-5555',
      client_id: 'qACWprCW7EhHPYv690nD',
      emergency_priority: techData.emergency_priority,
      inspection_priority: techData.inspection_priority,
      emergency_priority_number: techData.emergency_priority_number || 99,
      inspection_priority_number: techData.inspection_priority_number || 99
    })
    .select();

  if (error) throw new Error(error.message);
  return data;
};

export const syncScheduleToSupabase = async (techId: string, schedule: any[]) => {
  await supabase
    .from('technician_schedules')
    .delete()
    .eq('technician_id', techId);

  const rows = schedule.map(s => ({
    technician_id: techId,
    day_name: s.day,
    is_enabled: s.enabled,
    is_24h: s.is24Hours || false,
    start_time: (s.start === 'None' || !s.start) ? null : convertTo24h(s.start),
    end_time: (s.end === 'None' || !s.end) ? null : convertTo24h(s.end),
    override_status: s.override || 'None'
  }));

  const { data, error: insertError } = await supabase
    .from('technician_schedules')
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
  return data;
};

function convertTo24h(timeStr: string) {
  if (!timeStr || timeStr === 'None') return null;
  try {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    let h = parseInt(hours);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${minutes}:00`;
  } catch (e) {
    return null;
  }
}

function convertTo12h(timeStr: string) {
  if (!timeStr) return '08:00 AM';
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${minutes} ${period}`;
}
