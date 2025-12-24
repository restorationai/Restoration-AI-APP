
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Users, 
  AlertCircle, 
  ShieldCheck, 
  Plus, 
  MapPin, 
  X,
  CheckCircle2,
  Info,
  CalendarDays,
  Activity,
  LayoutGrid,
  Columns,
  Lock,
  Briefcase,
  Layers,
  Check,
  Tag,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertTriangle,
  User,
  Search,
  UserPlus,
  Mail,
  Home,
  CalendarRange,
  Edit2
} from 'lucide-react';
import { MOCK_CALENDAR_EVENTS, MOCK_TECHNICIANS, MOCK_CONTACTS, INITIAL_COMPANY_SETTINGS } from '../constants';
import { CalendarEvent, AppointmentType, Technician, Role, Status, InspectionStatus, Contact, ContactType } from '../types';
import { fetchCalendarEvents, syncCalendarEventToSupabase, fetchTechniciansFromSupabase, fetchCompanySettings, syncContactToSupabase, fetchContactsFromSupabase } from '../lib/supabase';
import { formatPhoneNumberInput } from '../utils/phoneUtils.ts';

// Define missing types for calendar state management
type CalendarMode = 'all' | 'emergency' | 'inspection';
type ViewType = 'day' | 'week' | 'month';

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const UnifiedCalendar: React.FC = () => {
  const [viewMode, setViewMode] = useState<CalendarMode>('all');
  const [viewType, setViewType] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companyConfig, setCompanyConfig] = useState(INITIAL_COMPANY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  // Form States
  const [newJob, setNewJob] = useState({
    id: null as string | null,
    title: '',
    type: 'inspection' as AppointmentType,
    contactId: '',
    location: '',
    city: '',
    zip: '',
    date: new Date(),
    time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
    lossType: '',
    customLossType: '',
    techIds: [] as string[]
  });

  const [newContactForm, setNewContactForm] = useState({
    name: '',
    phone: '',
    email: '',
    type: ContactType.HOMEOWNER
  });

  const [newContactAddr, setNewContactAddr] = useState({
    street: '',
    city: '',
    state: 'CA',
    zip: ''
  });

  // UI States
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [pickerViewDate, setPickerViewDate] = useState(new Date());

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [fetchedEvents, fetchedTechs, fetchedConfig, fetchedContacts] = await Promise.all([
          fetchCalendarEvents(INITIAL_COMPANY_SETTINGS.id),
          fetchTechniciansFromSupabase(INITIAL_COMPANY_SETTINGS.id),
          fetchCompanySettings(INITIAL_COMPANY_SETTINGS.id),
          fetchContactsFromSupabase(INITIAL_COMPANY_SETTINGS.id)
        ]);
        
        setEvents(fetchedEvents.length > 0 ? fetchedEvents : MOCK_CALENDAR_EVENTS);
        setTechnicians(fetchedTechs.length > 0 ? fetchedTechs : MOCK_TECHNICIANS);
        setContacts(fetchedContacts.length > 0 ? fetchedContacts : MOCK_CONTACTS);
        if (fetchedConfig) setCompanyConfig(fetchedConfig);
      } catch (err) {
        console.error("Failed to load calendar data:", err);
        setEvents(MOCK_CALENDAR_EVENTS);
        setTechnicians(MOCK_TECHNICIANS);
        setContacts(MOCK_CONTACTS);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();

    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hoursList = Array.from({ length: 15 }, (_, i) => i + 7);

  const parseTimeValue = (timeStr: string, isEnd: boolean = false) => {
    if (!timeStr || timeStr === 'None') return null;
    const parts = timeStr.split(' ');
    if (parts.length === 2) {
      let [h, m] = parts[0].split(':').map(Number);
      const period = parts[1];
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      const val = h * 60 + (m || 0);
      if (isEnd && val === 0) return 1440;
      return val;
    } else {
      let [h, m] = timeStr.split(':').map(Number);
      const val = h * 60 + (m || 0);
      if (isEnd && val === 0) return 1440;
      return val;
    }
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }); 
  };

  const isTechOnDuty = (tech: Technician, date: Date, timeStr: string, overrideType?: AppointmentType) => {
    const dayName = getDayName(date);
    const mode = overrideType || (viewMode === 'inspection' ? 'inspection' : 'emergency');
    const schedule = mode === 'emergency' ? tech.emergencySchedule : tech.inspectionSchedule;
    const daySched = schedule.find(s => s.day === dayName);

    if (!daySched || !daySched.enabled) return false;
    if (daySched.override === 'Force Active') return true;
    if (daySched.override === 'Force Off Duty') return false;
    if (daySched.is24Hours) return true;

    const totalMinutes = parseTimeValue(timeStr);
    const startMinutes = parseTimeValue(daySched.start);
    const endMinutes = parseTimeValue(daySched.end, true);

    if (totalMinutes === null || startMinutes === null || endMinutes === null) return false;
    return totalMinutes >= startMinutes && totalMinutes < endMinutes;
  };

  const getTechConflict = (techId: string, bookingDate: Date, bookingTime: string, currentEventId: string | null = null) => {
    const [h, m] = bookingTime.split(':').map(Number);
    const start = new Date(bookingDate);
    start.setHours(h, m, 0, 0);
    
    const duration = companyConfig.defaultInspectionDuration || 120;
    const buffer = companyConfig.appointmentBufferTime || 30;
    const end = new Date(start.getTime() + (duration + buffer) * 60000);

    return events.find(event => {
      if (event.id === currentEventId) return false;
      if (!event.assignedTechnicianIds.includes(techId)) return false;
      
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(new Date(event.endTime).getTime() + buffer * 60000);
      
      return (start < eventEnd) && (end > eventStart);
    });
  };

  const isSlotInNoticeWindow = (date: Date, hour: number) => {
    if (viewMode === 'emergency') return false;
    const slotTime = new Date(date);
    slotTime.setHours(hour, 0, 0, 0);
    const noticeLimit = new Date(now.getTime() + (companyConfig.minimumSchedulingNotice || 4) * 60 * 60 * 1000);
    return slotTime < noticeLimit;
  };

  const getCapacityDetails = (date: Date, hour?: number) => {
    const timeStr = hour !== undefined ? `${hour.toString().padStart(2, '0')}:00` : "00:00";
    
    const onDutyTechs = technicians.filter(t => {
      if (hour !== undefined) return isTechOnDuty(t, date, timeStr);
      const dayName = getDayName(date);
      const mode = viewMode === 'inspection' ? 'inspection' : 'emergency';
      const sched = mode === 'emergency' ? t.emergencySchedule : t.inspectionSchedule;
      return sched.find(s => s.day === dayName)?.enabled;
    });

    const assignedCount = events.filter(e => {
      const start = new Date(e.startTime);
      const sameDay = start.toDateString() === date.toDateString();
      if (hour !== undefined) return sameDay && start.getHours() === hour;
      return sameDay;
    }).length;

    const availableLeads = onDutyTechs.filter(t => t.role === Role.LEAD).length - assignedCount;

    return {
      totalOnDuty: onDutyTechs.length,
      availableLeads: Math.max(0, availableLeads),
      isLocked: hour !== undefined ? isSlotInNoticeWindow(date, hour) : false
    };
  };

  const candidateSquad = useMemo(() => {
    if (!technicians.length) return [];
    
    return technicians.filter(t => {
      const onDuty = isTechOnDuty(t, newJob.date, newJob.time, newJob.type);
      if (!onDuty) return false;

      if (newJob.type === 'inspection') {
        return t.role === Role.LEAD;
      } else {
        return t.role === Role.LEAD || t.role === Role.ASSISTANT;
      }
    });
  }, [technicians, newJob.date, newJob.time, newJob.type]);

  const filteredEvents = useMemo(() => {
    if (viewMode === 'all') return events;
    return events.filter(e => e.type === viewMode);
  }, [events, viewMode]);

  const navigate = (direction: 'prev' | 'next') => {
    const next = new Date(selectedDate);
    if (viewType === 'day') next.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    else if (viewType === 'week') next.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    else if (viewType === 'month') next.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedDate(next);
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const d = new Date(newJob.date);
      const [h, m] = newJob.time.split(':').map(Number);
      d.setHours(h, m, 0, 0);

      const duration = companyConfig.defaultInspectionDuration || 120;
      const end = new Date(d.getTime() + duration * 60 * 1000);
      const finalLossType = newJob.lossType === 'Other' ? (newJob.customLossType || 'Other') : newJob.lossType;
      const fullLocation = `${newJob.location}${newJob.city ? `, ${newJob.city}` : ''}${newJob.zip ? ` ${newJob.zip}` : ''}`;
      const contact = contacts.find(c => c.id === newJob.contactId);

      const updatedEvent: CalendarEvent = {
        id: newJob.id || generateUUID(),
        type: newJob.type,
        title: newJob.title || `${finalLossType || 'General'}: ${contact?.name || 'Manual Entry'}`,
        startTime: d.toISOString(),
        endTime: end.toISOString(),
        contactId: newJob.contactId,
        assignedTechnicianIds: newJob.techIds,
        status: 'pending',
        location: fullLocation || 'Unknown Location',
        lossType: finalLossType
      };

      await syncCalendarEventToSupabase(updatedEvent, INITIAL_COMPANY_SETTINGS.id);
      
      if (newJob.id) {
        setEvents(prev => prev.map(ev => ev.id === newJob.id ? updatedEvent : ev));
      } else {
        setEvents(prev => [...prev, updatedEvent]);
      }
      
      setIsBooking(false);
      
      // Reset Form
      setNewJob({
        id: null,
        title: '',
        type: 'inspection',
        contactId: '',
        location: '',
        city: '',
        zip: '',
        date: new Date(),
        time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
        lossType: '',
        customLossType: '',
        techIds: []
      });
      setSelectedDate(d);
    } catch (err: any) {
      console.error("Failed to save event:", err);
      alert(`Error saving appointment: ${err.message || 'Database connection error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    const startDate = new Date(event.startTime);
    const standardLossTypes = ['Mold Assessment', 'Water Damage Assessment', 'Fire Damage Assessment', 'Biohazard Assessment', 'Storm Damage Assessment'];
    const isOther = event.lossType && !standardLossTypes.includes(event.lossType);

    setNewJob({
      id: event.id,
      title: event.title,
      type: event.type,
      contactId: event.contactId,
      location: event.location,
      city: '',
      zip: '',
      date: startDate,
      time: `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`,
      lossType: isOther ? 'Other' : (event.lossType || ''),
      customLossType: isOther ? (event.lossType || '') : '',
      techIds: event.assignedTechnicianIds
    });
    
    setIsBooking(true);
    setSelectedEvent(null);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const fullAddress = `${newContactAddr.street}, ${newContactAddr.city}, ${newContactAddr.state} ${newContactAddr.zip}`;
      // Fix: Add missing role property to satisfy Contact interface
      const newContact: Contact = {
        id: `con-${Date.now()}`,
        name: newContactForm.name,
        phone: newContactForm.phone, // lib/supabase.ts handles E.164 conversion
        email: newContactForm.email,
        address: fullAddress,
        tags: ['New Lead', 'Manual Entry'],
        type: newContactForm.type,
        // Add missing role property based on type
        role: newContactForm.type === ContactType.HOMEOWNER ? 'Homeowner' : 'Partner',
        pipelineStage: 'Inbound',
        lastActivity: 'Just created',
        customFields: {}
      };

      await syncContactToSupabase(newContact, INITIAL_COMPANY_SETTINGS.id);
      setContacts(prev => [newContact, ...prev]);
      setNewJob(prev => ({ ...prev, contactId: newContact.id, location: fullAddress }));
      setIsAddingContact(false);
      setNewContactForm({ name: '', phone: '', email: '', type: ContactType.HOMEOWNER });
      setNewContactAddr({ street: '', city: '', state: 'CA', zip: '' });
      setIsContactPickerOpen(false);
    } catch (err: any) {
      alert(`Failed to create contact: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredContactsList = useMemo(() => {
    return contacts.filter(c => 
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone.includes(contactSearch)
    );
  }, [contacts, contactSearch]);

  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const monthYear = selectedDate.getFullYear();
  const monthMonth = selectedDate.getMonth();
  const monthFirstDay = new Date(monthYear, monthMonth, 1).getDay();
  const monthDaysIn = new Date(monthYear, monthMonth + 1, 0).getDate();
  const monthPrevDays = new Date(monthYear, monthMonth, 0).getDate();

  const monthViewDays = [];
  for (let i = monthFirstDay - 1; i >= 0; i--) {
    monthViewDays.push({ day: monthPrevDays - i, current: false, date: new Date(monthYear, monthMonth - 1, monthPrevDays - i) });
  }
  for (let i = 1; i <= monthDaysIn; i++) {
    monthViewDays.push({ day: i, current: true, date: new Date(monthYear, monthMonth, i) });
  }
  const monthRemaining = 42 - monthViewDays.length;
  for (let i = 1; i <= monthRemaining; i++) {
    monthViewDays.push({ day: i, current: false, date: new Date(monthYear, monthMonth + 1, i) });
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden text-slate-900">
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><CalendarIcon size={24} /></div>
             <div><h2 className="text-xl font-black text-slate-800 tracking-tight">Unified Dispatch Calendar</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Activity size={10} /> Real-time Capacity Manager</p></div>
          </div>
          <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button onClick={() => setViewMode('all')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}><Layers size={14} /> All Jobs</button>
            <button onClick={() => setViewMode('emergency')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'emergency' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}><AlertCircle size={14} /> Emergency Capacity</button>
            <button onClick={() => setViewMode('inspection')} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'inspection' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}><ShieldCheck size={14} /> Inspection Capacity</button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
             {[ { id: 'day', label: 'Day', icon: <Clock size={14} /> }, { id: 'week', label: 'Week', icon: <Columns size={14} /> }, { id: 'month', label: 'Month', icon: <LayoutGrid size={14} /> } ].map(v => (
               <button key={v.id} onClick={() => setViewType(v.id as ViewType)} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === v.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>{v.icon} {v.label}</button>
             ))}
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-2 py-1.5 shadow-sm">
            <button onClick={() => navigate('prev')} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-800"><ChevronLeft size={20} /></button>
            <div className="px-6 flex flex-col items-center min-w-[140px]">
               <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{viewType === 'month' ? selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{viewType === 'day' ? selectedDate.toLocaleDateString('en-US', { weekday: 'long' }) : 'Current Window'}</span>
            </div>
            <button onClick={() => navigate('next')} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-800"><ChevronRight size={20} /></button>
          </div>
          <button onClick={() => { setNewJob({id: null, title: '', type: 'inspection', contactId: '', location: '', city: '', zip: '', date: new Date(), time: `${new Date().getHours().toString().padStart(2, '0')}:00`, lossType: '', customLossType: '', techIds: []}); setIsBooking(true); }} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"><Plus size={16} /> Book Job</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-1">
          {viewType === 'day' && (
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-[120px_1fr] border-b border-slate-100 bg-slate-50/50">
                <div className="p-4 flex items-center justify-center border-r border-slate-100"><Clock size={16} className="text-slate-400" /></div>
                <div className="p-4 px-8 flex items-center justify-between">
                   <div className="flex items-center gap-3"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Capacity Slots</span></div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {hoursList.map((hour) => {
                  const hourEvents = filteredEvents.filter(e => { const d = new Date(e.startTime); return d.toDateString() === selectedDate.toDateString() && d.getHours() === hour; });
                  const cap = getCapacityDetails(selectedDate, hour);
                  const displayHour = hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 ${hour === 12 ? 'PM' : 'AM'}`;
                  return (
                    <div key={hour} className={`grid grid-cols-[120px_1fr] border-b border-slate-50 min-h-[100px] group transition-colors ${cap.isLocked ? 'bg-slate-50/50' : ''}`}>
                      <div className="border-r border-slate-50 p-6 flex items-start justify-center"><span className={`text-xs font-black transition-colors ${cap.isLocked ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-800'}`}>{displayHour}</span></div>
                      <div className="p-3 px-6 flex flex-wrap gap-4 relative">
                        {!cap.isLocked && (
                          <>
                            <div className="absolute right-6 top-6 flex gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                              {Array.from({ length: Math.min(cap.availableLeads, 8) }).map((_, i) => (<div key={i} className={`w-2.5 h-2.5 rounded-full ${viewMode === 'inspection' ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>))}
                            </div>
                            {hourEvents.length === 0 && (
                              <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Bookings</span>
                              </div>
                            )}
                            {hourEvents.map(event => (
                              <button key={event.id} onClick={() => setSelectedEvent(event)} className={`flex-1 min-w-[300px] max-w-[500px] p-6 rounded-3xl border text-left transition-all hover:scale-[1.02] shadow-sm ${event.type === 'emergency' ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{event.type} Dispatch</span>
                                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${event.status === 'dispatched' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'}`}>{event.status}</div>
                                </div>
                                <p className="font-black text-sm mb-3">{event.title}</p>
                                <div className="flex items-center gap-6 opacity-60">
                                   <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"><MapPin size={10} /> {(event.location || '').split(',')[0]}</div>
                                   <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"><Users size={10} /> {event.assignedTechnicianIds?.length || 0} Techs</div>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                        {cap.isLocked && (
                          <div className="flex-1 flex items-center justify-center">
                            <Lock size={16} className="text-slate-200 mr-2" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Booking Restricted</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {viewType === 'week' && (
             <div className="flex flex-col h-full">
               <div className="grid grid-cols-[120px_repeat(7,1fr)] border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                 <div className="p-4 border-r border-slate-100 flex items-center justify-center"><Clock size={16} className="text-slate-400" /></div>
                 {weekDays.map((day, i) => (
                   <div key={i} className={`p-4 text-center border-r border-slate-100 last:border-r-0 ${day.toDateString() === new Date().toDateString() ? 'bg-blue-50/50' : ''}`}>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                     <p className={`text-sm font-black mt-1 ${day.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-slate-800'}`}>{day.getDate()}</p>
                   </div>
                 ))}
               </div>
               <div className="flex-1 overflow-y-auto scrollbar-hide">
                 {hoursList.map(hour => (
                   <div key={hour} className="grid grid-cols-[120px_repeat(7,1fr)] border-b border-slate-50 min-h-[80px]">
                     <div className="border-r border-slate-50 p-4 flex items-center justify-center bg-slate-50/20">
                       <span className="text-[10px] font-black text-slate-400">
                         {hour > 12 ? `${hour - 12} PM` : `${hour} ${hour === 12 ? 'PM' : 'AM'}`}
                       </span>
                     </div>
                     {weekDays.map((day, i) => {
                       const hourEvents = filteredEvents.filter(e => {
                         const d = new Date(e.startTime);
                         return d.toDateString() === day.toDateString() && d.getHours() === hour;
                       });
                       const cap = getCapacityDetails(day, hour);
                       return (
                         <div key={i} className={`p-1 border-r border-slate-50 last:border-r-0 relative group ${cap.isLocked ? 'bg-slate-50/30' : 'hover:bg-slate-50/50 transition-colors'}`}>
                           {hourEvents.map(event => (
                             <button 
                               key={event.id} 
                               onClick={() => setSelectedEvent(event)}
                               className={`w-full mb-1 p-2 rounded-xl border text-left text-[9px] font-black uppercase transition-all hover:scale-[1.02] shadow-sm ${
                                 event.type === 'emergency' ? 'bg-blue-600 text-white border-blue-500' : 'bg-emerald-600 text-white border-emerald-500'
                               }`}
                             >
                               <p className="truncate">{event.title.split(':')[1] || event.title}</p>
                             </button>
                           ))}
                           {!cap.isLocked && hourEvents.length === 0 && (
                              <button onClick={() => { setNewJob({...newJob, id: null, date: day, time: `${hour.toString().padStart(2, '0')}:00`, techIds: [], contactId: '', title: '', lossType: ''}); setIsBooking(true); }} className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                 <Plus size={14} className="text-blue-600" />
                              </button>
                           )}
                         </div>
                       );
                     })}
                   </div>
                 ))}
               </div>
             </div>
          )}
          
          {viewType === 'month' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto scrollbar-hide">
                {monthViewDays.map((d, i) => {
                  const dayEvents = filteredEvents.filter(e => new Date(e.startTime).toDateString() === d.date.toDateString());
                  const isToday = d.date.toDateString() === new Date().toDateString();
                  const cap = getCapacityDetails(d.date);
                  
                  return (
                    <div key={i} className={`min-h-[120px] p-3 border-r border-b border-slate-50 last:border-r-0 flex flex-col gap-2 transition-colors ${d.current ? 'bg-white' : 'bg-slate-50/50'} ${isToday ? 'bg-blue-50/20' : ''}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-black ${d.current ? (isToday ? 'text-blue-600 bg-blue-100 h-6 w-6 rounded-full flex items-center justify-center' : 'text-slate-800') : 'text-slate-300'}`}>{d.day}</span>
                        {d.current && cap.availableLeads > 0 && (
                          <div className="flex gap-0.5">
                             {Array.from({ length: Math.min(cap.availableLeads, 3) }).map((_, i) => (
                               <div key={i} className={`w-1 h-1 rounded-full ${viewMode === 'inspection' ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                             ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 overflow-y-auto scrollbar-hide">
                        {dayEvents.slice(0, 4).map(event => (
                          <button 
                            key={event.id} 
                            onClick={() => setSelectedEvent(event)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase truncate text-left border ${
                              event.type === 'emergency' ? 'bg-blue-600 text-white border-blue-500' : 'bg-emerald-600 text-white border-emerald-500'
                            }`}
                          >
                            {event.title.split(':')[1] || event.title}
                          </button>
                        ))}
                        {dayEvents.length > 4 && (
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">+{dayEvents.length - 4} More</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0f172a] w-full max-w-[500px] rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800 text-white flex flex-col">
            <div className={`px-8 py-4 flex items-center justify-between ${selectedEvent.type === 'emergency' ? 'bg-blue-600/10 text-blue-400' : 'bg-emerald-600/10 text-emerald-400'}`}>
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-md ${selectedEvent.type === 'emergency' ? 'bg-blue-600' : 'bg-emerald-600'} text-white`}>
                  {selectedEvent.type === 'emergency' ? <ShieldCheck size={14} /> : <CheckCircle2 size={14} />}
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  {selectedEvent.type === 'emergency' ? 'Emergency Assignment' : 'Inspection Assignment'}
                </span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h2 className="text-3xl font-black tracking-tight leading-tight flex-1">{selectedJob.title}</h2>
                  <button 
                    onClick={() => handleEditEvent(selectedEvent)}
                    className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-slate-300"
                    title="Edit Appointment"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
                <div className="flex flex-col gap-3 text-slate-400">
                  <div className="flex items-center gap-2"><Clock size={16} /><span className="text-xs font-bold uppercase tracking-widest">{new Date(selectedEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {selectedEvent.status}</span></div>
                  <div className="flex items-center gap-2"><MapPin size={16} /><span className="text-xs font-bold uppercase tracking-widest">{selectedEvent.location}</span></div>
                </div>
              </div>
              <div className="space-y-6">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Squad Assembly</span>
                <div className="space-y-3 max-h-[240px] overflow-y-auto scrollbar-hide">
                  {technicians.filter(t => selectedEvent.assignedTechnicianIds.includes(t.id)).map((tech) => (
                    <div key={tech.id} className="flex items-center gap-4 p-5 rounded-[1.8rem] border bg-blue-600/10 border-blue-500/30">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-lg bg-blue-600 text-white">
                        {tech.name?.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{tech.name}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{tech.role}</p>
                      </div>
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg"><Check size={16} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">Close Briefing</button>
            </div>
          </div>
        </div>
      )}

      {isBooking && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 my-auto">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Briefcase size={24} /></div>
                <h3 className="text-xl font-black uppercase tracking-tight">{newJob.id ? 'Edit Appointment' : 'Manual Job Entry'}</h3>
              </div>
              <button onClick={() => setIsBooking(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <form onSubmit={handleCreateJob} className="p-10 space-y-8 overflow-y-auto scrollbar-hide max-h-[75vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="col-span-2 relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Link CRM Contact <span className="text-red-500">*</span></label>
                  <div 
                    className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isContactPickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`}
                    onClick={() => { setIsContactPickerOpen(!isContactPickerOpen); setIsDatePickerOpen(false); setIsTimePickerOpen(false); }}
                  >
                    <User size={16} className={`mr-4 transition-colors ${isContactPickerOpen ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold ${newJob.contactId ? 'text-slate-800' : 'text-slate-300'}`}>
                      {newJob.contactId ? contacts.find(c => c.id === newJob.contactId)?.name : 'Select Client from CRM...'}
                    </span>
                  </div>
                  {isContactPickerOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-4 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[400px]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Search CRM..." 
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/10"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setIsAddingContact(true); }}
                          className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
                          title="Create New Contact"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                      <div className="overflow-y-auto scrollbar-hide space-y-1">
                        {filteredContactsList.map(c => (
                          <button 
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setNewJob({ ...newJob, contactId: c.id, location: c.address });
                              setIsContactPickerOpen(false);
                              setContactSearch('');
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all text-left"
                          >
                            <div>
                              <p className="text-xs font-black text-slate-800">{c.name}</p>
                              <p className="text-[9px] font-bold text-slate-400">{c.phone}</p>
                            </div>
                            <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">{c.type}</span>
                          </button>
                        ))}
                        {filteredContactsList.length === 0 && (
                           <div className="p-6 text-center text-slate-300 text-[10px] font-black uppercase">No contacts found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Internal Job Title (Optional)</label>
                  <input type="text" placeholder="e.g. Assessment and Extraction" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Appointment Type</label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    <button type="button" onClick={() => setNewJob({...newJob, type: 'inspection', techIds: []})} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newJob.type === 'inspection' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}><ShieldCheck size={16} /> Inspection</button>
                    <button type="button" onClick={() => setNewJob({...newJob, type: 'emergency', techIds: []})} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newJob.type === 'emergency' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}><AlertCircle size={16} /> Emergency</button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Loss Category</label>
                  <select value={newJob.lossType} onChange={e => setNewJob({...newJob, lossType: e.target.value})} className="w-full h-[52px] px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer">
                    <option value="">Select Category...</option>
                    <option value="Mold Assessment">Mold Assessment</option>
                    <option value="Water Damage Assessment">Water Damage Assessment</option>
                    <option value="Fire Damage Assessment">Fire Damage Assessment</option>
                    <option value="Biohazard Assessment">Biohazard Assessment</option>
                    <option value="Storm Damage Assessment">Storm Damage Assessment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Scheduled Date</label>
                  <div className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isDatePickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`} onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); setIsTimePickerOpen(false); setIsContactPickerOpen(false); }}>
                    <CalendarDays size={16} className={`mr-4 transition-colors ${isDatePickerOpen ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold ${isDatePickerOpen ? 'text-blue-600' : 'text-slate-800'}`}>{newJob.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {isDatePickerOpen && <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-6 animate-in zoom-in-95 duration-200 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <button type="button" onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() - 1))} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><ChevronLeft size={20} /></button>
                      <span className="text-sm font-black text-slate-800 uppercase tracking-widest">{pickerViewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                      <button type="button" onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() + 1))} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><ChevronRight size={20} /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-2">{d}</div>
                      ))}
                      {(() => {
                        const year = pickerViewDate.getFullYear();
                        const month = pickerViewDate.getMonth();
                        const firstDay = new Date(year, month, 1).getDay();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const prevMonthDays = new Date(year, month, 0).getDate();
                        const days = [];
                        for (let i = firstDay - 1; i >= 0; i--) { days.push({ day: prevMonthDays - i, current: false, date: new Date(year, month - 1, prevMonthDays - i) }); }
                        for (let i = 1; i <= daysInMonth; i++) { days.push({ day: i, current: true, date: new Date(year, month, i) }); }
                        const remaining = 42 - days.length;
                        for (let i = 1; i <= remaining; i++) { days.push({ day: i, current: false, date: new Date(year, month + 1, i) }); }
                        return days.map((d, i) => {
                          const past = d.date < new Date(new Date().setHours(0,0,0,0));
                          const sel = d.date.toDateString() === newJob.date.toDateString();
                          return (
                            <button key={i} type="button" disabled={past} onClick={() => { setNewJob({ ...newJob, date: d.date }); setIsDatePickerOpen(false); }} className={`h-10 w-10 flex items-center justify-center rounded-full text-xs font-bold transition-all ${sel ? 'bg-blue-600 text-white shadow-lg' : past ? 'text-slate-200 cursor-not-allowed opacity-40' : d.current ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-50'}`}>{d.day}</button>
                          );
                        });
                      })()}
                    </div>
                  </div>}
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Scheduled Time</label>
                  <div className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isTimePickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`} onClick={() => { setIsTimePickerOpen(!isTimePickerOpen); setIsDatePickerOpen(false); setIsContactPickerOpen(false); }}>
                    <Clock size={16} className={`mr-4 transition-colors ${isTimePickerOpen ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold ${isTimePickerOpen ? 'text-blue-600' : 'text-slate-800'}`}>
                      {(() => {
                          const [h_str, m_str] = newJob.time.split(':');
                          const h = parseInt(h_str);
                          const m = parseInt(m_str);
                          const p = h >= 12 ? 'PM' : 'AM';
                          return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${p}`;
                      })()}
                    </span>
                  </div>
                  {isTimePickerOpen && (
                    <div className="absolute top-full left-0 mt-2 w-[280px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-6 animate-in zoom-in-95 duration-200 overflow-hidden">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Set Execution Time</p>
                      <div className="flex items-center justify-center gap-4 mb-8">
                        {(() => {
                          const [h, m] = newJob.time.split(':').map(Number);
                          const period = h >= 12 ? 'PM' : 'AM';
                          const displayH = h % 12 || 12;
                          const updateTime = (newH: number, newM: number, newPeriod: 'AM' | 'PM') => {
                            let finalH = newH;
                            if (newPeriod === 'PM' && finalH !== 12) finalH += 12;
                            if (newPeriod === 'AM' && finalH === 12) finalH = 0;
                            setNewJob({ ...newJob, time: `${finalH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}` });
                          };
                          return (
                            <>
                              <div className="flex flex-col items-center gap-2">
                                <button type="button" onClick={() => updateTime(displayH === 12 ? 1 : displayH + 1, m, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronUp size={20} /></button>
                                <span className="text-3xl font-black text-slate-800">{displayH}</span>
                                <button type="button" onClick={() => updateTime(displayH === 1 ? 12 : displayH - 1, m, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronDown size={20} /></button>
                              </div>
                              <span className="text-3xl font-black text-slate-200 mb-1">:</span>
                              <div className="flex flex-col items-center gap-2">
                                <button type="button" onClick={() => updateTime(displayH, (m + 5) % 60, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronUp size={20} /></button>
                                <span className="text-3xl font-black text-slate-800">{m.toString().padStart(2, '0')}</span>
                                <button type="button" onClick={() => updateTime(displayH, (m - 5 + 60) % 60, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronDown size={20} /></button>
                              </div>
                              <div className="flex flex-col gap-2 ml-2">
                                <button type="button" onClick={() => updateTime(displayH, m, 'AM')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${period === 'AM' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>AM</button>
                                <button type="button" onClick={() => updateTime(displayH, m, 'PM')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${period === 'PM' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>PM</button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <button type="button" onClick={() => setIsTimePickerOpen(false)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all w-full">Confirm Time</button>
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Service Address</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" required placeholder="Street Address" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" />
                  </div>
                </div>

                <div className="col-span-2 space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign Dispatch Squad</label>
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                      <Users size={12} /> {candidateSquad.length} Available On-Duty
                    </span>
                  </div>
                  
                  {candidateSquad.length === 0 ? (
                    <div className="p-10 bg-slate-50 border border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                       <AlertTriangle size={24} className="text-amber-400 mb-3" />
                       <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">No technicians are currently on-duty <br/> for this specific slot.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto scrollbar-hide pr-1">
                      {candidateSquad.map(tech => {
                        const conflict = getTechConflict(tech.id, newJob.date, newJob.time, newJob.id);
                        const isSelected = newJob.techIds.includes(tech.id);
                        return (
                          <button key={tech.id} type="button" onClick={() => {
                            const ids = [...newJob.techIds];
                            const idx = ids.indexOf(tech.id);
                            if (idx > -1) ids.splice(idx, 1);
                            else ids.push(tech.id);
                            setNewJob({...newJob, techIds: ids});
                          }} className={`flex flex-col p-4 rounded-2xl border transition-all text-left relative overflow-hidden group/tech ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : conflict ? 'bg-slate-50 border-slate-100 opacity-60 grayscale' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                            <div className="flex items-center gap-3 w-full">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm transition-colors ${isSelected ? 'bg-white/20' : 'bg-slate-100 group-hover/tech:bg-blue-50'}`}>{tech.name?.split(' ').map(n => n[0]).join('')}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black truncate">{tech.name}</p>
                                <p className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{tech.role}</p>
                              </div>
                              {isSelected && <Check size={14} />}
                            </div>
                            {conflict && !isSelected && (
                              <div className="mt-2 flex items-center gap-1.5 text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md w-fit"><CalendarRange size={10} /> Conflict: {conflict.title.split(':')[0]}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/90 backdrop-blur-md pb-2">
                <button type="button" onClick={() => setIsBooking(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" disabled={isSaving || !newJob.contactId} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{isSaving ? 'Syncing...' : (newJob.id ? 'Save Changes' : 'Complete Dispatch Entry')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingContact && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 my-auto">
             <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24} /></div>
                  <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Add New CRM Contact</h3>
                </div>
                <button onClick={() => setIsAddingContact(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
             </div>
             
             <form onSubmit={handleCreateContact} className="p-10 space-y-6 overflow-y-auto scrollbar-hide max-h-[75vh]">
                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                      <input 
                        type="text" 
                        required 
                        value={newContactForm.name} 
                        onChange={e => setNewContactForm({...newContactForm, name: e.target.value})} 
                        onKeyDown={(e) => e.stopPropagation()} 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all" 
                        placeholder="John Doe" 
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Phone</label>
                        <input 
                          type="text" 
                          required 
                          value={newContactForm.phone} 
                          onChange={e => setNewContactForm({...newContactForm, phone: formatPhoneNumberInput(e.target.value)})} 
                          onKeyDown={(e) => e.stopPropagation()} 
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all" 
                          placeholder="(555) 555-5555" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email</label>
                        <input 
                          type="email" 
                          required 
                          value={newContactForm.email} 
                          onChange={e => setNewContactForm({...newContactForm, email: e.target.value})} 
                          onKeyDown={(e) => e.stopPropagation()} 
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all" 
                          placeholder="john@example.com" 
                        />
                      </div>
                   </div>

                   <div className="pt-2 border-t border-slate-100">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2"><MapPin size={12} /> Service Location</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="col-span-2">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Street Address</label>
                            <input 
                              type="text" 
                              required 
                              value={newContactAddr.street} 
                              onChange={e => setNewContactAddr({...newContactAddr, street: e.target.value})} 
                              onKeyDown={(e) => e.stopPropagation()} 
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/10" 
                              placeholder="123 Main St" 
                            />
                         </div>
                         <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">City</label>
                            <input 
                              type="text" 
                              required 
                              value={newContactAddr.city} 
                              onChange={e => setNewContactAddr({...newContactAddr, city: e.target.value})} 
                              onKeyDown={(e) => e.stopPropagation()} 
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/10" 
                              placeholder="City" 
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                            <div>
                               <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">State</label>
                               <select 
                                 value={newContactAddr.state} 
                                 onChange={e => setNewContactAddr({...newContactAddr, state: e.target.value})} 
                                 onKeyDown={(e) => e.stopPropagation()}
                                 className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                               >
                                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                               </select>
                            </div>
                            <div>
                               <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Zip</label>
                               <input 
                                 type="text" 
                                 required 
                                 value={newContactAddr.zip} 
                                 onChange={e => setNewContactAddr({...newContactAddr, zip: e.target.value.replace(/\D/g, '').slice(0, 5)})} 
                                 onKeyDown={(e) => e.stopPropagation()} 
                                 className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/10" 
                                 placeholder="00000" 
                               />
                            </div>
                         </div>
                      </div>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Relationship Type</label>
                      <select 
                        value={newContactForm.type} 
                        onChange={e => setNewContactForm({...newContactForm, type: e.target.value as ContactType})} 
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full h-[52px] px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer"
                      >
                        {Object.values(ContactType).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsAddingContact(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={isSaving} 
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {isSaving ? 'Saving...' : 'Create & Link Contact'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedCalendar;
