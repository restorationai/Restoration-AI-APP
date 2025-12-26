
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
  Save,
  CheckCircle2,
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
  Edit2,
  Info,
  Building,
  Smartphone,
  Globe,
  Trash2,
  ExternalLink,
  Edit3,
  Phone,
  Bot
} from 'lucide-react';
import { CalendarEvent, AppointmentType, Technician, Role, Job, Contact, ContactType } from '../types';
import { fetchCalendarEvents, syncCalendarEventToSupabase, fetchTechniciansFromSupabase, fetchCompanySettings, syncContactToSupabase, fetchContactsFromSupabase, fetchJobsFromSupabase, getCurrentUser, supabase } from '../lib/supabase';
import { formatPhoneNumberInput, toDisplay } from '../utils/phoneUtils.ts';
import ManageAccount from './ManageAccount.tsx';

type CalendarMode = 'all' | 'emergency' | 'inspection';
type ViewType = 'day' | 'week' | 'month';

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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyConfig, setCompanyConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBusinessHours, setShowBusinessHours] = useState(false);
  const [now, setNow] = useState(new Date());

  // Form States
  const [newJob, setNewJob] = useState({
    id: null as string | null,
    title: '',
    type: 'inspection' as AppointmentType,
    contactId: '',
    jobId: '',
    location: '',
    date: new Date(),
    time: `${new Date().getHours().toString().padStart(2, '0')}:00`,
    lossType: '',
    customLossType: '',
    techIds: [] as string[]
  });

  const [newContactForm, setNewContactForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    type: ContactType.HOMEOWNER,
    street: '',
    city: '',
    state: 'CA',
    postalCode: '',
    country: 'USA'
  });

  // UI States
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [pickerViewDate, setPickerViewDate] = useState(new Date());

  const loadData = async () => {
    try {
      setIsLoading(true);
      const userData = await getCurrentUser();
      const cid = userData?.profile?.company_id;
      if (cid) {
        setCompanyId(cid);
        const [fetchedEvents, fetchedTechs, fetchedConfig, fetchedContacts, fetchedJobs] = await Promise.all([
          fetchCalendarEvents(cid),
          fetchTechniciansFromSupabase(cid),
          fetchCompanySettings(cid),
          fetchContactsFromSupabase(cid),
          fetchJobsFromSupabase(cid)
        ]);
        
        setEvents(fetchedEvents);
        setTechnicians(fetchedTechs);
        setContacts(fetchedContacts);
        setJobs(fetchedJobs);
        if (fetchedConfig) setCompanyConfig(fetchedConfig);
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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

  const isCompanyOpen = (date: Date, hour: number) => {
    // Emergency is always bookable regardless of business hours (staff dependent)
    if (viewMode === 'emergency') return true;
    
    if (!companyConfig?.inspectionSchedule) return true;
    
    const dayName = getDayName(date);
    const daySched = companyConfig.inspectionSchedule.find((s: any) => s.day === dayName);
    
    if (!daySched || !daySched.enabled) return false;
    
    const totalMinutes = hour * 60;
    const startMinutes = parseTimeValue(daySched.start);
    const endMinutes = parseTimeValue(daySched.end, true);
    
    if (startMinutes === null || endMinutes === null) return false;
    return totalMinutes >= startMinutes && totalMinutes < endMinutes;
  };

  const getTechConflict = (techId: string, bookingDate: Date, bookingTime: string, currentEventId: string | null = null) => {
    const [h, m] = bookingTime.split(':').map(Number);
    const start = new Date(bookingDate);
    start.setHours(h, m, 0, 0);
    
    const duration = companyConfig?.defaultInspectionDuration || 120;
    const buffer = companyConfig?.appointmentBufferTime || 30;
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
    const noticeLimit = new Date(now.getTime() + (companyConfig?.minimumSchedulingNotice || 4) * 60 * 60 * 1000);
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

    // Check company hours
    const isCorpOpen = hour !== undefined ? isCompanyOpen(date, hour) : true;

    return {
      totalOnDuty: onDutyTechs.length,
      availableLeads: Math.max(0, availableLeads),
      isLocked: hour !== undefined ? isSlotInNoticeWindow(date, hour) : false,
      isOutsideCorpHours: !isCorpOpen
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
  }, [technicians, newJob.date, newJob.time, newJob.type, viewMode]);

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
    if (!companyId) return;

    setIsSaving(true);
    try {
      const d = new Date(newJob.date);
      const [h, m] = newJob.time.split(':').map(Number);
      d.setHours(h, m, 0, 0);

      const duration = companyConfig?.defaultInspectionDuration || 120;
      const end = new Date(d.getTime() + duration * 60 * 1000);
      const finalLossType = newJob.lossType === 'Other' ? (newJob.customLossType || 'Other') : newJob.lossType;
      const contact = contacts.find(c => c.id === newJob.contactId);

      let finalTechIds = [...newJob.techIds];
      if (finalTechIds.length === 0 && candidateSquad.length > 0) {
        const sortedSquad = [...candidateSquad].sort((a, b) => {
          const aPri = newJob.type === 'emergency' ? a.emergencyPriorityNumber : a.inspectionPriorityNumber;
          const bPri = newJob.type === 'emergency' ? b.emergencyPriorityNumber : b.inspectionPriorityNumber;
          return aPri - bPri;
        });
        const bestTech = sortedSquad.find(t => !getTechConflict(t.id, newJob.date, newJob.time, newJob.id));
        if (bestTech) finalTechIds = [bestTech.id];
      }

      const updatedEvent: CalendarEvent = {
        id: newJob.id || generateUUID(),
        type: newJob.type,
        title: newJob.title || `${finalLossType || 'General'}: ${contact?.name || 'Manual Entry'}`,
        startTime: d.toISOString(),
        endTime: end.toISOString(),
        contactId: newJob.contactId,
        jobId: newJob.jobId,
        assignedTechnicianIds: finalTechIds,
        status: 'pending',
        location: newJob.location || 'Unknown Location',
        lossType: finalLossType,
        agentPhone1: companyConfig?.agentPhone1 || '' // Auto-stamp with company agent line
      };

      await syncCalendarEventToSupabase(updatedEvent, companyId);
      
      // Update local state
      if (newJob.id) {
        setEvents(prev => prev.map(ev => ev.id === newJob.id ? updatedEvent : ev));
      } else {
        setEvents(prev => [...prev, updatedEvent]);
      }

      setIsBooking(false);
      resetBookingForm();
      setSelectedDate(d);
    } catch (err: any) {
      alert(`Error saving appointment: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  const resetBookingForm = () => {
    setNewJob({
      id: null,
      title: '',
      type: 'inspection',
      contactId: '',
      jobId: '',
      location: '',
      date: new Date(),
      time: `${new Date().getHours().toString().padStart(2, '0')}:00`,
      lossType: '',
      customLossType: '',
      techIds: []
    });
  };

  const handleEditAppointment = () => {
    if (!selectedEvent) return;
    const d = new Date(selectedEvent.startTime);
    setNewJob({
      id: selectedEvent.id,
      title: selectedEvent.title,
      type: selectedEvent.type,
      contactId: selectedEvent.contactId,
      jobId: selectedEvent.jobId || '',
      location: selectedEvent.location,
      date: d,
      time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      lossType: selectedEvent.lossType || '',
      customLossType: '',
      techIds: selectedEvent.assignedTechnicianIds
    });
    setSelectedEvent(null);
    setIsBooking(true);
  };

  const handleDeleteAppointment = async () => {
    if (!selectedEvent || !companyId) return;
    if (!window.confirm("Are you sure you want to permanently delete this appointment? This cannot be undone.")) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', selectedEvent.id);
      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      setSelectedEvent(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setIsSaving(true);
    try {
      const fullAddress = `${newContactForm.street}, ${newContactForm.city}, ${newContactForm.state} ${newContactForm.postalCode}`.replace(/^, /, '');
      const fullName = `${newContactForm.firstName || ''} ${newContactForm.lastName || ''}`.trim();
      const newContact: Contact = {
        id: `con-${Date.now()}`,
        name: fullName || 'Unknown',
        firstName: newContactForm.firstName,
        lastName: newContactForm.lastName,
        phone: newContactForm.phone,
        email: newContactForm.email,
        address: fullAddress,
        street: newContactForm.street,
        city: newContactForm.city,
        state: newContactForm.state,
        postalCode: newContactForm.postalCode,
        country: newContactForm.country || 'USA',
        tags: ['New Lead', 'Manual Entry'],
        type: newContactForm.type,
        pipelineStage: 'Inbound',
        lastActivity: 'Just created',
        customFields: {}
      };
      await syncContactToSupabase(newContact, companyId);
      setContacts(prev => [newContact, ...prev]);
      setNewJob(prev => ({ ...prev, contactId: newContact.id, location: fullAddress }));
      setIsAddingContact(false);
      setNewContactForm({ firstName: '', lastName: '', phone: '', email: '', type: ContactType.HOMEOWNER, street: '', city: '', state: 'CA', postalCode: '', country: 'USA' });
      setIsContactPickerOpen(false);
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const filteredContactsList = useMemo(() => {
    return contacts.filter(c => 
      (c.type !== ContactType.PROPERTY_MANAGER && c.type !== ContactType.STAFF) &&
      (c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch))
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
  for (let i = monthFirstDay - 1; i >= 0; i--) monthViewDays.push({ day: monthPrevDays - i, current: false, date: new Date(monthYear, monthMonth - 1, monthPrevDays - i) });
  for (let i = 1; i <= monthDaysIn; i++) monthViewDays.push({ day: i, current: true, date: new Date(monthYear, monthMonth, i) });
  const monthRemaining = 42 - monthViewDays.length;
  for (let i = 1; i <= monthRemaining; i++) monthViewDays.push({ day: i, current: false, date: new Date(monthYear, monthMonth + 1, i) });

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" /><p className="font-black text-xs uppercase tracking-[0.3em]">Sarah AI Neural Link...</p></div>;

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
          <button onClick={() => setShowBusinessHours(true)} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm"><Clock size={16} className="text-blue-600" /> Business Hours</button>
          <button onClick={() => { resetBookingForm(); setIsBooking(true); }} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"><Plus size={16} /> Book Job</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-1">
          {viewType === 'day' && (
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-[120px_1fr] border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                <div className="p-4 flex items-center justify-center border-r border-slate-100"><Clock size={16} className="text-slate-400" /></div>
                <div className="p-4 px-8 flex items-center justify-between">
                   <div className="flex items-center gap-3"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Capacity Slots</span></div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {hoursList.map((hour) => {
                  // Filter events for this specific hour row
                  const hourEvents = filteredEvents.filter(e => {
                    const d = new Date(e.startTime);
                    return d.toDateString() === selectedDate.toDateString() && d.getHours() === hour;
                  });
                  const cap = getCapacityDetails(selectedDate, hour);
                  const displayHour = hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 ${hour === 12 ? 'PM' : 'AM'}`;
                  
                  return (
                    <div key={hour} className={`grid grid-cols-[120px_1fr] border-b border-slate-50 min-h-[120px] group transition-colors ${(cap.isLocked || cap.isOutsideCorpHours) ? 'bg-slate-50/20' : ''}`}>
                      <div className="border-r border-slate-50 p-6 flex items-start justify-center"><span className={`text-xs font-black transition-colors ${cap.isLocked || cap.isOutsideCorpHours ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-800'}`}>{displayHour}</span></div>
                      <div className="p-4 px-8 flex flex-wrap gap-4 relative">
                        {/* Always Render Existing Appointments */}
                        {hourEvents.map(event => (
                          <button key={event.id} onClick={() => setSelectedEvent(event)} className={`flex-1 min-w-[320px] max-w-[500px] p-6 rounded-[2rem] border text-left transition-all hover:scale-[1.02] shadow-sm z-20 ${event.type === 'emergency' ? 'bg-blue-600 border-blue-500 text-white shadow-blue-600/20' : 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-600/20'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{event.type} Dispatch</span>
                              <div className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded text-[8px] font-black uppercase tracking-widest">{event.status}</div>
                            </div>
                            <p className="font-black text-sm mb-3">{event.title}</p>
                            <div className="flex items-center gap-6 opacity-70">
                               <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"><MapPin size={10} /> {(event.location || '').split(',')[0]}</div>
                               <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"><Users size={10} /> {event.assignedTechnicianIds?.length || 0} Techs</div>
                            </div>
                          </button>
                        ))}

                        {/* Rendering Availability Button (unless locked or outside hours) */}
                        {!cap.isLocked && !cap.isOutsideCorpHours && (
                          <button 
                            onClick={() => { 
                              resetBookingForm();
                              setNewJob(prev => ({
                                ...prev,
                                date: selectedDate,
                                time: `${hour.toString().padStart(2, '0')}:00`
                              }));
                              setIsBooking(true);
                            }}
                            className={`flex-1 min-w-[200px] flex items-center justify-center transition-opacity border-2 border-dashed border-slate-100 rounded-[2rem] hover:bg-blue-50 hover:border-blue-200 ${hourEvents.length > 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
                          >
                             <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2"><Plus size={14} /> Book Slot ({cap.availableLeads} Ready)</span>
                          </button>
                        )}
                        
                        {(cap.isLocked || cap.isOutsideCorpHours) && hourEvents.length === 0 && (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-50 rounded-[2rem]">
                            {cap.isOutsideCorpHours ? <Clock size={16} className="text-slate-200 mr-3" /> : <Lock size={16} className="text-slate-200 mr-3" />}
                            <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">{cap.isOutsideCorpHours ? 'After Business Hours' : 'Restricted Window'}</span>
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
                         <div key={i} className={`p-1 border-r border-slate-50 last:border-r-0 relative group ${cap.isLocked || cap.isOutsideCorpHours ? 'bg-slate-50/30' : 'hover:bg-slate-50/50 transition-colors'}`}>
                           {hourEvents.map(event => (
                             <button key={event.id} onClick={() => setSelectedEvent(event)} className={`w-full mb-1 p-2 rounded-xl border text-left text-[9px] font-black uppercase transition-all hover:scale-[1.02] shadow-sm ${event.type === 'emergency' ? 'bg-blue-600 text-white border-blue-500' : 'bg-emerald-600 text-white border-emerald-500'}`}>
                               <p className="truncate">{event.title.split(':')[1] || event.title}</p>
                             </button>
                           ))}
                           {!cap.isLocked && !cap.isOutsideCorpHours && (
                              <button onClick={() => { 
                                resetBookingForm();
                                setNewJob(prev => ({...prev, date: day, time: `${hour.toString().padStart(2, '0')}:00`}));
                                setIsBooking(true);
                              }} className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
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
                  return (
                    <div key={i} className={`min-h-[120px] p-3 border-r border-b border-slate-50 last:border-r-0 flex flex-col gap-2 transition-colors ${d.current ? 'bg-white' : 'bg-slate-50/50'} ${isToday ? 'bg-blue-50/20' : ''}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-black ${d.current ? (isToday ? 'text-blue-600 bg-blue-100 h-6 w-6 rounded-full flex items-center justify-center' : 'text-slate-800') : 'text-slate-300'}`}>{d.day}</span>
                      </div>
                      <div className="flex flex-col gap-1 overflow-y-auto scrollbar-hide">
                        {dayEvents.slice(0, 4).map(event => (
                          <button key={event.id} onClick={() => setSelectedEvent(event)} className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase truncate text-left border ${event.type === 'emergency' ? 'bg-blue-600 text-white border-blue-500' : 'bg-emerald-600 text-white border-emerald-500'}`}>
                            {event.title.split(':')[1] || event.title}
                          </button>
                        ))}
                        {dayEvents.length > 4 && <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center mt-1">+{dayEvents.length - 4} More</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Settings Modal (Shortcut) */}
      {showBusinessHours && companyConfig && (
        <ManageAccount 
          isOpen={true} 
          onClose={() => { setShowBusinessHours(false); loadData(); }} 
          companySettings={companyConfig} 
          onSettingsUpdate={setCompanyConfig}
        />
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
              <div className={`p-10 text-white flex justify-between items-start ${selectedEvent.type === 'emergency' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedEvent.type} File</div>
                       <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedEvent.status}</div>
                    </div>
                    <h3 className="text-3xl font-black tracking-tight leading-tight">{selectedEvent.title}</h3>
                    <div className="flex items-center gap-4 text-white/70">
                       <div className="flex items-center gap-2 text-xs font-bold"><CalendarIcon size={14} /> {new Date(selectedEvent.startTime).toLocaleDateString()}</div>
                       <div className="flex items-center gap-2 text-xs font-bold"><Clock size={14} /> {new Date(selectedEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
              </div>

              <div className="p-10 space-y-10 bg-slate-50/50 overflow-y-auto scrollbar-hide max-h-[60vh]">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Client</label>
                       <div className="flex items-center gap-4 bg-white p-5 rounded-[1.8rem] border border-slate-100 shadow-sm">
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400">{getInitials(contacts.find(c => c.id === selectedEvent.contactId)?.name || '??')}</div>
                          <div><p className="text-sm font-black text-slate-800">{contacts.find(c => c.id === selectedEvent.contactId)?.name || 'Manual Party'}</p><p className="text-[10px] font-bold text-slate-400">{contacts.find(c => c.id === selectedEvent.contactId)?.phone}</p></div>
                       </div>
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Address</label>
                       <div className="flex items-center gap-4 bg-white p-5 rounded-[1.8rem] border border-slate-100 shadow-sm">
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><MapPin size={18} /></div>
                          <p className="text-xs font-black text-slate-800 leading-snug">{selectedEvent.location}</p>
                       </div>
                    </div>
                 </div>

                 {(selectedEvent.jobId || selectedEvent.agentPhone1) && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {selectedEvent.jobId && (
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Project File</label>
                           <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-blue-50 shadow-sm">
                             <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner"><Briefcase size={20} /></div>
                             <div className="flex-1">
                               <p className="text-sm font-black text-slate-800">{jobs.find(j => j.id === selectedEvent.jobId)?.title || 'File Not Found'}</p>
                               <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{jobs.find(j => j.id === selectedEvent.jobId)?.stage || 'Inbound'}</p>
                             </div>
                           </div>
                        </div>
                      )}
                      {selectedEvent.agentPhone1 && (
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned AI Line</label>
                           <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-purple-50 shadow-sm">
                             <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shadow-inner"><Bot size={20} /></div>
                             <div className="flex-1">
                               <p className="text-sm font-black text-slate-800">{selectedEvent.agentPhone1}</p>
                               <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Sarah AI Secure Link</p>
                             </div>
                           </div>
                        </div>
                      )}
                   </div>
                 )}

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">Assigned Dispatch Squad</label>
                    <div className="flex flex-wrap gap-3">
                       {selectedEvent.assignedTechnicianIds.map(tid => {
                          const tech = technicians.find(t => t.id === tid);
                          return (
                            <div key={tid} className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                               <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-[10px]">{tech?.name?.split(' ').map(n => n[0]).join('') || '?'}</div>
                               <div><p className="text-xs font-black text-slate-800">{tech?.name || 'Unknown'}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{tech?.role}</p></div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
              </div>

              <div className="p-8 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
                 <button onClick={handleDeleteAppointment} className="flex items-center gap-2 text-red-500 font-black uppercase text-[10px] tracking-widest px-6 py-3 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={16} /> Delete Dispatch</button>
                 <div className="flex gap-4">
                   <button onClick={() => setSelectedEvent(null)} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Close</button>
                   <button onClick={handleEditAppointment} className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-black transition-all active:scale-95"><Edit3 size={16} /> Edit Details</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Booking Form Modal */}
      {isBooking && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 my-auto">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Briefcase size={24} /></div>
                <h3 className="text-xl font-black uppercase tracking-tight">{newJob.id ? 'Modify Dispatch Entry' : 'Manual Dispatch Entry'}</h3>
              </div>
              <button onClick={() => setIsBooking(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleCreateJob} className="p-10 space-y-8 overflow-y-auto scrollbar-hide max-h-[75vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2 relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Link CRM Owner <span className="text-red-500">*</span></label>
                  <div 
                    className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isContactPickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`}
                    onClick={() => { setIsContactPickerOpen(!isContactPickerOpen); setIsDatePickerOpen(false); setIsTimePickerOpen(false); }}
                  >
                    <User size={16} className={`mr-4 transition-colors ${isContactPickerOpen ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold ${newJob.contactId ? 'text-slate-800' : 'text-slate-300'}`}>
                      {newJob.contactId ? contacts.find(c => c.id === newJob.contactId)?.name : 'Select Primary Owner (Non-PM)...'}
                    </span>
                  </div>
                  {isContactPickerOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-4 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[400px]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="text" autoFocus placeholder="Search Owners..." value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/10" />
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsAddingContact(true); }} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"><UserPlus size={16} /></button>
                      </div>
                      <div className="overflow-y-auto scrollbar-hide space-y-1">
                        {filteredContactsList.map(c => (
                          <button key={c.id} type="button" onClick={() => { setNewJob({ ...newJob, contactId: c.id, location: c.address }); setIsContactPickerOpen(false); setContactSearch(''); }} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all text-left">
                            <div><p className="text-xs font-black text-slate-800">{c.name}</p><p className="text-[9px] font-bold text-slate-400">{c.phone}</p></div>
                            <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">{c.type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Link to Active Job (Optional)</label>
                  <select value={newJob.jobId} onChange={e => setNewJob({...newJob, jobId: e.target.value})} className="w-full h-[52px] px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer">
                    <option value="">Select Related Job...</option>
                    {jobs.filter(j => j.status === 'Open').map(j => (
                      <option key={j.id} value={j.id}>{j.title} ({j.lossType})</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Internal Job Title (Optional)</label><input type="text" placeholder="e.g. Assessment and Extraction" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all" /></div>
                
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Appointment Type</label><div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200"><button type="button" onClick={() => setNewJob({...newJob, type: 'inspection', techIds: []})} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newJob.type === 'inspection' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}><ShieldCheck size={16} /> Inspection</button><button type="button" onClick={() => setNewJob({...newJob, type: 'emergency', techIds: []})} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newJob.type === 'emergency' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}><AlertCircle size={16} /> Emergency</button></div></div>
                
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Loss Category</label><select value={newJob.lossType} onChange={e => setNewJob({...newJob, lossType: e.target.value})} className="w-full h-[52px] px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer"><option value="">Select Category...</option><option value="Mold Assessment">Mold Assessment</option><option value="Water Damage Assessment">Water Damage Assessment</option><option value="Fire Damage Assessment">Fire Damage Assessment</option><option value="Biohazard Assessment">Biohazard Assessment</option><option value="Storm Damage Assessment">Storm Damage Assessment</option><option value="Other">Other</option></select></div>
                
                <div className="relative"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Scheduled Date</label><div className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isDatePickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`} onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); setIsTimePickerOpen(false); setIsContactPickerOpen(false); }}><CalendarDays size={16} className={`mr-4 transition-colors ${isDatePickerOpen ? 'text-blue-600' : 'text-slate-400'}`} /><span className={`text-sm font-bold ${isDatePickerOpen ? 'text-blue-600' : 'text-slate-800'}`}>{newJob.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>{isDatePickerOpen && <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-6 animate-in zoom-in-95 duration-200 overflow-hidden"><div className="flex items-center justify-between mb-6"><button type="button" onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() - 1))} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><ChevronLeft size={20} /></button><span className="text-sm font-black text-slate-800 uppercase tracking-widest">{pickerViewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span><button type="button" onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() + 1))} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><ChevronRight size={20} /></button></div><div className="grid grid-cols-7 gap-1 mb-4">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (<div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-2">{d}</div>))}{(() => { const year = pickerViewDate.getFullYear(); const month = pickerViewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const prevMonthDays = new Date(year, month, 0).getDate(); const days = []; for (let i = firstDay - 1; i >= 0; i--) days.push({ day: prevMonthDays - i, current: false, date: new Date(year, month - 1, prevMonthDays - i) }); for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, current: true, date: new Date(year, month, i) }); const remaining = 42 - days.length; for (let i = 1; i <= remaining; i++) days.push({ day: i, current: false, date: new Date(year, month + 1, i) }); return days.map((d, i) => { const past = d.date < new Date(new Date().setHours(0,0,0,0)); const sel = d.date.toDateString() === newJob.date.toDateString(); return (<button key={i} type="button" disabled={past} onClick={() => { setNewJob({ ...newJob, date: d.date }); setIsDatePickerOpen(false); }} className={`h-10 w-10 flex items-center justify-center rounded-full text-xs font-bold transition-all ${sel ? 'bg-blue-600 text-white shadow-lg' : past ? 'text-slate-200 cursor-not-allowed opacity-40' : d.current ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-50'}`}>{d.day}</button>); }); })()}</div></div>}</div>
                
                <div className="relative"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Scheduled Time</label><div className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isTimePickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`} onClick={() => { setIsTimePickerOpen(!isTimePickerOpen); setIsDatePickerOpen(false); setIsContactPickerOpen(false); }}><Clock size={16} className={`mr-4 transition-colors ${isTimePickerOpen ? 'text-blue-600' : 'text-slate-400'}`} /><span className={`text-sm font-bold ${isTimePickerOpen ? 'text-blue-600' : 'text-slate-800'}`}>{(() => { const [h_str, m_str] = newJob.time.split(':'); const h = parseInt(h_str); const m = parseInt(m_str); const p = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${p}`; })()}</span></div>{isTimePickerOpen && <div className="absolute top-full left-0 mt-2 w-[280px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-6 animate-in zoom-in-95 duration-200 overflow-hidden"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Set Execution Time</p><div className="flex items-center justify-center gap-4 mb-8">{(() => { const [h, m] = newJob.time.split(':').map(Number); const period = h >= 12 ? 'PM' : 'AM'; const displayH = h % 12 || 12; const updateTime = (newH: number, newM: number, newPeriod: 'AM' | 'PM') => { let finalH = newH; if (newPeriod === 'PM' && finalH !== 12) finalH += 12; if (newPeriod === 'AM' && finalH === 12) finalH = 0; setNewJob({ ...newJob, time: `${finalH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}` }); }; return (<><div className="flex flex-col items-center gap-2"><button type="button" onClick={() => updateTime(displayH === 12 ? 1 : displayH + 1, m, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronUp size={20} /></button><span className="text-3xl font-black text-slate-800">{displayH}</span><button type="button" onClick={() => updateTime(displayH === 1 ? 12 : displayH - 1, m, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronDown size={20} /></button></div><span className="text-3xl font-black text-slate-200 mb-1">:</span><div className="flex flex-col items-center gap-2"><button type="button" onClick={() => updateTime(displayH, (m + 5) % 60, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronUp size={20} /></button><span className="text-3xl font-black text-slate-800">{m.toString().padStart(2, '0')}</span><button type="button" onClick={() => updateTime(displayH, (m - 5 + 60) % 60, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronDown size={20} /></button></div><div className="flex flex-col gap-2 ml-2"><button type="button" onClick={() => updateTime(displayH, m, 'AM')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${period === 'AM' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>AM</button><button type="button" onClick={() => updateTime(displayH, m, 'PM')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${period === 'PM' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>PM</button></div></>); })()}</div><button type="button" onClick={() => setIsTimePickerOpen(false)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all w-full">Confirm Time</button></div>}</div>
                
                <div className="col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Service Address (Street Only)</label><div className="relative"><MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" required placeholder="Street Address" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" /></div></div>
                
                <div className="col-span-2 space-y-4"><div className="flex items-center justify-between px-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign Dispatch Squad</label><span className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><Users size={12} /> {candidateSquad.length} Available On-Duty</span></div>{candidateSquad.length === 0 ? (<div className="p-10 bg-slate-50 border border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center"><AlertTriangle size={24} className="text-amber-400 mb-3" /><p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">No technicians are currently on-duty <br/> for this specific slot.</p></div>) : (<div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto scrollbar-hide pr-1">{candidateSquad.map(tech => { const conflict = getTechConflict(tech.id, newJob.date, newJob.time, newJob.id); const isSelected = newJob.techIds.includes(tech.id); return (<button key={tech.id} type="button" onClick={() => { const ids = [...newJob.techIds]; const idx = ids.indexOf(tech.id); if (idx > -1) ids.splice(idx, 1); else ids.push(tech.id); setNewJob({...newJob, techIds: ids}); }} className={`flex flex-col p-4 rounded-2xl border transition-all text-left relative overflow-hidden group/tech ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : conflict ? 'bg-slate-50 border-slate-100 opacity-60 grayscale' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'}`}><div className="flex items-center gap-3 w-full"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm transition-colors ${isSelected ? 'bg-white/20' : 'bg-slate-100 group-hover/tech:bg-blue-50'}`}>{tech.name?.split(' ').map(n => n[0]).join('')}</div><div className="flex-1 min-w-0"><p className="text-xs font-black truncate">{tech.name}</p><p className={`text-[8px] font-black uppercase tracking-widest ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{tech.role}</p></div>{isSelected && <Check size={14} />}</div>{conflict && !isSelected && (<div className="mt-2 flex items-center gap-1.5 text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md w-fit"><CalendarRange size={10} /> Conflict: {conflict.title.split(':')[0]}</div>)}</button>); })}</div>)}{newJob.techIds.length === 0 && candidateSquad.length > 0 && (<div className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3"><Info size={14} className="text-blue-500" /><p className="text-[9px] font-bold text-blue-700 uppercase tracking-tight leading-none">Auto-assign logic active: The highest priority available technician will be linked upon confirmation.</p></div>)}</div>
              </div>
              <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/90 backdrop-blur-sm pb-2"><button type="button" onClick={() => setIsBooking(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button><button type="submit" disabled={isSaving || !newJob.contactId} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{isSaving ? 'Syncing...' : (newJob.id ? 'Update Appointment' : 'Complete Dispatch Entry')}</button></div>
            </form>
          </div>
        </div>
      )}

      {isAddingContact && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 my-auto">
             <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24} /></div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Quick CRM Add</h3>
                </div>
                <button onClick={() => setIsAddingContact(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
             </div>
             <form onSubmit={handleCreateContact} className="p-10 space-y-6 overflow-y-auto scrollbar-hide max-h-[75vh]">
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">First Name</label>
                      <input required type="text" value={newContactForm.firstName} onChange={e => setNewContactForm({...newContactForm, firstName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="John" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Last Name</label>
                      <input required type="text" value={newContactForm.lastName} onChange={e => setNewContactForm({...newContactForm, lastName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="Smith" />
                   </div>
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Phone</label>
                      <input required type="text" value={newContactForm.phone} onChange={e => setNewContactForm({...newContactForm, phone: formatPhoneNumberInput(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="(555) 555-5555" />
                   </div>
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email</label>
                      <input required type="email" value={newContactForm.email} onChange={e => setNewContactForm({...newContactForm, email: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="john@example.com" />
                   </div>
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Service Residence</label>
                   <input required type="text" placeholder="Street Address" value={newContactForm.street} onChange={e => setNewContactForm({...newContactForm, street: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none mb-3 focus:ring-2 focus:ring-blue-600/10" />
                   <div className="grid grid-cols-2 gap-4">
                      <input required type="text" placeholder="City" value={newContactForm.city} onChange={e => setNewContactForm({...newContactForm, city: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10" />
                      <input required type="text" placeholder="State (e.g. CA)" value={newContactForm.state} onChange={e => setNewContactForm({...newContactForm, state: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10" />
                      <input required type="text" placeholder="Postal Code" value={newContactForm.postalCode} onChange={e => setNewContactForm({...newContactForm, postalCode: e.target.value.replace(/\D/g,'')})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10" />
                      <div className="relative">
                        <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input type="text" placeholder="Country" value={newContactForm.country} onChange={e => setNewContactForm({...newContactForm, country: e.target.value})} className="w-full pl-11 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10" />
                      </div>
                   </div>
                </div>
                <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/90 backdrop-blur-sm pb-2">
                   <button type="button" onClick={() => setIsAddingContact(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                   <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95">
                     {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                     Finalize CRM Entry
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
