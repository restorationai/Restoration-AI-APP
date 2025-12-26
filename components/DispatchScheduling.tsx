
import React, { useState, useEffect, useMemo } from 'react';
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
  Smartphone,
  Search,
  ExternalLink,
  Trash2,
  Building,
  UserCheck,
  Globe,
  Mail,
  Bot,
  ChevronUp,
  ChevronDown,
  /* Add Info icon import */
  Info
} from 'lucide-react';
import { MOCK_DISPATCH_LOGS, DEFAULT_SCHEDULE } from '../constants.tsx';
import { Role, Status, InspectionStatus, Technician, DaySchedule, RestorationCompany, Contact, ContactType } from '../types.ts';
import { syncTechnicianToSupabase, syncScheduleToSupabase, fetchTechniciansFromSupabase, fetchCompanySettings, syncCompanySettingsToSupabase, fetchContactsFromSupabase, syncContactToSupabase, deleteTechnicianFromSupabase } from '../lib/supabase.ts';
import { formatPhoneNumberInput, toDisplay } from '../utils/phoneUtils.ts';

interface DispatchSchedulingProps {
  onOpenSettings: () => void;
}

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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [isAddingTech, setIsAddingTech] = useState(false);
  const [isAddingQuickContact, setIsAddingQuickContact] = useState(false);
  const [companyConfig, setCompanyConfig] = useState<RestorationCompany | null>(null);

  // Search state for contact linking
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');

  const [transferLines, setTransferLines] = useState({
    primary: '',
    secondary: '',
    third: ''
  });

  const [directory, setDirectory] = useState<Array<{ name: string; phone: string }>>([
    { name: '', phone: '' }, { name: '', phone: '' }, { name: '', phone: '' },
    { name: '', phone: '' }, { name: '', phone: '' }, { name: '', phone: '' }
  ]);

  const [newContactForm, setNewContactForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', type: ContactType.STAFF
  });

  const [newTechForm, setNewTechForm] = useState({
    name: '', phone: '', email: '', role: Role.LEAD, addToEmergency: true, addToInspection: true
  });

  const [localSchedule, setLocalSchedule] = useState<DaySchedule[]>([]);
  const [localPriorityNum, setLocalPriorityNum] = useState<number>(1);
  const [localRole, setLocalRole] = useState<Role>(Role.LEAD);
  const [localOverride, setLocalOverride] = useState<'None' | 'Force Active' | 'Force Off Duty'>('None');

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await (await import('../lib/supabase.ts')).supabase.auth.getUser();
        if (user) {
          const { data: profile } = await (await import('../lib/supabase.ts')).supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();
          
          if (profile?.company_id) {
            const [techData, configData, contactData] = await Promise.all([
              fetchTechniciansFromSupabase(profile.company_id),
              fetchCompanySettings(profile.company_id),
              fetchContactsFromSupabase(profile.company_id)
            ]);
            setTechnicians(techData);
            setContacts(contactData);
            if (configData) {
              setCompanyConfig(configData);
              setTransferLines({
                primary: configData.transferPrimary || '',
                secondary: configData.transferSecondary || '',
                third: configData.transferThird || ''
              });
              
              const slots = [
                { name: configData.transfer_1_name || '', phone: configData.transfer_1_phone || '' },
                { name: configData.transfer_2_name || '', phone: configData.transfer_2_phone || '' },
                { name: configData.transfer_3_name || '', phone: configData.transfer_3_phone || '' },
                { name: configData.transfer_4_name || '', phone: configData.transfer_4_phone || '' },
                { name: configData.transfer_5_name || '', phone: configData.transfer_5_phone || '' },
                { name: configData.transfer_6_name || '', phone: configData.transfer_6_phone || '' }
              ];
              setDirectory(slots);
            }
          }
        }
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    if (menuOpenId) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [menuOpenId]);

  const filteredDirectoryContacts = useMemo(() => {
    if (!directorySearch) return contacts.slice(0, 10);
    return contacts.filter(c => 
      c.name?.toLowerCase().includes(directorySearch.toLowerCase()) || 
      c.phone?.includes(directorySearch)
    ).slice(0, 10);
  }, [contacts, directorySearch]);

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
    const schedule = rosterView === 'emergency' ? tech.emergencySchedule : tech.inspectionSchedule;
    setLocalSchedule(schedule);
    setLocalPriorityNum(rosterView === 'emergency' ? tech.emergencyPriorityNumber : tech.inspectionPriorityNumber);
    setLocalRole(tech.role);
    setLocalOverride(schedule[0]?.override || 'None');
  };

  /**
   * Final optimized delete handler.
   */
  const handleDeleteTech = async (e: React.MouseEvent, techId: string) => {
    e.stopPropagation();
    
    // Close the menu immediately to ensure clean UI state
    setMenuOpenId(null);

    const techName = technicians.find(t => t.id === techId)?.name || "this technician";
    
    if (!window.confirm(`PERMANENT ACTION: Are you sure you want to completely remove ${techName} from the dispatch roster? This will also purge their schedules and CRM profile.`)) {
      return;
    }
    
    setIsSyncing(true);
    try {
      // 1. Permanent Removal from Supabase
      await deleteTechnicianFromSupabase(techId);
      
      // 2. React state filter to remove from UI
      setTechnicians(prev => prev.filter(t => t.id !== techId));
      
      console.log(`Success: Technician ${techId} removed from master roster.`);
    } catch (err: any) {
      console.error("Deletion lifecycle failure:", err);
      alert(`System Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateProtocol = async () => {
    if (!companyConfig) return;
    setIsSyncing(true);
    try {
      const updatedConfig: RestorationCompany = {
        ...companyConfig,
        transferPrimary: transferLines.primary,
        transferSecondary: transferLines.secondary,
        transferThird: transferLines.third,
        transfer_1_name: directory[0].name, transfer_1_phone: directory[0].phone,
        transfer_2_name: directory[1].name, transfer_2_phone: directory[1].phone,
        transfer_3_name: directory[2].name, transfer_3_phone: directory[2].phone,
        transfer_4_name: directory[4].name, transfer_4_phone: directory[4].phone,
        transfer_5_name: directory[5].name, transfer_5_phone: directory[5].phone,
        transfer_6_name: directory[6].name, transfer_6_phone: directory[6].phone,
      };
      await syncCompanySettingsToSupabase(updatedConfig);
      setCompanyConfig(updatedConfig);
      alert('Call Transfer Protocol deployed successfully!');
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const linkContactToDirectory = (idx: number, contact: Contact) => {
    const newDir = [...directory];
    newDir[idx] = { name: contact.firstName || contact.name.split(' ')[0], phone: contact.phone };
    setDirectory(newDir);
    setActiveSearchIdx(null);
    setDirectorySearch('');
  };

  const handleCreateQuickContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyConfig || activeSearchIdx === null) return;
    setIsSyncing(true);
    try {
      const newContact: Contact = {
        id: `con-${Date.now()}`,
        name: `${newContactForm.firstName} ${newContactForm.lastName}`,
        firstName: newContactForm.firstName,
        lastName: newContactForm.lastName,
        phone: newContactForm.phone,
        email: newContactForm.email,
        type: newContactForm.type,
        address: 'N/A',
        tags: ['Transfer Contact'],
        pipelineStage: 'Inbound',
        lastActivity: 'Just added',
        customFields: {}
      };
      await syncContactToSupabase(newContact, companyConfig.id);
      setContacts(prev => [newContact, ...prev]);
      linkContactToDirectory(activeSearchIdx, newContact);
      setIsAddingQuickContact(false);
      setNewContactForm({ firstName: '', lastName: '', phone: '', email: '', type: ContactType.STAFF });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTechSettings = async () => {
    if (!editingTech) return;
    setIsSyncing(true);
    const isEmergency = rosterView === 'emergency';
    const sameRoleTechs = technicians.filter(t => t.role === localRole);
    const techStates = sameRoleTechs.map(t => ({ id: t.id, rank: t.id === editingTech.id ? localPriorityNum : (isEmergency ? t.emergencyPriorityNumber : t.inspectionPriorityNumber) }));
    techStates.sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : a.id === editingTech.id ? -1 : 1);
    const rankMap = new Map();
    let currentSequence = 1;
    techStates.forEach(ts => rankMap.set(ts.id, ts.rank < 99 ? currentSequence++ : 99));
    const finalSchedule = localSchedule.map(s => ({ ...s, override: localOverride }));
    try {
      const finalR = rankMap.get(editingTech.id);
      const label = finalR === 99 ? 'None' : `${finalR}${finalR === 1 ? 'st' : finalR === 2 ? 'nd' : finalR === 3 ? 'rd' : 'th'} Priority`;
      await syncTechnicianToSupabase({ ...editingTech, role: localRole, emergencyPriority: isEmergency ? label : editingTech.emergencyPriority, inspectionPriority: !isEmergency ? label : editingTech.inspectionPriority, emergencyPriorityNumber: isEmergency ? finalR : editingTech.emergencyPriorityNumber, inspectionPriorityNumber: !isEmergency ? finalR : editingTech.inspectionPriorityNumber });
      await syncScheduleToSupabase(editingTech.id, finalSchedule);
      const updatedTechs = technicians.map(t => {
        if (t.id === editingTech.id) return { ...t, role: localRole, [isEmergency ? 'emergencySchedule' : 'inspectionSchedule']: finalSchedule, [isEmergency ? 'emergencyPriority' : 'inspectionPriority']: label, [isEmergency ? 'emergencyPriorityNumber' : 'inspectionPriorityNumber']: finalR };
        if (rankMap.has(t.id)) {
            const r = rankMap.get(t.id);
            const l = r === 99 ? 'None' : `${r}${r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th'} Priority`;
            return { ...t, [isEmergency ? 'emergencyPriority' : 'inspectionPriority']: l, [isEmergency ? 'emergencyPriorityNumber' : 'inspectionPriorityNumber']: r };
        }
        return t;
      });
      setTechnicians(updatedTechs);
      setEditingTech(null);
    } catch (err: any) { alert(err.message); } finally { setIsSyncing(false); }
  };

  const handleCreateNewTech = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Explicit validation before syncing
    if (!newTechForm.name?.trim() || !newTechForm.phone?.trim()) {
      alert("Technician Name and Phone are required.");
      return;
    }

    if (!companyConfig) {
      alert("System Error: Company configuration not loaded. Please try again or refresh.");
      return;
    }

    setIsSyncing(true);
    try {
      const newId = `T-${Date.now()}`;
      const newTech: Technician = { 
        id: newId, 
        name: newTechForm.name, 
        phone: formatPhoneNumberInput(newTechForm.phone), 
        email: newTechForm.email, 
        role: newTechForm.role, 
        clientId: companyConfig.id, 
        emergencyPriority: "1st Priority", 
        emergencyPriorityNumber: 1, 
        emergencyStatus: Status.ACTIVE, 
        emergencySchedule: [...DEFAULT_SCHEDULE], 
        inspectionPriority: "1st Priority", 
        inspectionPriorityNumber: 1, 
        inspectionStatus: InspectionStatus.AVAILABLE, 
        inspectionSchedule: [...DEFAULT_SCHEDULE] 
      };
      
      await syncTechnicianToSupabase(newTech);
      await syncScheduleToSupabase(newTech.id, DEFAULT_SCHEDULE);
      
      setTechnicians(prev => [...prev, newTech]);
      setIsAddingTech(false);
      setNewTechForm({ name: '', phone: '', email: '', role: Role.LEAD, addToEmergency: true, addToInspection: true });
    } catch (err: any) { 
      alert(`Onboarding Error: ${err.message}`); 
    } finally { 
      setIsSyncing(false); 
    }
  };

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
                    <button onClick={() => handleOpenSettings(tech)} className={`inline-flex items-center gap-3 px-5 py-2 rounded-full text-[10px] font-black border uppercase tracking-[0.15em] transition-all hover:ring-4 active:scale-95 ${duty.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:ring-emerald-100/50' : 'bg-slate-100 text-slate-500 border-slate-200 hover:ring-slate-200/50'}`}><div className={`w-2 h-2 rounded-full ${duty.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>{duty.status}</button>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <button onClick={() => handleOpenSettings(tech)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 active:scale-95 shadow-sm border ${rosterView === 'emergency' ? 'bg-blue-700 text-white border-blue-100' : 'bg-emerald-700 text-white border-emerald-100'}`}>{priorityStr?.split(' ')[0] || 'Unranked'}</button>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => handleOpenSettings(tech)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm"><CalendarDays size={18} /></button>
                      
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === tech.id ? null : tech.id);
                          }}
                          className={`p-3 rounded-xl transition-all ${menuOpenId === tech.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {menuOpenId === tech.id && (
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-2 animate-in zoom-in-95 duration-200 text-left">
                            <button 
                              onClick={() => handleOpenSettings(tech)}
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-all text-[11px] font-black uppercase tracking-widest"
                            >
                              <CalendarDays size={16} className="text-slate-400" /> Availability
                            </button>
                            <button 
                              onClick={(e) => handleDeleteTech(e, tech.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all text-[11px] font-black uppercase tracking-widest"
                            >
                              <Trash2 size={16} /> Delete Tech
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={4} className="px-10 py-16 text-center"><div className="flex flex-col items-center justify-center opacity-30"><Users size={48} className="mb-4 text-slate-300" /><p className="font-black text-xs uppercase tracking-widest text-slate-400">No {title.toLowerCase()} configured.</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" /><p className="font-black text-xs uppercase tracking-[0.3em]">Syncing with Supabase Cluster...</p></div>;

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 text-slate-900">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 w-fit">
          <button onClick={() => setActiveSubTab('technicians')} className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-base font-bold transition-all ${activeSubTab === 'technicians' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}><Users size={22} /> Technician Roster</button>
          <button onClick={() => setActiveSubTab('logs')} className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-base font-bold transition-all ${activeSubTab === 'logs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}><History size={22} /> Dispatch Logs</button>
          <button onClick={() => setActiveSubTab('routing')} className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-base font-bold transition-all ${activeSubTab === 'routing' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}><PhoneForwarded size={22} /> Call Transferring</button>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-3 px-6 py-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl"><div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></div><div className="flex flex-col"><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">DB Status: Active</span><span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">Sync: {lastSyncTime}</span></div></div>
           <button onClick={onOpenSettings} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95"><Settings size={20} /> Dispatch Settings</button>
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
            {renderTechTable(technicians.filter(t => [Role.OWNER, Role.MANAGER, Role.SUPPORT].includes(t.role) && (rosterView === 'emergency' ? t.emergencyPriority !== 'None' : t.inspectionPriority !== 'None')), 'Staff & Management')}
          </div>
        </div>
      )}

      {activeSubTab === 'routing' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Call Transfer Protocol</h3>
                <p className="text-sm font-bold text-slate-400 mt-1">Dedicated lines for AI-initiated handoffs.</p>
              </div>
              <button onClick={handleUpdateProtocol} disabled={isSyncing} className="flex items-center gap-3 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">{isSyncing ? <RefreshCw className="animate-spin" size={20} /> : <CircleCheck size={20} />}{isSyncing ? 'Syncing...' : 'Update Protocol'}</button>
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
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100"><Phone size={18} /></div>
                    <input type="text" value={line.value} onChange={(e) => setTransferLines({...transferLines, [line.id]: formatPhoneNumberInput(e.target.value)})} className="bg-transparent border-none outline-none font-black text-lg text-slate-800 w-full" placeholder="(555) 555-5555" /><Edit2 size={16} className="text-slate-200" />
                  </div>
                </div>
              ))}
           </div>

           <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-10 space-y-8 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm"><Users size={24} /></div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Named Transfer Directory</h4>
                    <p className="text-sm italic font-bold text-slate-400 tracking-tight">"Transfer me to [Name]" - Synced with CRM</p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-slate-900 rounded-xl text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse"><Bot size={12} /> AI Directory Ready</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                {directory.map((entry, idx) => (
                  <div key={idx} className="bg-slate-50/30 p-8 rounded-[2.5rem] border border-slate-100 relative group transition-all duration-300 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/40">
                    <span className="absolute top-6 right-8 text-5xl font-black text-slate-100 pointer-events-none">{idx + 1}</span>
                    <div className="space-y-6">
                      <div className="relative">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Link CRM Contact</label>
                        <div className="relative group/search">
                           <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                           <input 
                             type="text" 
                             placeholder="Search Names..." 
                             onFocus={() => setActiveSearchIdx(idx)}
                             onChange={(e) => {
                               setDirectorySearch(e.target.value);
                               const newDir = [...directory];
                               newDir[idx].name = e.target.value;
                               setDirectory(newDir);
                             }}
                             value={entry.name}
                             className="w-full pl-10 pr-5 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm font-black text-slate-800 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all shadow-sm"
                           />
                           {activeSearchIdx === idx && (
                             <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] max-h-60 overflow-y-auto p-2 scrollbar-hide animate-in zoom-in-95 duration-200">
                                <div className="p-2 border-b border-slate-50 flex items-center justify-between mb-2">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Global CRM Match</span>
                                  <button onClick={(e) => { e.stopPropagation(); setIsAddingQuickContact(true); }} className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-600 hover:text-white transition-all">Add New Contact</button>
                                </div>
                                {filteredDirectoryContacts.map(c => (
                                  <button key={c.id} onClick={() => linkContactToDirectory(idx, c)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-blue-50 text-left transition-all">
                                    <div><p className="text-xs font-black text-slate-800">{c.name}</p><p className="text-[9px] font-bold text-slate-400">{c.phone}</p></div>
                                    <UserCheck size={14} className="text-slate-200 group-hover:text-blue-600" />
                                  </button>
                                ))}
                                {filteredDirectoryContacts.length === 0 && <p className="p-4 text-center text-[9px] font-bold text-slate-400">No contact found. Create one above.</p>}
                             </div>
                           )}
                        </div>
                      </div>
                      <div className="relative">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Transfer Line</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input 
                            type="text" 
                            placeholder="(555) 555-5555"
                            value={entry.phone}
                            onChange={(e) => {
                              const newDir = [...directory];
                              newDir[idx].phone = formatPhoneNumberInput(e.target.value);
                              setDirectory(newDir);
                            }}
                            className="w-full pl-10 pr-5 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm font-black text-slate-800 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all shadow-sm"
                          />
                        </div>
                      </div>
                      {entry.name && (
                         <button onClick={() => { const newDir = [...directory]; newDir[idx] = {name:'', phone:''}; setDirectory(newDir); }} className="w-full py-2 bg-slate-50 text-[8px] font-black text-slate-300 uppercase tracking-widest rounded-xl hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2"><Trash2 size={10} /> Clear Connection</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {activeSearchIdx !== null && <div className="fixed inset-0 z-50" onClick={() => setActiveSearchIdx(null)}></div>}
           </div>
        </div>
      )}

      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><History className="text-slate-400" /> Sarah AI Event Log</h3></div>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 bg-slate-50/30"><th className="px-8 py-5">Timestamp</th><th className="px-8 py-5">Job Details</th><th className="px-8 py-5">Dispatch Action</th><th className="px-8 py-5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{MOCK_DISPATCH_LOGS.map(log => (<tr key={log.id} className="hover:bg-slate-50/30 transition-colors"><td className="px-8 py-6 text-xs font-bold text-slate-500">{log.timestamp}</td><td className="px-8 py-6"><p className="text-sm font-black text-slate-800">{log.lossType}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{log.clientName}</p></td><td className="px-8 py-6"><p className="text-sm font-black text-blue-600">{log.assignedTech}</p><p className="text-[10px] italic text-slate-400">"{log.aiSummary}"</p></td><td className="px-8 py-6"><span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-200">{log.status}</span></td></tr>))}</tbody></table></div>
        </div>
      )}

      {isAddingQuickContact && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24} /></div><h3 className="text-xl font-black uppercase tracking-tight">Quick CRM Add</h3></div><button onClick={() => setIsAddingQuickContact(false)} className="p-3 hover:bg-white/10 rounded-full"><X size={28} /></button></div>
              <form onSubmit={handleCreateQuickContact} className="p-10 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="First Name" value={newContactForm.firstName} onChange={e => setNewContactForm({...newContactForm, firstName: e.target.value})} className="px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                  <input required placeholder="Last Name" value={newContactForm.lastName} onChange={e => setNewContactForm({...newContactForm, lastName: e.target.value})} className="px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                  <input required placeholder="Phone" value={newContactForm.phone} onChange={e => setNewContactForm({...newContactForm, phone: formatPhoneNumberInput(e.target.value)})} className="col-span-2 px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                  <input required placeholder="Email" value={newContactForm.email} onChange={e => setNewContactForm({...newContactForm, email: e.target.value})} className="col-span-2 px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                </div>
                <button type="submit" disabled={isSyncing} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3">{isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />} Create & Link Contact</button>
              </form>
           </div>
        </div>
      )}

      {isAddingTech && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24} /></div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Onboard Team Member</h3>
                 </div>
                 <button onClick={() => setIsAddingTech(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
              </div>
              <form onSubmit={handleCreateNewTech} className="p-10 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                    <input required type="text" placeholder="Member Name" value={newTechForm.name} onChange={e => setNewTechForm({...newTechForm, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Cell Phone</label>
                      <input required type="text" placeholder="(555) 555-5555" value={newTechForm.phone} onChange={e => setNewTechForm({...newTechForm, phone: formatPhoneNumberInput(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
                      <input type="email" placeholder="tech@company.com" value={newTechForm.email} onChange={e => setNewTechForm({...newTechForm, email: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Company Role</label>
                    <select value={newTechForm.role} onChange={e => setNewTechForm({...newTechForm, role: e.target.value as Role})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-4 focus:ring-blue-600/5 transition-all cursor-pointer">
                      <option value={Role.LEAD}>Lead Technician</option>
                      <option value={Role.ASSISTANT}>Assistant Technician</option>
                      <option value={Role.OWNER}>Owner</option>
                      <option value={Role.MANAGER}>Manager</option>
                      <option value={Role.SUPPORT}>Support / Admin</option>
                    </select>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                    <Info size={16} className="text-blue-500" />
                    <p className="text-[10px] font-bold text-blue-700 leading-tight">This member will automatically be added as a 'Team Member' contact for internal messaging.</p>
                  </div>
                </div>
                <button type="submit" disabled={isSyncing} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                  {isSyncing ? <RefreshCw className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  {isSyncing ? 'Creating...' : 'Sync Member & Contact'}
                </button>
              </form>
           </div>
        </div>
      )}

      {editingTech && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center"><div className="flex items-center gap-6"><div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl">{editingTech.name?.split(' ').map(n => n[0]).join('') || '??'}</div><div><h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{editingTech.name}</h3><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Settings for {rosterView} Mode</p></div></div><button onClick={() => setEditingTech(null)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button></div>
            <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide bg-slate-50/50"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Status Override</label><div className="space-y-2">{['None', 'Force Active', 'Force Off Duty'].map(over => (<button key={over} onClick={() => setLocalOverride(over as any)} className={`w-full flex items-center justify-between px-5 py-3 rounded-2xl text-xs font-black transition-all border ${localOverride === over ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'}`}>{over === 'None' ? 'Follow Schedule' : over}{localOverride === over && <Check size={16} />}</button>))}</div></div><div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority Ranking</label><div className="grid grid-cols-2 gap-2">{[1, 2, 3, 4, 5, 6].map(num => (<button key={num} onClick={() => setLocalPriorityNum(num)} className={`py-3 rounded-2xl text-xs font-black transition-all border ${localPriorityNum === num ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'}`}>{num}{num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'} Slot</button>))}</div></div><div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Role</label><div className="space-y-2">{Object.values(Role).map(role => (<button key={role} onClick={() => setLocalRole(role)} className={`w-full flex items-center justify-between px-5 py-3 rounded-2xl text-xs font-black transition-all border ${localRole === role ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'}`}>{role} Technician{localRole === role && <Check size={16} />}</button>))}</div></div></div><div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden"><div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Calendar size={18} /> Weekly Availability Matrix</h4><p className="text-[10px] font-bold text-slate-400">Sarah AI will only dispatch during enabled hours.</p></div><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400"><th className="px-8 py-4">Day</th><th className="px-8 py-4">Status</th><th className="px-8 py-4">Shift Start</th><th className="px-8 py-4">Shift End</th><th className="px-8 py-4 text-center">24h Shift</th></tr></thead><tbody className="divide-y divide-slate-50">{localSchedule.map((s, idx) => (<tr key={s.day} className={s.enabled ? 'bg-white' : 'bg-slate-50/50'}><td className="px-8 py-5 font-black text-slate-800 text-sm">{s.day}</td><td className="px-8 py-5"><button onClick={() => { const newSched = [...localSchedule]; newSched[idx].enabled = !newSched[idx].enabled; setLocalSchedule(newSched); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${s.enabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500'}`}>{s.enabled ? 'Enabled' : 'Disabled'}</button></td><td className="px-8 py-5"><select disabled={!s.enabled || s.is24Hours} value={s.start} onChange={(e) => { const newSched = [...localSchedule]; newSched[idx].start = e.target.value; setLocalSchedule(newSched); }} className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-30 cursor-pointer">{TIME_SLOTS.map(t => <option key={t} value={t} className="text-slate-900">{t}</option>)}</select></td><td className="px-8 py-5"><select disabled={!s.enabled || s.is24Hours} value={s.end} onChange={(e) => { const newSched = [...localSchedule]; newSched[idx].end = e.target.value; setLocalSchedule(newSched); }} className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-30 cursor-pointer">{TIME_SLOTS.map(t => <option key={t} value={t} className="text-slate-900">{t}</option>)}</select></td><td className="px-8 py-5 text-center"><button disabled={!s.enabled} onClick={() => { const newSched = [...localSchedule]; newSched[idx].is24Hours = !newSched[idx].is24Hours; setLocalSchedule(newSched); }} className={`w-10 h-6 rounded-full relative transition-all ${s.is24Hours ? 'bg-blue-600' : 'bg-slate-200'} ${!s.enabled ? 'opacity-30' : ''}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${s.is24Hours ? 'left-5' : 'left-1'}`}></div></button></td></tr>))}</tbody></table></div></div></div>
            <div className="px-10 py-8 bg-white border-t border-slate-100 flex items-center justify-between"><button onClick={() => setEditingTech(null)} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancel Changes</button><button onClick={handleSaveTechSettings} disabled={isSyncing} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-3 disabled:opacity-50">{isSyncing ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}{isSyncing ? 'Syncing...' : 'Deploy & Re-Rank Team'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchScheduling;
