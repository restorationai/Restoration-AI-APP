
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
  MoreVertical,
  Phone,
  UserPlus,
  ArrowUpRight,
  Info,
  CalendarDays,
  Activity,
  LayoutGrid,
  Columns,
  Lock
} from 'lucide-react';
import { MOCK_CALENDAR_EVENTS, MOCK_TECHNICIANS, MOCK_CONTACTS, INITIAL_COMPANY_SETTINGS } from '../constants';
import { CalendarEvent, AppointmentType, Technician, Role } from '../types';

type ViewType = 'day' | 'week' | 'month';

const UnifiedCalendar: React.FC = () => {
  const [viewMode, setViewMode] = useState<'emergency' | 'inspection'>('emergency');
  const [viewType, setViewType] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(MOCK_CALENDAR_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

  const parseTime = (timeStr: string, isEnd: boolean = false) => {
    if (!timeStr || timeStr === 'None') return null;
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const val = hours * 60 + minutes;
    // Treat 12:00 AM at the end of a shift as 1440 (midnight)
    if (isEnd && val === 0) return 1440;
    return val;
  };

  const isTechOnDuty = (tech: Technician, date: Date, hour: number) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const schedule = viewMode === 'emergency' ? tech.emergencySchedule : tech.inspectionSchedule;
    const daySched = schedule.find(s => s.day === dayName);

    if (!daySched || !daySched.enabled) return false;
    if (daySched.override === 'Force Active') return true;
    if (daySched.override === 'Force Off Duty') return false;
    if (daySched.is24Hours) return true;

    const slotMinutes = hour * 60;
    const startMinutes = parseTime(daySched.start);
    const endMinutes = parseTime(daySched.end, true);

    if (startMinutes === null || endMinutes === null) return false;
    
    // UI now enforces start < end, so standard range check is 100% safe
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
      const sched = viewMode === 'emergency' ? t.emergencySchedule : t.inspectionSchedule;
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

  const navigate = (direction: 'prev' | 'next') => {
    const next = new Date(selectedDate);
    if (viewType === 'day') next.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    else if (viewType === 'week') next.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    else if (viewType === 'month') next.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedDate(next);
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
          const dayEvents = events.filter(e => new Date(e.startTime).toDateString() === date.toDateString());
          const cap = getCapacityDetails(date);
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={i} className={`p-3 border-r border-b border-slate-100 min-h-[120px] transition-colors hover:bg-slate-50/50 group cursor-pointer ${isToday ? 'bg-blue-50/20' : ''}`} onClick={() => { setSelectedDate(date); setViewType('day'); }}>
              <div className="flex justify-between items-start mb-2">
                <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black ${isToday ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{date.getDate()}</span>
                <div className="flex gap-0.5">
                   {Array.from({ length: Math.min(cap.availableLeads, 3) }).map((_, i) => (
                     <div key={i} className={`w-1.5 h-1.5 rounded-full ${viewMode === 'emergency' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
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
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-50 min-h-[80px]">
              <div className="p-4 flex items-center justify-center border-r border-slate-50 text-[10px] font-black text-slate-400 uppercase">{hour > 12 ? `${hour - 12} PM` : `${hour} ${hour === 12 ? 'PM' : 'AM'}`}</div>
              {weekDays.map(date => {
                const hourEvents = events.filter(e => { const d = new Date(e.startTime); return d.toDateString() === date.toDateString() && d.getHours() === hour; });
                const cap = getCapacityDetails(date, hour);
                return (
                  <div key={date.toString()} className={`border-r border-slate-50 p-2 relative group transition-colors ${cap.isLocked ? 'bg-slate-100/30' : 'hover:bg-slate-50/50'}`}>
                    {cap.isLocked && <Lock size={10} className="absolute top-2 right-2 text-slate-300" />}
                    {!cap.isLocked && (
                      <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {Array.from({ length: Math.min(cap.availableLeads, 2) }).map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${viewMode === 'emergency' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                        ))}
                      </div>
                    )}
                    {hourEvents.map(e => (
                      <button key={e.id} onClick={() => setSelectedEvent(e)} className={`w-full p-2 mb-1 rounded-xl border text-left text-[9px] font-bold shadow-sm ${e.type === 'emergency' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{e.title.split(':')[0]}</button>
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
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"><Plus size={16} /> Book Job</button>
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
                {hours.map((hour) => {
                  const hourEvents = events.filter(e => { const d = new Date(e.startTime); return d.toDateString() === selectedDate.toDateString() && d.getHours() === hour; });
                  const cap = getCapacityDetails(selectedDate, hour);
                  const displayHour = hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 ${hour === 12 ? 'PM' : 'AM'}`;
                  return (
                    <div key={hour} className={`grid grid-cols-[120px_1fr] border-b border-slate-50 min-h-[100px] group transition-colors ${cap.isLocked ? 'bg-slate-50/50' : ''}`}>
                      <div className="border-r border-slate-50 p-6 flex items-start justify-center"><span className={`text-xs font-black transition-colors ${cap.isLocked ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-800'}`}>{displayHour}</span></div>
                      <div className="p-3 px-6 flex flex-wrap gap-4 relative">
                        {!cap.isLocked && (
                          <>
                            <div className="absolute right-6 top-6 flex gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                              {Array.from({ length: Math.min(cap.availableLeads, 8) }).map((_, i) => (<div key={i} className={`w-2.5 h-2.5 rounded-full ${viewMode === 'emergency' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>))}
                            </div>
                            {hourEvents.map(event => (
                              <button key={event.id} onClick={() => setSelectedEvent(event)} className={`flex-1 min-w-[300px] max-w-[500px] p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] shadow-sm ${event.type === 'emergency' ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                                <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-black uppercase tracking-widest opacity-60">{event.type} Dispatch</span></div>
                                <p className="font-bold text-sm mb-2">{event.title}</p>
                              </button>
                            ))}
                          </>
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
    </div>
  );
};

export default UnifiedCalendar;
