
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  PhoneForwarded, 
  History, 
  Plus, 
  MoreVertical, 
  ShieldCheck, 
  AlertCircle, 
  CalendarDays, 
  X, 
  Save, 
  UserPlus, 
  Zap, 
  RefreshCw, 
  ChevronRight, 
  Calendar, 
  Check,
  Loader2,
  Phone,
  Edit2,
  Settings,
  CircleCheck,
  Smartphone
} from 'lucide-react';
import { MOCK_DISPATCH_LOGS, DEFAULT_SCHEDULE } from '../constants.tsx';
import { Role, Status, InspectionStatus, Technician, DaySchedule } from '../types.ts';
import { syncTechnicianToSupabase, syncScheduleToSupabase, fetchTechniciansFromSupabase } from '../lib/supabase.ts';

interface DispatchSchedulingProps {
  onOpenSettings: () => void;
}

const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '').slice(0, 10);
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const GENERATE_TIME_SLOTS = () => {
  const slots: string[] = [];
  const periods = ['AM', 'PM'];
  for (let p = 0; p < 2; p++) {
    for (let h = 0; h < 12; h++) {
      const hour = h === 0 ? 12 : h;
      for (let m = 0; m < 60; m += 30) {
        const min = m === 0 ? '00' : m;
        slots.push(`${hour}:${min} ${periods[p]}`);
      }
    }
  }
  slots.push('12:00 AM');
  return slots;
};

const TIME_SLOTS = GENERATE_TIME_SLOTS();

