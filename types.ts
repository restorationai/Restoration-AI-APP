export enum Role {
  LEAD = 'Lead',
  ASSISTANT = 'Assistant'
}

export enum Status {
  ACTIVE = 'Active',
  OFF_DUTY = 'Off Duty'
}

export enum InspectionStatus {
  AVAILABLE = 'Available',
  UNAVAILABLE = 'Unavailable'
}

export enum DispatchStrategy {
  BROADCAST = 'Broadcast',
  CASCADING = 'Cascading'
}

export enum NotificationPreference {
  ACTIVE_ONLY = 'Message Entire Team Active Only',
  BOTH = 'Message Entire Team Both Active/Inactive',
  ASSIGNED = 'Message Assigned Techs Only'
}

export enum ConversationSource {
  VOICE = 'voice',
  SMS = 'sms',
  EMAIL = 'email',
  CHAT = 'chat',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  INTERNAL = 'internal'
}

export enum ContactType {
  HOMEOWNER = 'Homeowner',
  RENTER = 'Renter/Tenant',
  REFERRAL_PARTNER = 'Referral Partner',
  PROPERTY_MANAGER = 'Property Manager',
  INSURANCE_AGENT = 'Insurance Agent',
  ADJUSTER = 'Adjuster',
  TPA = 'TPA',
  VENDOR = 'Vendor',
  OTHER = 'Other'
}

export type AppointmentType = 'emergency' | 'inspection';

export type PipelineStage = 'Inbound' | 'Dispatching' | 'In Progress' | 'Completion' | 'Invoiced';

export interface GHLCustomFields {
  incident_summary?: string;
  work_authorized?: string;
  urgency_level?: string;
  areas_affected?: string;
  source_of_damage?: string;
  service_needed?: string;
  property_type?: string;
  relation_to_property?: string;
  is_insurance_claim?: string;
  insurance_provider?: string;
  policy_number?: string;
  claim_number?: string;
  adjuster_name?: string;
  adjuster_email?: string;
  incident_id?: string;
  new_lead_call_summary?: string;
  owner_dm_name?: string;
  owner_dm_phone?: string;
  tenant_name?: string;
  tenant_phone?: string;
  call_outcome?: string;
}

export interface JobNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  isAiGenerated?: boolean;
}

export interface MoistureReading {
  id: string;
  date: string;
  room: string;
  temp: number;
  rh: number;
  gpp: number;
  moistureContent?: number;
  equipmentActive?: boolean;
}

export interface FinancialItem {
  id: string;
  description: string;
  qty: number;
  rate: number;
  type: 'estimate' | 'invoice';
}

export interface JobDocument {
  id: string;
  name: string;
  type: 'recording' | 'form' | 'photo' | 'invoice';
  url: string;
  timestamp: string;
  isSigned?: boolean;
}

export interface Job {
  id: string;
  contactId: string;
  title: string;
  stage: PipelineStage;
  lossType: string;
  assignedTechIds: string[];
  urgency: 'Low' | 'Medium' | 'High';
  estimatedValue?: number;
  timestamp: string;
  customFields?: GHLCustomFields;
  notes: JobNote[];
  readings: MoistureReading[];
  financials: FinancialItem[];
  documents: JobDocument[];
}

export interface CalendarEvent {
  id: string;
  type: AppointmentType;
  title: string;
  startTime: string; 
  endTime: string;   
  contactId: string;
  assignedTechnicianIds: string[];
  status: 'pending' | 'confirmed' | 'dispatched' | 'completed' | 'cancelled';
  location: string;
  description?: string;
  lossType?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  isMe?: boolean;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  company?: string;
  notes?: string;
  vipStatus?: boolean;
  tags: string[];
  type: ContactType;
  role: string; // Advisor recommended: Homeowner, Team Member, Partner
  pipelineStage: string;
  lastActivity: string;
  customFields: Record<string, string>;
}

export interface Message {
  id: string;
  sender: 'ai' | 'contact' | 'agent' | 'system';
  sender_type: string; // From Advisor: Contact, User, or System
  message_type: string; // From Advisor: sms, email, chat
  senderId?: string; 
  content: string;
  timestamp: string;
  source: ConversationSource | 'system';
  direction: 'inbound' | 'outbound';
  twilioSid?: string;
  status?: 'delivered' | 'sent' | 'failed' | 'queued';
  mediaUrls?: string[];
  errorMessage?: string;
}

export interface Conversation {
  id: string;
  contactId?: string; 
  teamMemberIds?: string[]; 
  name?: string; 
  lastMessage: string;
  lastMessagePreview?: string;
  last_message_at?: string; 
  timestamp: string;
  source: ConversationSource;
  status: 'ai-active' | 'human-needed' | 'resolved';
  urgency: 'Low' | 'Medium' | 'High';
  isStarred: boolean;
  isUnread: boolean;
  messages: Message[];
  isInternal?: boolean;
  type: 'external' | 'internal'; // Advisor recommended
}

export interface DaySchedule {
  day: string;
  enabled: boolean;
  is24Hours?: boolean;
  start: string;
  end: string;
  override: 'None' | 'Force Active' | 'Force Off Duty';
}

export interface RestorationCompany {
  id: string;
  name: string;
  ghlLocationId: string;
  status: string;
  dispatchStrategy: DispatchStrategy;
  timezone: string;
  notificationPreference: NotificationPreference;
  maxLeadTechs: number;
  maxAssistantTechs: number;
  owners: Array<{ name: string; phone: string; email: string }>;
  agentName: string;
  agentPhone1: string;
  onsiteResponseMinutes: number;
  minimumSchedulingNotice: number; 
  defaultInspectionDuration: number; 
  appointmentBufferTime: number; 
  serviceAreas: string;
  centerZipCode: string;
  serviceMileRadius: number;
  services: string[];
  joinedDate: string;
  ownerName: string;
  plan: string;
  totalDispatches: number;
  customFieldConfig: CustomField[];
  // New billing & routing fields
  twilioSubaccountSid?: string;
  stripeCustomerId?: string;
}

export interface Technician {
  id: string;
  name: string;
  role: Role;
  phone: string;
  email: string;
  emergencyPriority: string;
  emergencyPriorityNumber: number;
  emergencyStatus: Status;
  emergencySchedule: DaySchedule[];
  inspectionPriority: string;
  inspectionPriorityNumber: number;
  inspectionStatus: InspectionStatus;
  inspectionStatusDate?: string;
  inspectionSchedule: DaySchedule[];
  clientId: string;
}

export interface DispatchLog {
  id: string;
  timestamp: string;
  clientName: string;
  lossType: string;
  assignedTech: string;
  status: string;
  aiSummary: string;
}