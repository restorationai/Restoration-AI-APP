
import { 
  Role, Status, InspectionStatus, DispatchStrategy, 
  NotificationPreference, RestorationCompany, Technician,
  DispatchLog, DaySchedule, Contact, Conversation, ConversationSource, ContactType, TeamMember, CalendarEvent, Job
} from './types.ts';

export const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 'Mon', enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' },
  { day: 'Tue', enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' },
  { day: 'Wed', enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' },
  { day: 'Thu', enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' },
  { day: 'Fri', enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' },
  { day: 'Sat', enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' },
  { day: 'Sun', enabled: true, is24Hours: false, start: '08:00 AM', end: '05:00 PM', override: 'None' },
];

export const MOCK_TEAM: TeamMember[] = [
  { id: 'tm1', name: 'Santino Velci', email: 'contact@getrestorationai.com', role: 'Admin', isMe: true },
  { id: 'tm2', name: 'Levi Candiff', email: 'levi@ignitesystems.io', role: 'Technician' },
  { id: 'tm3', name: 'Melia Patterson', email: 'melia@ignitesystems.io', role: 'Support' }
];

export const MOCK_JOBS: Job[] = [
  {
    id: 'job1',
    contactId: 'con1',
    title: 'Burst Pipe Emergency',
    stage: 'Dispatching',
    lossType: 'Water Damage',
    assignedTechIds: ['T2'],
    urgency: 'High',
    estimatedValue: 2400,
    timestamp: '2m ago',
    notes: [],
    documents: [],
    readings: [],
    financials: []
  },
  {
    id: 'job2',
    contactId: 'con2',
    title: 'Mold Remediation Inspection',
    stage: 'Inbound',
    lossType: 'Mold',
    assignedTechIds: [],
    urgency: 'Medium',
    estimatedValue: 1500,
    timestamp: '15m ago',
    notes: [],
    documents: [],
    readings: [],
    financials: []
  }
];

export const MOCK_RESTORATION_COMPANIES: RestorationCompany[] = [
  {
    id: "qACWprCW7EhHPYv690nD",
    name: "ABC Restoration",
    ghlLocationId: "qACWprCW7EhHPYv690nD",
    status: "Active",
    dispatchStrategy: DispatchStrategy.CASCADING,
    timezone: "America/Los_Angeles",
    notificationPreference: NotificationPreference.ACTIVE_ONLY,
    maxLeadTechs: 50,
    maxAssistantTechs: 50,
    owners: [
      { name: "Santino Velci", phone: "(808) 989-1078", email: "velcisantino@gmail.com" }
    ],
    agentName: "Sarah",
    agentPhone1: "+18054398428",
    onsiteResponseMinutes: 60,
    minimumSchedulingNotice: 4,
    defaultInspectionDuration: 120,
    appointmentBufferTime: 30,
    serviceAreas: "San Luis Obispo",
    centerZipCode: "93422",
    serviceMileRadius: 45,
    services: ["Emergency Water Extraction", "Structural Drying", "Soot Cleanup"],
    joinedDate: "Jan 2024",
    ownerName: "Santino Velci",
    plan: "Pro AI",
    totalDispatches: 145,
    customFieldConfig: [
      { id: 'cf1', label: 'Insurance Carrier', type: 'text' },
      { id: 'cf2', label: 'Policy Number', type: 'text' },
      { id: 'cf3', label: 'Gate Code', type: 'text' }
    ]
  }
];

export const MOCK_CONTACTS: Contact[] = [
  {
    id: 'con1',
    name: 'Robert Miller',
    type: ContactType.HOMEOWNER,
    phone: '(805) 555-0122',
    email: 'robert@gmail.com',
    address: '124 Oak Street, San Luis Obispo, CA',
    tags: ['Emergency', 'Water Damage'],
    pipelineStage: 'Dispatching',
    lastActivity: '2m ago',
    customFields: { 'cf1': 'State Farm', 'cf2': 'SF-10293' },
    vipStatus: false,
    notes: 'Primary residence. Caller was very frantic.'
  },
  {
    id: 'con2',
    name: 'Amanda Brooks',
    type: ContactType.PROPERTY_MANAGER,
    company: 'Brooks Realty Group',
    phone: '(760) 231-9981',
    email: 'abrooks@outlook.com',
    address: '4502 Pismo Dr, Grover Beach, CA',
    tags: ['VIP Partner', 'Repeat Client'],
    pipelineStage: 'Inbound',
    lastActivity: '15m ago',
    customFields: { 'cf1': 'Allstate' },
    vipStatus: true,
    notes: 'Handles 150 units in SLO County.'
  },
  {
    id: 'con3',
    name: 'David Chen',
    type: ContactType.ADJUSTER,
    company: 'State Farm Claims',
    phone: '(805) 123-4567',
    email: 'd.chen@statefarm.com',
    address: '892 Marsh St, San Luis Obispo, CA',
    tags: ['Insurance'],
    pipelineStage: 'Inbound',
    lastActivity: '1h ago',
    customFields: {},
    vipStatus: false,
    notes: 'Prefer email for documentation.'
  }
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv1',
    contactId: 'con1',
    lastMessage: 'I am sending a technician now.',
    timestamp: '2m ago',
    source: ConversationSource.SMS,
    status: 'ai-active',
    urgency: 'High',
    isStarred: true,
    isUnread: true,
    // Fix: replaced incorrect 'type' property with mandatory 'category' property
    category: 'company_inbox',
    messages: [
      {
        id: 'm1',
        sender: 'contact',
        sender_type: 'Contact',
        message_type: 'sms',
        content: 'I have a major leak in my kitchen!',
        timestamp: '10:00 AM',
        source: ConversationSource.SMS,
        direction: 'inbound'
      },
      {
        id: 'm2',
        sender: 'ai',
        sender_type: 'System',
        message_type: 'sms',
        content: 'I am sorry to hear that. I am sending a technician now.',
        timestamp: '10:02 AM',
        source: ConversationSource.SMS,
        direction: 'outbound'
      }
    ]
  }
];

export const MOCK_TECHNICIANS: Technician[] = [
  {
    id: "T1",
    name: "Callum Candiff",
    role: Role.LEAD,
    phone: "+18055392313",
    email: "levi@getrestorationai.com",
    emergencyPriority: "2nd Priority",
    emergencyPriorityNumber: 2,
    emergencyStatus: Status.OFF_DUTY,
    emergencySchedule: [...DEFAULT_SCHEDULE],
    inspectionPriority: "2nd Priority",
    inspectionPriorityNumber: 2,
    inspectionStatus: InspectionStatus.AVAILABLE,
    inspectionSchedule: [...DEFAULT_SCHEDULE],
    clientId: "qACWprCW7EhHPYv690nD"
  },
  {
    id: "T2",
    name: "Jason Pacheco",
    role: Role.LEAD,
    phone: "+17605761987",
    email: "jason@dry1out.com",
    emergencyPriority: "1st Priority",
    emergencyPriorityNumber: 1,
    emergencyStatus: Status.ACTIVE,
    emergencySchedule: DEFAULT_SCHEDULE.map(d => ({ ...d, override: 'Force Active' })),
    inspectionPriority: "None",
    inspectionPriorityNumber: 99,
    inspectionStatus: InspectionStatus.UNAVAILABLE,
    inspectionSchedule: DEFAULT_SCHEDULE.map(d => ({ ...d, enabled: false })),
    clientId: "SoaJxwp6MUc7dIBOnzdi"
  }
];

const today = new Date();
const formatDate = (date: Date, hours: number) => {
  const d = new Date(date);
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
};

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'evt1',
    type: 'emergency',
    title: 'Water Damage: Robert Miller',
    startTime: formatDate(today, 10),
    endTime: formatDate(today, 12),
    contactId: 'con1',
    assignedTechnicianIds: ['T2'],
    status: 'dispatched',
    location: '124 Oak Street, San Luis Obispo, CA',
    lossType: 'Burst Pipe'
  },
  {
    id: 'evt2',
    type: 'inspection',
    title: 'Mold Inspection: Amanda Brooks',
    startTime: formatDate(today, 14),
    endTime: formatDate(today, 16),
    contactId: 'con2',
    assignedTechnicianIds: ['T1'],
    status: 'confirmed',
    location: '4502 Pismo Dr, Grover Beach, CA',
    lossType: 'Basement Mold'
  }
];

export const MOCK_DISPATCH_LOGS: DispatchLog[] = [
  {
    id: "L1",
    timestamp: "2024-03-20 02:14 AM",
    clientName: "John Smith",
    lossType: "Water Damage (Burst Pipe)",
    assignedTech: "Jason Pacheco",
    status: "Success",
    aiSummary: "Caller reported a burst pipe in the kitchen. Dispatched Jason Pacheco."
  }
];

export const SERVICE_OPTIONS = [
  "Air Duct Cleaning",
  "Art Restoration",
  "Asbestos Abatement",
  "Biohazard & Specialty Cleaning",
  "Black Mold Abatement",
  "Board-Up & Tarping Services",
  "Burst Pipe Cleanup",
  "Cabinetry",
  "Carpet & Upholstery Cleaning",
  "Content Cleaning",
  "Content Pack-Out & Storage",
  "Crawl Space Encapsulation",
  "Crime Scene Cleanup",
  "Document Drying & Recovery",
  "Dryer Vent Cleaning",
  "Drywall & Painting",
  "Electronics Restoration",
  "Emergency Water Extraction",
  "Fire & Smoke Restoration",
  "Fire Damage Restoration",
  "Flooring Installation",
  "General Cleaning & Maintenance",
  "General Contracting",
  "Hardwood Floor Drying (Injectidry)",
  "Hoarding Cleanup",
  "Indoor Air Quality (IAQ) Testing",
  "Infectious Disease Disinfection",
  "Lead Paint Abatement",
  "Leak Detection",
  "Meth Lab Cleanup",
  "Microbial Remediation (Mold Removal)",
  "Mold Inspection & Assessment",
  "Mold Remediation",
  "Odor Control / Deodorization",
  "Post-Construction Cleaning",
  "Puffback Cleanup",
  "Reconstruction & Repairs",
  "Roofing Repair",
  "Sewage Cleanup & Remediation",
  "Soot & Smoke Removal",
  "Structural Drying & Dehumidification",
  "Structural Repairs",
  "Sump Pump Failure Cleanup",
  "Tear Gas Cleanup",
  "Textile Restoration",
  "Tile & Grout Cleaning",
  "Trauma Scene Cleanup",
  "Unattended Death Cleanup",
  "Vandalism & Graffiti Removal",
  "Water Damage Restoration"
];

export const TIMEZONES = [
  "America/Los_Angeles",
  "America/Chicago",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Phoenix",
  "America/Denver",
  "America/New_York"
];

export const INITIAL_COMPANY_SETTINGS = MOCK_RESTORATION_COMPANIES[0];
