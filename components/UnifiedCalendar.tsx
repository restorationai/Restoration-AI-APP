
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { MOCK_CALENDAR_EVENTS, MOCK_TECHNICIANS, MOCK_CONTACTS, INITIAL_COMPANY_SETTINGS } from '../constants';
import { CalendarEvent, AppointmentType, Technician, Role, Status } from '../types';

type ViewType = 'day' | 'week' | 'month';
type CalendarMode = 'emergency' | 'inspection' | 'all';

const UnifiedCalendar: React.FC = () => {
  const [viewMode, setViewMode] = useState<CalendarMode>('all');
  const [viewType, setViewType] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(MOCK_CALENDAR_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [now, setNow] = useState(new Date());

  // Form State for Manual Booking
  const [newJob, setNewJob] = useState({
    title: '',
    type: 'inspection' as AppointmentType,
    contactId: '',
    location: '',
    city: '',
    zip: '',
    date: new Date(),
    time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
    lossType: 'Mold Assessment',
    customLossType: '',
    techIds: [] as string[]
  });

  // Picker states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hoursList = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

  const parseTimeValue = (timeStr: string, isEnd: boolean = false) => {
    if (!timeStr || timeStr === 'None') return null;
    const [time, period] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const val = h * 60 + (m || 0);
    if (isEnd && val === 0) return 1440;
    return val;
  };

  const isTechOnDuty = (tech: Technician, date: Date, hour: number) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const mode = viewMode === 'inspection' ? 'inspection' : 'emergency';
    const schedule = mode === 'emergency' ? tech.emergencySchedule : tech.inspectionSchedule;
    const daySched = schedule.find(s => s.day === dayName);

    if (!daySched || !daySched.enabled) return false;
    if (daySched.override === 'Force Active') return true;
    if (daySched.override === 'Force Off Duty') return false;
    if (daySched.is24Hours) return true;

    const slotMinutes = hour * 60;
    const startMinutes = parseTimeValue(daySched.start);
    const endMinutes = parseTimeValue(daySched.end, true);

    if (startMinutes === null || endMinutes === null) return false;
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  };

  const isSlotInNoticeWindow = (date: Date, hour: number) => {
    if (viewMode === 'emergency') return false;
    const slotTime = new Date(date);
    slotTime.setHours(hour, 0, 0, 0);
    const noticeLimit = new Date(now.getTime() + INITIAL_COMPANY_SETTINGS.minimumSchedulingNotice * 60 * 60 * 1000);
    return slotTime < noticeLimit;
  };

  const getCapacityDetails = (date: Date, hour?: number) => {
    const onDutyTechs = MOCK_TECHNICIANS.filter(t => {
      if (hour !== undefined) return isTechOnDuty(t, date, hour);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const mode = viewMode === 'inspection' ? 'inspection' : 'emergency';
      const sched = mode === 'emergency' ? t.emergencySchedule : t.inspectionSchedule;
      return sched.find(s => s.day === dayName)?.enabled;
    });

    const assignedCount = events.filter(e => {
      const start = new Date(e.startTime);
      const sameDay = start.getDate() === date.getDate() && start.getMonth() === date.getMonth();
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

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    
    const d = new Date(newJob.date);
    const [h, m] = newJob.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);

    if (isNaN(d.getTime())) {
      alert("Please enter a valid date and time.");
      return;
    }

    if (d < new Date()) {
        alert("Cannot book an appointment in the past.");
        return;
    }

    const end = new Date(d.getTime() + 2 * 60 * 60 * 1000);
    const finalLossType = newJob.lossType === 'Other' ? (newJob.customLossType || 'Other') : newJob.lossType;
    const fullLocation = `${newJob.location}${newJob.city ? `, ${newJob.city}` : ''}${newJob.zip ? ` ${newJob.zip}` : ''}`;

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      type: newJob.type,
      title: newJob.title || `${finalLossType}: ${MOCK_CONTACTS.find(c => c.id === newJob.contactId)?.name || 'Walk-in'}`,
      startTime: d.toISOString(),
      endTime: end.toISOString(),
      contactId: newJob.contactId,
      assignedTechnicianIds: newJob.techIds,
      status: 'pending',
      location: fullLocation || 'Unknown Location',
      lossType: finalLossType
    };

    setEvents(prev => [...prev, newEvent]);
    setIsBooking(false);
    setNewJob({
      title: '',
      type: 'inspection',
      contactId: '',
      location: '',
      city: '',
      zip: '',
      date: new Date(),
      time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
      lossType: 'Mold Assessment',
      customLossType: '',
      techIds: []
    });
  };

  // Custom Picker Components
  const DatePickerPopover = () => {
    const year = pickerViewDate.getFullYear();
    const month = pickerViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const days = [];
    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, current: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, current: true, date: new Date(year, month, i) });
    }
    // Next month filler
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, current: false, date: new Date(year, month + 1, i) });
    }

    const isSelected = (d: Date) => d.toDateString() === newJob.date.toDateString();
    const isPast = (d: Date) => {
        const checkDate = new Date(d);
        checkDate.setHours(0,0,0,0);
        return checkDate < todayStart;
    };

    return (
      <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <button type="button" onClick={() => setPickerViewDate(new Date(year, month - 1))} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><ChevronLeft size={20} /></button>
          <span className="text-sm font-black text-slate-800 uppercase tracking-widest">{pickerViewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          <button type="button" onClick={() => setPickerViewDate(new Date(year, month + 1))} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><ChevronRight size={20} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-2">{d}</div>
          ))}
          {days.map((d, i) => {
            const past = isPast(d.date);
            return (
              <button
                key={i}
                type="button"
                disabled={past}
                onClick={() => setNewJob({ ...newJob, date: d.date })}
                className={`h-10 w-10 flex items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isSelected(d.date) 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : past 
                      ? 'text-slate-200 cursor-not-allowed opacity-40' 
                      : d.current 
                        ? 'text-slate-700 hover:bg-slate-100' 
                        : 'text-slate-300 hover:bg-slate-50'
                }`}
              >
                {d.day}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={() => { setNewJob({ ...newJob, date: new Date() }); setIsDatePickerOpen(false); }} className="px-6 py-2.5 bg-slate-50 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Now</button>
          <button type="button" onClick={() => setIsDatePickerOpen(false)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">Confirm</button>
        </div>
      </div>
    );
  };

  const TimePickerPopover = () => {
    const [h, m] = newJob.time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;

    const updateTime = (newH: number, newM: number, newPeriod: 'AM' | 'PM') => {
        let finalH = newH;
        if (newPeriod === 'PM' && finalH !== 12) finalH += 12;
        if (newPeriod === 'AM' && finalH === 12) finalH = 0;
        
        const d = new Date(newJob.date);
        d.setHours(finalH, newM, 0, 0);
        if (d < new Date()) {
            const nowTime = new Date();
            setNewJob({ ...newJob, time: `${nowTime.getHours().toString().padStart(2, '0')}:${nowTime.getMinutes().toString().padStart(2, '0')}` });
        } else {
            setNewJob({ ...newJob, time: `${finalH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}` });
        }
    };

    const isTimeInPast = (newH: number, newM: number, newPeriod: 'AM' | 'PM') => {
        let finalH = newH;
        if (newPeriod === 'PM' && finalH !== 12) finalH += 12;
        if (newPeriod === 'AM' && finalH === 12) finalH = 0;
        const d = new Date(newJob.date);
        d.setHours(finalH, newM, 0, 0);
        return d < new Date();
    };

    return (
        <div className="absolute top-full left-0 mt-2 w-[280px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[300] p-6 animate-in zoom-in-95 duration-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Set Execution Time</p>
            
            <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col items-center gap-2">
                    <button type="button" onClick={() => updateTime(displayH === 12 ? 1 : displayH + 1, m, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronUp size={20} /></button>
                    <span className="text-3xl font-black text-slate-800">{displayH}</span>
                    <button type="button" onClick={() => updateTime(displayH === 1 ? 12 : displayH - 1, m, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronDown size={20} /></button>
                </div>
                <span className="text-3xl font-black text-slate-200 mb-1">:</span>
                <div className="flex flex-col items-center gap-2">
                    <button type="button" onClick={() => updateTime(displayH, m === 59 ? 0 : m + 1, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronUp size={20} /></button>
                    <span className="text-3xl font-black text-slate-800">{m.toString().padStart(2, '0')}</span>
                    <button type="button" onClick={() => updateTime(displayH, m === 0 ? 59 : m - 1, period)} className="p-1 text-slate-300 hover:text-blue-600"><ChevronDown size={20} /></button>
                </div>
                <div className="flex flex-col gap-2">
                    <button 
                        type="button" 
                        onClick={() => updateTime(displayH, m, 'AM')} 
                        disabled={isTimeInPast(displayH, m, 'AM')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${period === 'AM' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'} disabled:opacity-30 disabled:cursor-not-allowed`}
                    >AM</button>
                    <button 
                        type="button" 
                        onClick={() => updateTime(displayH, m, 'PM')} 
                        disabled={isTimeInPast(displayH, m, 'PM')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${period === 'PM' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'} disabled:opacity-30 disabled:cursor-not-allowed`}
                    >PM</button>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsTimePickerOpen(false)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all w-full">Confirm Time</button>
            </div>
        </div>
    );
  };

  const WeekView = () => {
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - selectedDate.getDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-100 bg-slate-50/50">
          <div className="border-r border-slate-100"></div>
          {weekDays.map(date => (
            <div key={date.toString()} className="p-4 text-center border-r border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
              <p className={`text-lg font-black mt-1 ${new Date().toDateString() === date.toDateString() ? 'text-blue-600' : 'text-slate-800'}`}>{date.getDate()}</p>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {hoursList.map(hour => (
            <div key={hour} className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-50 min-h-[80px]">
              <div className="p-4 flex items-center justify-center border-r border-slate-50 text-[10px] font-black text-slate-400 uppercase">{hour > 12 ? `${hour - 12} PM` : `${hour} ${hour === 12 ? 'PM' : 'AM'}`}</div>
              {weekDays.map(date => {
                const hourEvents = filteredEvents.filter(e => { const d = new Date(e.startTime); return d.toDateString() === date.toDateString() && d.getHours() === hour; });
                const cap = getCapacityDetails(date, hour);
                return (
                  <div key={date.toString()} className={`border-r border-slate-50 p-2 relative group transition-colors ${cap.isLocked ? 'bg-slate-100/30' : 'hover:bg-slate-50/50'}`}>
                    {cap.isLocked && <Lock size={10} className="absolute top-2 right-2 text-slate-300" />}
                    {!cap.isLocked && (
                      <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {Array.from({ length: Math.min(cap.availableLeads, 2) }).map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${viewMode === 'inspection' ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                        ))}
                      </div>
                    )}
                    {hourEvents.map(e => (
                      <button key={e.id} onClick={() => setSelectedEvent(e)} className={`w-full p-2 mb-1 rounded-xl border text-left text-[9px] font-bold shadow-sm ${e.type === 'emergency' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{(e.title || '').split(':')[0]}</button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const MonthView = () => {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
    const days = Array.from({ length: 42 }, (_, i) => {
      const dayNum = i - firstDay + 1;
      if (dayNum > 0 && dayNum <= daysInMonth) return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNum);
      return null;
    });

    return (
      <div className="grid grid-cols-7 h-full border-l border-t border-slate-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="p-4 border-r border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{d}</div>
        ))}
        {days.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="bg-slate-50/30 border-r border-b border-slate-100"></div>;
          const dayEvents = filteredEvents.filter(e => new Date(e.startTime).toDateString() === date.toDateString());
          const cap = getCapacityDetails(date);
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={i} className={`p-3 border-r border-b border-slate-100 min-h-[120px] transition-colors hover:bg-slate-50/50 group cursor-pointer ${isToday ? 'bg-blue-50/20' : ''}`} onClick={() => { setSelectedDate(date); setViewType('day'); }}>
              <div className="flex justify-between items-start mb-2">
                <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black ${isToday ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{date.getDate()}</span>
                <div className="flex gap-0.5">
                   {Array.from({ length: Math.min(cap.availableLeads, 3) }).map((_, i) => (
                     <div key={i} className={`w-1.5 h-1.5 rounded-full ${viewMode === 'inspection' ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>
                   ))}
                </div>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(e => (
                  <div key={e.id} className={`text-[9px] font-bold p-1 rounded truncate border ${e.type === 'emergency' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>{e.title}</div>
                ))}
                {dayEvents.length > 2 && <div className="text-[9px] font-black text-slate-300 uppercase pl-1">+{dayEvents.length - 2} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const EventDetailModal = () => {
    if (!selectedEvent) return null;
    const isEmergency = selectedEvent.type === 'emergency';
    const startTime = new Date(selectedEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const contact = MOCK_CONTACTS.find(c => c.id === selectedEvent.contactId);

    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-[#0f172a] w-full max-w-[500px] rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800 text-white flex flex-col">
          {/* Top Banner */}
          <div className={`px-8 py-4 flex items-center justify-between ${isEmergency ? 'bg-blue-600/10 text-blue-400' : 'bg-emerald-600/10 text-emerald-400'}`}>
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-md ${isEmergency ? 'bg-blue-600' : 'bg-emerald-600'} text-white`}>
                {isEmergency ? <ShieldCheck size={14} /> : <CheckCircle2 size={14} />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                {isEmergency ? 'Emergency Assignment' : 'Inspection Assignment'}
              </span>
            </div>
            <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 space-y-10">
            {/* Main Info */}
            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tight leading-tight">{selectedEvent.title}</h2>
              <div className="flex flex-col gap-3 text-slate-400">
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">{startTime} • {selectedEvent.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">{selectedEvent.location}</span>
                </div>
                {contact && (
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">Customer: {contact.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Squad Assembly */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Squad Assembly (Priority Sorted)</span>
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Priority By Rank</span>
              </div>
              <div className="space-y-3 max-h-[240px] overflow-y-auto scrollbar-hide pr-2">
                {MOCK_TECHNICIANS.map((tech) => {
                  const isAssigned = selectedEvent.assignedTechnicianIds.includes(tech.id);
                  const isOffDuty = tech.emergencyStatus === Status.OFF_DUTY;
                  const priority = isEmergency ? tech.emergencyPriority : tech.inspectionPriority;
                  return (
                    <div key={tech.id} className={`flex items-center gap-4 p-5 rounded-[1.8rem] border transition-all ${isAssigned ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-800/20 border-slate-800/50 opacity-40'}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-lg ${isAssigned ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {(tech.name || '??').split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                           <p className="font-black text-sm truncate">{tech.name}</p>
                           {isOffDuty && <span className="text-[8px] font-black text-red-400 uppercase tracking-widest bg-red-400/10 px-1.5 py-0.5 rounded">Off Duty</span>}
                        </div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          {tech.role} • {priority}
                        </p>
                      </div>
                      {isAssigned && (
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Context */}
            <div className="bg-slate-800/30 rounded-[1.8rem] p-6 border border-slate-800/50 space-y-6">
              <div className="flex items-center gap-2 text-blue-400">
                <Info size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Incident Context</span>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Loss Category</label>
                  <p className="text-sm font-black">{selectedEvent.lossType || 'Unspecified'}</p>
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Dispatch Protocol</label>
                  <p className="text-sm font-black">{INITIAL_COMPANY_SETTINGS.dispatchStrategy}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <button onClick={() => setSelectedEvent(null)} className="flex-1 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all active:scale-95">
                Reschedule
              </button>
              <button onClick={() => setSelectedEvent(null)} className="flex-[1.5] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">
                Update Squad
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
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
          <button onClick={() => setIsBooking(true)} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"><Plus size={16} /> Book Job</button>
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
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Booking Restricted (Notice Window)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {viewType === 'week' && <WeekView />}
          {viewType === 'month' && <MonthView />}
        </div>
      </div>

      <EventDetailModal />

      {isBooking && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 my-auto">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Briefcase size={24} /></div>
                <h3 className="text-xl font-black uppercase tracking-tight">Manual Job Entry</h3>
              </div>
              <button onClick={() => setIsBooking(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <form onSubmit={handleCreateJob} className="p-10 space-y-8 overflow-y-auto scrollbar-hide max-h-[75vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Job Title / Description</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Miller Residence Assessment" 
                    value={newJob.title}
                    onChange={e => setNewJob({...newJob, title: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Appointment Type</label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    <button 
                      type="button"
                      onClick={() => setNewJob({...newJob, type: 'inspection'})}
                      className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newJob.type === 'inspection' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}
                    >
                      <ShieldCheck size={16} /> Inspection
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewJob({...newJob, type: 'emergency'})}
                      className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2 ${newJob.type === 'emergency' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 bg-transparent'}`}
                    >
                      <AlertCircle size={16} /> Emergency
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Loss Category / Assessment Type</label>
                  <select 
                    value={newJob.lossType}
                    onChange={e => setNewJob({...newJob, lossType: e.target.value})}
                    className="w-full h-[52px] px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer"
                  >
                    <option value="Mold Assessment">Mold Assessment</option>
                    <option value="Water Damage Assessment">Water Damage Assessment</option>
                    <option value="Fire Damage Assessment">Fire Damage Assessment</option>
                    <option value="Biohazard Assessment">Biohazard Assessment</option>
                    <option value="Storm Damage Assessment">Storm Damage Assessment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                {newJob.lossType === 'Other' && (
                  <div className="col-span-2 animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Specify Custom Assessment</label>
                    <div className="relative">
                      <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        required 
                        placeholder="Type assessment type here..." 
                        value={newJob.customLossType}
                        onChange={e => setNewJob({...newJob, customLossType: e.target.value})}
                        className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Scheduled Date</label>
                  <div 
                    className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isDatePickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`}
                    onClick={() => { setIsDatePickerOpen(!isDatePickerOpen); setIsTimePickerOpen(false); }}
                  >
                    <CalendarDays size={16} className={`mr-4 transition-colors ${isDatePickerOpen ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold ${isDatePickerOpen ? 'text-blue-600' : 'text-slate-800'}`}>{newJob.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {isDatePickerOpen && <DatePickerPopover />}
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Scheduled Time</label>
                  <div 
                    className={`relative flex items-center bg-slate-50 border rounded-2xl px-5 py-3.5 cursor-pointer transition-all hover:bg-white ${isTimePickerOpen ? 'border-blue-600 ring-4 ring-blue-600/5 shadow-inner' : 'border-slate-200'}`}
                    onClick={() => { setIsTimePickerOpen(!isTimePickerOpen); setIsDatePickerOpen(false); }}
                  >
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
                  {isTimePickerOpen && <TimePickerPopover />}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Service Address</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      required
                      placeholder="Street Address"
                      value={newJob.location}
                      onChange={e => setNewJob({...newJob, location: e.target.value})}
                      className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">City</label>
                  <input 
                    type="text" 
                    placeholder="City"
                    value={newJob.city}
                    onChange={e => setNewJob({...newJob, city: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Zip Code</label>
                  <input 
                    type="text" 
                    placeholder="Zip Code"
                    value={newJob.zip}
                    onChange={e => setNewJob({...newJob, zip: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Assign Dispatch Squad</label>
                  <div className="grid grid-cols-2 gap-3">
                    {MOCK_TECHNICIANS.map(tech => (
                      <button 
                        key={tech.id}
                        type="button"
                        onClick={() => {
                          const ids = [...newJob.techIds];
                          const idx = ids.indexOf(tech.id);
                          if (idx > -1) ids.splice(idx, 1);
                          else ids.push(tech.id);
                          setNewJob({...newJob, techIds: ids});
                        }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left group/tech ${newJob.techIds.includes(tech.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm transition-colors ${newJob.techIds.includes(tech.id) ? 'bg-white/20' : 'bg-slate-100 group-hover/tech:bg-blue-50'}`}>
                           {(tech.name || '??').split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black truncate">{tech.name}</p>
                          <p className={`text-[8px] font-black uppercase tracking-widest ${newJob.techIds.includes(tech.id) ? 'text-blue-100' : 'text-slate-400'}`}>{tech.role}</p>
                        </div>
                        {newJob.techIds.includes(tech.id) && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/90 backdrop-blur-md pb-2">
                <button type="button" onClick={() => setIsBooking(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">Complete Dispatch Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedCalendar;
