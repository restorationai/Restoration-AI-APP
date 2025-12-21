
export enum Role {
  LEAD = 'Lead',
  ASSISTANT = 'Assistant'
}

export enum Status {
  ACTIVE = '🟢 Active',
  OFF_DUTY = '🔴 Off Duty'
}

export enum InspectionStatus {
  AVAILABLE = '✅ Available',
  UNAVAILABLE = '⛔ Unavailable'
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
  REFERRAL_PARTNER = 'Referral Partner',
  ADJUSTER = 'Adjuster',
  VENDOR = 'Vendor'
}

export type AppointmentType = 'emergency' | 'inspection';

export interface CalendarEvent {
  id: string;
  type: AppointmentType;
  title: string;
  startTime: string; // ISO String
  endTime: string;   // ISO String
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
  tags: string[];
  type: ContactType;
  pipelineStage: string;
  lastActivity: string;
  customFields: Record<string, string>;
}

export interface Message {
  id: string;
  sender: 'ai' | 'contact' | 'agent' | 'system';
  senderId?: string; // ID of the TeamMember if sender is 'agent'
  content: string;
  timestamp: string;
  source: ConversationSource | 'system';
  subject?: string;
  audioUrl?: string;
  fromName?: string;
  fromAddress?: string;
}

export interface Conversation {
  id: string;
  contactId?: string; // Optional for internal chats
  teamMemberIds?: string[]; // For internal chats
  name?: string; // For group chats
  lastMessage: string;
  timestamp: string;
  source: ConversationSource;
  status: 'ai-active' | 'human-needed' | 'resolved';
  urgency: 'Low' | 'Medium' | 'High';
  isStarred: boolean;
  isUnread: boolean;
  messages: Message[];
  isInternal?: boolean;
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
  minimumSchedulingNotice: number; // in hours
  serviceAreas: string;
  centerZipCode: string;
  serviceMileRadius: number;
  services: string[];
  joinedDate: string;
  ownerName: string;
  plan: string;
  totalDispatches: number;
  customFieldConfig: CustomField[];
}

export interface Technician {
  id: string;
  name: string;
  role: Role;
  phone: string;
  email: string;
  // Emergency Logic
  emergencyPriority: string;
  emergencyPriorityNumber: number;
  emergencyStatus: Status;
  emergencySchedule: DaySchedule[];
  // Inspection Logic
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