const DispatchScheduling: React.FC<DispatchSchedulingProps> = ({ onOpenSettings }) => {
  const [activeSubTab, setActiveSubTab] = useState<'technicians' | 'logs' | 'routing'>('technicians');
  const [rosterView, setRosterView] = useState<'emergency' | 'inspection'>('emergency');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');
  
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [isAddingTech, setIsAddingTech] = useState(false);

  const [transferLines, setTransferLines] = useState({
    primary: '',
    secondary: '',
    third: ''
  });

  const [directory, setDirectory] = useState([
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' }
  ]);

  const [newTechForm, setNewTechForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: Role.LEAD,
    addToEmergency: true,
    addToInspection: true
  });

  const [localSchedule, setLocalSchedule] = useState<DaySchedule[]>([]);
  const [localPriorityNum, setLocalPriorityNum] = useState<number>(1);
  const [localRole, setLocalRole] = useState<Role>(Role.LEAD);
  const [localOverride, setLocalOverride] = useState<'None' | 'Force Active' | 'Force Off Duty'>('None');

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Get the current company ID from the session/profile context
        const { data: { user } } = await (await import('../lib/supabase.ts')).supabase.auth.getUser();
        if (user) {
          const { data: profile } = await (await import('../lib/supabase.ts')).supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();
          
          if (profile?.company_id) {
            const data = await fetchTechniciansFromSupabase(profile.company_id);
            setTechnicians(data);
          }
        }
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.error("Failed to load techs:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const parseTime = (timeStr: string, isEnd: boolean = false) => {
    if (!timeStr || timeStr === 'None') return null;
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const val = hours * 60 + minutes;
    if (isEnd && val === 0) return 1440;
    return val;
  };

  const checkDutyStatus = (tech: Technician): { status: string; active: boolean; isOverride: boolean } => {
    const schedule = rosterView === 'emergency' ? tech.emergencySchedule : tech.inspectionSchedule;
    const globalOverride = schedule[0]?.override || 'None';

    if (globalOverride === 'Force Active') return { status: 'On Duty (Forced)', active: true, isOverride: true };
    if (globalOverride === 'Force Off Duty') return { status: 'Off Duty (Forced)', active: false, isOverride: true };

    const currentDayStr = currentTime.toLocaleDateString('en-US', { weekday: 'short' });
    const daySched = schedule.find(s => s.day === currentDayStr);

    if (!daySched || !daySched.enabled) return { status: 'Off Duty', active: false, isOverride: false };
    if (daySched.is24Hours) return { status: 'On Duty (24h)', active: true, isOverride: false };

    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const startMinutes = parseTime(daySched.start);
    const endMinutes = parseTime(daySched.end, true);

    if (startMinutes !== null && endMinutes !== null) {
      if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
        return { status: 'On Duty', active: true, isOverride: false };
      }
    }
    return { status: 'Off Duty', active: false, isOverride: false };
  };

  const handleOpenSettings = (tech: Technician) => {
    setEditingTech(tech);
    const currentSched = rosterView === 'emergency' ? [...tech.emergencySchedule] : [...tech.inspectionSchedule];
    const priorityStr = rosterView === 'emergency' ? tech.emergencyPriority : tech.inspectionPriority;
    
    setLocalSchedule(currentSched);
    setLocalRole(tech.role);
    setLocalOverride(currentSched[0]?.override || 'None');
    
    const match = priorityStr?.match(/\d+/);
    setLocalPriorityNum(match ? parseInt(match[0]) : 1);
  };

  const handleSaveTechSettings = async () => {
    if (!editingTech) return;
    setIsSyncing(true);

    const isEmergency = rosterView === 'emergency';
    const sameRoleTechs = technicians.filter(t => t.role === localRole);
    
    const techStates = sameRoleTechs.map(t => {
      if (t.id === editingTech.id) {
        return { id: t.id, rank: localPriorityNum };
      }
      return { id: t.id, rank: isEmergency ? t.emergencyPriorityNumber : t.inspectionPriorityNumber };
    });

    techStates.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.id === editingTech.id ? -1 : 1;
    });

    const rankMap = new Map();
    let currentSequence = 1;
    techStates.forEach(ts => {
      if (ts.rank < 99) {
        rankMap.set(ts.id, currentSequence++);
      } else {
        rankMap.set(ts.id, 99);
      }
    });

    const finalSchedule = localSchedule.map(s => ({ ...s, override: localOverride }));
    
    let newEmergencyStatus = editingTech.emergencyStatus;
    let newInspectionStatus = editingTech.inspectionStatus;

    if (isEmergency) {
      if (localOverride === 'Force Active') newEmergencyStatus = Status.ACTIVE;
      else if (localOverride === 'Force Off Duty') newEmergencyStatus = Status.OFF_DUTY;
    } else {
      if (localOverride === 'Force Active') newInspectionStatus = InspectionStatus.AVAILABLE;
      else if (localOverride === 'Force Off Duty') newInspectionStatus = InspectionStatus.UNAVAILABLE;
    }

    try {
      const finalR = rankMap.get(editingTech.id);
      const suffix = finalR === 1 ? 'st' : finalR === 2 ? 'nd' : finalR === 3 ? 'rd' : 'th';
      const finalLabel = finalR === 99 ? 'None' : `${finalR}${suffix} Priority`;

      await syncTechnicianToSupabase({
        id: editingTech.id,
        name: editingTech.name,
        role: localRole,
        emergency_priority: isEmergency ? finalLabel : editingTech.emergencyPriority,
        inspection_priority: !isEmergency ? finalLabel : editingTech.inspectionPriority,
        emergency_priority_number: isEmergency ? finalR : editingTech.emergencyPriorityNumber,
        inspection_priority_number: !isEmergency ? finalR : editingTech.inspectionPriorityNumber,
        phone: editingTech.phone,
        emergency_status: newEmergencyStatus,
        inspection_status: newInspectionStatus,
        client_id: editingTech.clientId
      });

      await syncScheduleToSupabase(editingTech.id, finalSchedule);

      const updatedTechs = technicians.map(t => {
        const newR = rankMap.has(t.id) ? rankMap.get(t.id) : (isEmergency ? t.emergencyPriorityNumber : t.inspectionPriorityNumber);
        const sfx = newR === 1 ? 'st' : newR === 2 ? 'nd' : newR === 3 ? 'rd' : 'th';
        const label = newR === 99 ? 'None' : `${newR}${sfx} Priority`;
        
        if (t.id === editingTech.id) {
          return {
            ...t,
            role: localRole,
            [isEmergency ? 'emergencySchedule' : 'inspectionSchedule']: finalSchedule,
            [isEmergency ? 'emergencyPriority' : 'inspectionPriority']: label,
            [isEmergency ? 'emergencyPriorityNumber' : 'inspectionPriorityNumber']: newR,
            emergencyStatus: newEmergencyStatus,
            inspectionStatus: newInspectionStatus
          };
        }
        
        if (rankMap.has(t.id)) {
            return {
                ...t,
                [isEmergency ? 'emergencyPriority' : 'inspectionPriority']: label,
                [isEmergency ? 'emergencyPriorityNumber' : 'inspectionPriorityNumber']: newR
            };
        }
        return t;
      });
      
      setTechnicians(updatedTechs);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setEditingTech(null);
    } catch (err: any) {
      console.error('Failed to sync settings:', err);
      alert(`Sync failed: ${err?.message || 'A synchronization error occurred.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNewTech = async () => {
    if (!newTechForm.name || !newTechForm.phone) {
        alert("Please provide Name and Phone number.");
        return;
    }

    setIsSyncing(true);
    try {
        const { data: { user } } = await (await import('../lib/supabase.ts')).supabase.auth.getUser();
        if (!user) throw new Error("Session expired.");

        const { data: profile } = await (await import('../lib/supabase.ts')).supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!profile?.company_id) throw new Error("Company profile not found.");

        const newId = `T-${Date.now()}`;
        const newTech: Technician = {
            id: newId,
            name: newTechForm.name,
            phone: formatPhoneNumber(newTechForm.phone),
            email: newTechForm.email,
            role: newTechForm.role,
            clientId: profile.company_id,
            emergencyPriority: newTechForm.addToEmergency ? "1st Priority" : "None",
            emergencyPriorityNumber: newTechForm.addToEmergency ? 1 : 99,
            emergencyStatus: Status.ACTIVE,
            emergencySchedule: [...DEFAULT_SCHEDULE],
            inspectionPriority: (newTechForm.addToInspection && newTechForm.role !== Role.ASSISTANT) ? "1st Priority" : "None",
            inspectionPriorityNumber: (newTechForm.addToInspection && newTechForm.role !== Role.ASSISTANT) ? 1 : 99,
            inspectionStatus: InspectionStatus.AVAILABLE,
            inspectionSchedule: [...DEFAULT_SCHEDULE],
        };

        await syncTechnicianToSupabase({
            id: newTech.id,
            name: newTech.name,
            phone: newTech.phone,
            role: newTech.role,
            emergency_priority: newTech.emergencyPriority,
            inspection_priority: newTech.inspectionPriority,
            emergency_status: newTech.emergencyStatus,
            inspection_status: newTech.inspectionStatus,
            client_id: newTech.clientId
        });
        await syncScheduleToSupabase(newTech.id, DEFAULT_SCHEDULE);
        
        setTechnicians(prev => [...prev, newTech]);
        setIsAddingTech(false);
        setNewTechForm({ name: '', phone: '', email: '', role: Role.LEAD, addToEmergency: true, addToInspection: true });
    } catch (err: any) {
        console.error("Failed to add tech:", err);
        alert(`Failed to add technician: ${err?.message || 'Could not add technician.'}`);
    } finally {
        setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="font-black text-xs uppercase tracking-[0.3em]">Syncing with Supabase Cluster...</p>
      </div>
    );
  }

  const renderTechTable = (techs: Technician[], title: string) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-2">
        <div className={`w-2 h-2 rounded-full ${title.includes('Lead') ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]' : 'bg-slate-400'}`}></div>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h3>
      </div>
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">
              <th className="px-10 py-5">Technician Information</th>
              <th className="px-10 py-5">Availability Status</th>
              <th className="px-10 py-5 text-center">Dispatch Ranking</th>
              <th className="px-10 py-5 text-right">Settings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {techs.length > 0 ? techs.map((tech) => {
              const duty = checkDutyStatus(tech);
              const priorityStr = rosterView === 'emergency' ? tech.emergencyPriority : tech.inspectionPriority;
              return (
                <tr key={tech.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner border-2 ${rosterView === 'emergency' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{tech.name?.split(' ').map(n => n[0]).join('') || '??'}</div>
                      <div>
                        <p className="font-black text-lg text-slate-800 tracking-tight leading-none mb-2">{tech.name}</p>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">{tech.role}</span>
                           <span className="text-xs font-bold text-slate-500">{tech.phone}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <button 
                      onClick={() => handleOpenSettings(tech)}
                      className={`inline-flex items-center gap-3 px-5 py-2 rounded-full text-[10px] font-black border uppercase tracking-[0.15em] transition-all hover:ring-4 active:scale-95 ${duty.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:ring-emerald-100/50' : 'bg-slate-100 text-slate-500 border-slate-200 hover:ring-slate-200/50'}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${duty.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                      {duty.status}
                    </button>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <button onClick={() => handleOpenSettings(tech)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95 shadow-sm border ${rosterView === 'emergency' ? 'bg-blue-700 text-white border-blue-100' : 'bg-emerald-700 text-white border-emerald-100'}`}>
                      {priorityStr?.split(' ')[0] || 'Unranked'}
                    </button>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => handleOpenSettings(tech)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm"><CalendarDays size={18} /></button>
                      <button className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><MoreVertical size={18} /></button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="px-10 py-16 text-center">
                   <div className="flex flex-col items-center justify-center opacity-30">
                      <Users size={48} className="mb-4 text-slate-300" />
                      <p className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">No {title.toLowerCase()} configured.</p>
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 text-slate-900">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 w-fit">
          <button onClick={() => setActiveSubTab('technicians')} className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-base font-bold transition-all ${activeSubTab === 'technicians' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}><Users size={22} /> Technician Roster</button>
          <button onClick={() => setActiveSubTab('logs')} className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-base font-bold transition-all ${activeSubTab === 'logs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}><History size={22} /> Dispatch Logs</button>
          <button onClick={() => setActiveSubTab('routing')} className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-base font-bold transition-all ${activeSubTab === 'routing' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}><PhoneForwarded size={22} /> Call Transferring</button>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-3 px-6 py-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
             <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></div>
             <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">DB Status: Active</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">Sync: {lastSyncTime}</span>
             </div>
          </div>
           <button onClick={onOpenSettings} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
             <Settings size={20} />
             Dispatch Settings
           </button>
        </div>
      </div>

      {activeSubTab === 'technicians' && (
        <div className="space-y-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Team Roster</h2>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button onClick={() => setRosterView('emergency')} className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${rosterView === 'emergency' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}><AlertCircle size={14} /> Emergency Dispatch</button>
                <button onClick={() => setRosterView('inspection')} className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${rosterView === 'inspection' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}><ShieldCheck size={14} /> Inspections</button>
              </div>
            </div>
            <button onClick={() => setIsAddingTech(true)} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-base font-black hover:bg-slate-800 shadow-2xl transition-all active:scale-95"><Plus size={24} /> Add New Technician</button>
          </div>

          <div className="space-y-12 animate-in slide-in-from-bottom-2 duration-500">
            {renderTechTable(technicians.filter(t => t.role === Role.LEAD && (rosterView === 'emergency' ? t.emergencyPriority !== 'None' : t.inspectionPriority !== 'None')), 'Lead Technicians')}
            {renderTechTable(technicians.filter(t => t.role === Role.ASSISTANT && (rosterView === 'emergency' ? t.emergencyPriority !== 'None' : t.inspectionPriority !== 'None')), 'Assistant Technicians')}
          </div>
        </div>
      )}

      {activeSubTab === 'routing' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Call Transfer Protocol</h3>
                <p className="text-sm font-bold text-slate-400 mt-1">Configure how your AI agent handles phone transfers.</p>
              </div>
              <button onClick={() => alert('Protocol updated successfully!')} className="flex items-center gap-3 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95">
                <CircleCheck size={20} /> Update Protocol
              </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { id: 'primary', label: 'PRIMARY LINE', value: transferLines.primary, border: 'border-l-[4px] border-l-blue-600' },
                { id: 'secondary', label: 'SECONDARY BACKUP', value: transferLines.secondary, border: 'border-l-[4px] border-l-slate-400' },
                { id: 'third', label: 'THIRD TIER LINE', value: transferLines.third, border: 'border-l-[4px] border-l-slate-300' }
              ].map(line => (
                <div key={line.id} className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6 ${line.border}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{line.label}</p>
                  <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                      <Phone size={18} />
                    </div>
                    <input 
                      type="text" 
                      value={line.value} 
                      onChange={(e) => setTransferLines({...transferLines, [line.id]: formatPhoneNumber(e.target.value)})}
                      className="bg-transparent border-none outline-none font-black text-lg text-slate-800 w-full"
                      placeholder="(555) 555-5555"
                    />
                    <Edit2 size={16} className="text-slate-200 cursor-pointer hover:text-blue-500" />
                  </div>
                </div>
              ))}
           </div>

           <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm">
                  <Users size={24} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Named Transfer Directory</h4>
                  <p className="text-sm italic font-bold text-slate-400 tracking-tight">"Hey, can you transfer me to [Name]?"</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-12 gap-x-8 pt-6">
                {directory.map((entry, idx) => (
                  <div key={idx} className="bg-slate-50/30 p-8 rounded-[2.5rem] border border-slate-100/50 relative group hover:bg-white hover:shadow-xl hover:shadow-slate-200/20 transition-all duration-300">
                    <span className="absolute top-6 right-8 text-6xl font-black text-slate-100 group-hover:text-blue-50 transition-colors pointer-events-none opacity-50">{idx + 1}</span>
                    <div className="space-y-6">
                      <div className="relative z-10">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">RECIPIENT FIRST NAME</label>
                        <input 
                          type="text" 
                          placeholder="John"
                          value={entry.name}
                          onChange={(e) => {
                            const newDir = [...directory];
                            newDir[idx].name = e.target.value;
                            setDirectory(newDir);
                          }}
                          className="w-full px-5 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm font-black text-slate-800 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all shadow-sm"
                        />
                      </div>
                      <div className="relative z-10">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">DIRECT TRANSFER PHONE</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input 
                            type="text" 
                            placeholder="(555) 555-5555"
                            value={entry.phone}
                            onChange={(e) => {
                              const newDir = [...directory];
                              newDir[idx].phone = formatPhoneNumber(e.target.value);
                              setDirectory(newDir);
                            }}
                            className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm font-black text-slate-800 focus:ring-2 focus:ring-blue-600/10 outline-none transition-all shadow-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><History className="text-slate-400" /> Sarah AI Event Log</h3>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead>
                   <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50/30">
                      <th className="px-8 py-5">Timestamp</th>
                      <th className="px-8 py-5">Job Details</th>
                      <th className="px-8 py-5">Dispatch Action</th>
                      <th className="px-8 py-5">Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {technicians.length > 0 ? MOCK_DISPATCH_LOGS.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                         <td className="px-8 py-6 text-xs font-bold text-slate-500">{log.timestamp}</td>
                         <td className="px-8 py-6">
                            <p className="text-sm font-black text-slate-800">{log.lossType}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{log.clientName}</p>
                         </td>
                         <td className="px-8 py-6">
                            <p className="text-sm font-black text-blue-600">{log.assignedTech}</p>
                            <p className="text-[10px] italic text-slate-400">"{log.aiSummary}"</p>
                         </td>
                         <td className="px-8 py-6">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-200">{log.status}</span>
                         </td>
                      </tr>
                   )) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-16 text-center text-slate-300 font-bold text-sm">No activity recorded for this period.</td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {editingTech && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl">{editingTech.name?.split(' ').map(n => n[0]).join('') || '??'}</div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{editingTech.name}</h3>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Settings for {rosterView} Mode</p>
                </div>
              </div>
              <button onClick={() => setEditingTech(null)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Status Override</label>
                  <div className="space-y-2">
                    {['None', 'Force Active', 'Force Off Duty'].map(over => (
                      <button 
                        key={over}
                        onClick={() => setLocalOverride(over as any)}
                        className={`w-full flex items-center justify-between px-5 py-3 rounded-2xl text-xs font-black transition-all border ${localOverride === over ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'}`}
                      >
                        {over === 'None' ? 'Follow Schedule' : over}
                        {localOverride === over && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority Ranking</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <button 
                        key={num}
                        onClick={() => setLocalPriorityNum(num)}
                        className={`py-3 rounded-2xl text-xs font-black transition-all border ${localPriorityNum === num ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'}`}
                      >
                        {num}{num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Slot
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Role</label>
                  <div className="space-y-2">
                    {Object.values(Role).map(role => (
                      <button 
                        key={role}
                        onClick={() => setLocalRole(role)}
                        className={`w-full flex items-center justify-between px-5 py-3 rounded-2xl text-xs font-black transition-all border ${localRole === role ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'}`}
                      >
                        {role} Technician
                        {localRole === role && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
                   <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Calendar size={18} /> Weekly Availability Matrix</h4>
                   <p className="text-[10px] font-bold text-slate-400">Sarah AI will only dispatch during enabled hours.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <th className="px-8 py-4">Day</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4">Shift Start</th>
                        <th className="px-8 py-4">Shift End</th>
                        <th className="px-8 py-4 text-center">24h Shift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {localSchedule.map((s, idx) => (
                        <tr key={s.day} className={s.enabled ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-8 py-5 font-black text-slate-800 text-sm">{s.day}</td>
                          <td className="px-8 py-5">
                            <button 
                              onClick={() => {
                                const newSched = [...localSchedule];
                                newSched[idx].enabled = !newSched[idx].enabled;
                                setLocalSchedule(newSched);
                              }}
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${s.enabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500'}`}
                            >
                              {s.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                          <td className="px-8 py-5">
                            <select 
                              disabled={!s.enabled || s.is24Hours}
                              value={s.start}
                              onChange={(e) => {
                                const newSched = [...localSchedule];
                                newSched[idx].start = e.target.value;
                                setLocalSchedule(newSched);
                              }}
                              className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-30 cursor-pointer"
                            >
                              {TIME_SLOTS.map(t => <option key={t} value={t} className="text-slate-900">{t}</option>)}
                            </select>
                          </td>
                          <td className="px-8 py-5">
                            <select 
                              disabled={!s.enabled || s.is24Hours}
                              value={s.end}
                              onChange={(e) => {
                                const newSched = [...localSchedule];
                                newSched[idx].end = e.target.value;
                                setLocalSchedule(newSched);
                              }}
                              className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-30 cursor-pointer"
                            >
                              {TIME_SLOTS.map(t => <option key={t} value={t} className="text-slate-900">{t}</option>)}
                            </select>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <button 
                              disabled={!s.enabled}
                              onClick={() => {
                                const newSched = [...localSchedule];
                                newSched[idx].is24Hours = !newSched[idx].is24Hours;
                                setLocalSchedule(newSched);
                              }}
                              className={`w-10 h-6 rounded-full relative transition-all ${s.is24Hours ? 'bg-blue-600' : 'bg-slate-200'} ${!s.enabled ? 'opacity-30' : ''}`}
                            >
                               <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${s.is24Hours ? 'left-5' : 'left-1'}`}></div>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-10 py-8 bg-white border-t border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => setEditingTech(null)} 
                className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel Changes
              </button>
              <button 
                onClick={handleSaveTechSettings}
                disabled={isSyncing}
                className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {isSyncing ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                {isSyncing ? 'Syncing...' : 'Deploy & Re-Rank Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingTech && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
             <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24} /></div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Onboard Technician</h3>
                </div>
                <button onClick={() => setIsAddingTech(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
             </div>
             
             <div className="p-10 space-y-6">
                <div className="space-y-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                      <input type="text" value={newTechForm.name} onChange={e => setNewTechForm({...newTechForm, name: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="e.g. Michael Scott" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Phone</label>
                        <input type="text" value={newTechForm.phone} onChange={e => setNewTechForm({...newTechForm, phone: formatPhoneNumber(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="(555) 000-0000" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email</label>
                        <input type="email" value={newTechForm.email} onChange={e => setNewTechForm({...newTechForm, email: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="mike@company.com" />
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Technical Role</label>
                      <div className="flex gap-3">
                         {Object.values(Role).map(r => (
                           <button key={r} onClick={() => setNewTechForm({...newTechForm, role: r})} className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase border transition-all ${newTechForm.role === r ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 shadow-sm'}`}>{r}</button>
                         ))}
                      </div>
                   </div>
                </div>
                
                <button 
                  onClick={handleCreateNewTech}
                  disabled={isSyncing}
                  className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                >
                  {isSyncing && <RefreshCw className="animate-spin" size={18} />}
                  Add to Active Roster
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchScheduling;
