
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ChevronDown, 
  Building2, 
  Bell, 
  MapPin, 
  Save,
  Check,
  User,
  Zap,
  RefreshCw,
  Plus,
  Trash2,
  PlusCircle,
  Clock,
  ShieldCheck,
  History,
  Users,
  BellRing,
  AlertTriangle,
  Globe,
  Calendar,
  BellRing as BellIcon,
  Search,
  UserCheck,
  Smartphone,
  Mail,
  Crown,
  Link as LinkIcon,
  Edit3,
  UserPlus,
  CheckCircle2,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { SERVICE_OPTIONS, TIMEZONES } from '../constants';
import { Contact, ContactType, DispatchStrategy, NotificationPreference, RestorationCompany, Role } from '../types';
import { syncCompanySettingsToSupabase, fetchContactsFromSupabase, syncContactToSupabase } from '../lib/supabase.ts';
import { formatPhoneNumberInput, toDisplay } from '../utils/phoneUtils.ts';

interface ManageAccountProps {
  isOpen: boolean;
  onClose: () => void;
  companySettings: RestorationCompany;
  onSettingsUpdate: (settings: RestorationCompany) => void;
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

const ManageAccount: React.FC<ManageAccountProps> = ({ isOpen, onClose, companySettings, onSettingsUpdate }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('business');
  const [settings, setSettings] = useState<RestorationCompany>(companySettings);
  const [isSaving, setIsSaving] = useState(false);
  
  // CRM Linkage State
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [isSearchingOwnerIdx, setIsSearchingOwnerIdx] = useState<number | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [isCreatingNewRecipient, setIsCreatingNewRecipient] = useState<number | null>(null);
  const [newRecipientForm, setNewRecipientForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    setSettings(companySettings);
    if (isOpen) {
      loadContacts();
    }
  }, [companySettings, isOpen]);

  const loadContacts = async () => {
    try {
      const fetched = await fetchContactsFromSupabase(companySettings.id);
      setAllContacts(fetched);
    } catch (err) {
      console.error("Failed to load contacts for linkage:", err);
    }
  };

  const filteredTeamContacts = useMemo(() => {
    return allContacts.filter(c => 
      c.type === ContactType.STAFF && // Only allow Team Members
      (c.name?.toLowerCase().includes(ownerSearchQuery.toLowerCase()) || c.phone?.includes(ownerSearchQuery))
    );
  }, [allContacts, ownerSearchQuery]);

  if (!isOpen) return null;

  const sections = [
    { id: 'business', title: 'Business Settings', icon: <Building2 size={20} /> },
    { id: 'dispatch', title: 'Dispatch & Scheduling Logic', icon: <Zap size={20} /> },
    { id: 'owners', title: 'Management Notifications', icon: <Users size={20} /> },
    { id: 'service', title: 'Service Area & Coverage', icon: <Globe size={20} /> },
  ];

  const handleToggleService = (service: string) => {
    if (!service) return;
    setSettings(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleAddOwner = () => {
    setSettings(prev => ({
      ...prev,
      owners: [...prev.owners, { name: '', phone: '', email: '' }]
    }));
    setIsSearchingOwnerIdx(settings.owners.length);
  };

  const handleRemoveOwner = async (index: number) => {
    const ownerToRemove = settings.owners[index];
    
    // Remove the 'Alert Recipient' tag from the master contact record
    const masterContact = allContacts.find(c => c.phone === ownerToRemove.phone || c.email === ownerToRemove.email);
    
    if (masterContact) {
      const updatedContact = {
        ...masterContact,
        tags: (masterContact.tags || []).filter(t => t !== 'Alert Recipient')
      };
      
      try {
        await syncContactToSupabase(updatedContact, settings.id);
        setAllContacts(prev => prev.map(c => c.id === masterContact.id ? updatedContact : c));
      } catch (err) {
        console.error("Failed to remove Alert Recipient tag:", err);
      }
    }

    if (settings.owners.length <= 1) {
      const updatedOwners = [...settings.owners];
      updatedOwners[0] = { name: '', phone: '', email: '' };
      setSettings({ ...settings, owners: updatedOwners });
      return;
    }
    setSettings(prev => ({
      ...prev,
      owners: prev.owners.filter((_, i) => i !== index)
    }));
  };

  const handleLinkContact = async (index: number, contact: Contact) => {
    // Add 'Alert Recipient' tag to contact, preserve existing role
    const updatedContact = {
      ...contact,
      tags: contact.tags?.includes('Alert Recipient') 
        ? (contact.tags || []) 
        : [...(contact.tags || []), 'Alert Recipient']
    };

    try {
      await syncContactToSupabase(updatedContact, settings.id);
      setAllContacts(prev => prev.map(c => c.id === contact.id ? updatedContact : c));
    } catch (err) {
      console.error("Failed to sync linked contact tags:", err);
    }

    const updatedOwners = [...settings.owners];
    updatedOwners[index] = { name: contact.name, phone: contact.phone, email: contact.email };
    setSettings({ ...settings, owners: updatedOwners });
    setIsSearchingOwnerIdx(null);
    setOwnerSearchQuery('');
  };

  const handleSilentOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingNewRecipient === null) return;
    
    setIsSaving(true);
    try {
      const names = newRecipientForm.name.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '(Recipient)';
      
      const newContact: Contact = {
        id: `con-alert-${Date.now()}`,
        name: newRecipientForm.name,
        firstName,
        lastName,
        phone: formatPhoneNumberInput(newRecipientForm.phone),
        email: newRecipientForm.email,
        type: ContactType.STAFF,
        role: Role.SUPPORT, // Default staff role, not manager
        tags: ['Alert Recipient'], // Only 'Alert Recipient' tag as requested
        vipStatus: true,
        address: 'Internal Stakeholder',
        pipelineStage: 'Inbound',
        lastActivity: 'Added via Settings',
        customFields: {}
      };

      await syncContactToSupabase(newContact, settings.id);
      setAllContacts(prev => [newContact, ...prev]);
      
      const updatedOwners = [...settings.owners];
      updatedOwners[isCreatingNewRecipient] = { 
        name: newContact.name, 
        phone: newContact.phone, 
        email: newContact.email 
      };
      
      setSettings({ ...settings, owners: updatedOwners });
      setIsCreatingNewRecipient(null);
      setIsSearchingOwnerIdx(null);
      setNewRecipientForm({ name: '', phone: '', email: '' });
    } catch (err: any) {
      alert(`Onboarding failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await syncCompanySettingsToSupabase(settings);
      onSettingsUpdate(settings);
      alert('Settings successfully deployed to Sarah AI.');
      onClose();
    } catch (err: any) {
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col border border-white/20 text-slate-900">
        
        <div className="px-10 py-8 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/30">
              <Building2 size={24} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Manage Account</h2>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-all active:scale-90">
            <X size={28} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-slate-50/50 scrollbar-hide">
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden transition-all duration-500">
              <button 
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full px-8 py-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className={`${expandedSection === section.id ? 'text-blue-600' : 'text-slate-400'}`}>
                    {section.icon}
                  </span>
                  <span className="font-black text-slate-800 uppercase tracking-widest text-[11px]">{section.title}</span>
                </div>
                <ChevronDown 
                  className={`text-slate-300 transition-transform duration-500 ${expandedSection === section.id ? 'rotate-180' : ''}`} 
                  size={20} 
                />
              </button>

              {expandedSection === section.id && (
                <div className="px-10 pb-10 pt-2 border-t border-slate-50 animate-in slide-in-from-top-4 duration-500">
                  
                  {section.id === 'business' && (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Company Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={settings.name}
                          onChange={(e) => setSettings({...settings, name: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none text-slate-800 font-bold transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Agent Name <span className="text-red-500">*</span></label>
                          <input 
                            type="text" 
                            value={settings.agentName}
                            onChange={(e) => setSettings({...settings, agentName: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none text-slate-800 font-bold transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Agent Phone Number</label>
                          <p className="px-2 py-3 font-black text-blue-600 text-xl tracking-tighter">{settings.agentPhone1}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">List Your Services <span className="text-red-500">*</span></label>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {settings.services.map(s => (
                            <span key={s} className="flex items-center gap-3 px-5 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                              {s}
                              <button onClick={() => handleToggleService(s)} className="hover:text-red-400 transition-colors"><X size={14} /></button>
                            </span>
                          ))}
                        </div>
                        <select 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-black text-sm cursor-pointer hover:bg-slate-100 transition-all shadow-inner"
                          onChange={(e) => { handleToggleService(e.target.value); e.target.value = ""; }}
                        >
                          <option value="">Select services to add...</option>
                          {SERVICE_OPTIONS.filter(o => !settings.services.includes(o)).map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {section.id === 'dispatch' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">Dispatch Strategy <span className="text-red-500">*</span></label>
                          <div className="space-y-3">
                            {[DispatchStrategy.BROADCAST, DispatchStrategy.CASCADING].map((strat) => (
                              <label key={strat} className={`flex items-center gap-4 p-5 rounded-[1.5rem] cursor-pointer border-2 transition-all ${settings.dispatchStrategy === strat ? 'border-blue-600 bg-blue-50/50 shadow-inner' : 'border-slate-100 bg-slate-50 hover:border-blue-200'}`}>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${settings.dispatchStrategy === strat ? 'border-blue-600' : 'border-slate-300'}`}>
                                  {settings.dispatchStrategy === strat && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                                </div>
                                <input type="radio" className="hidden" name="strategy" checked={settings.dispatchStrategy === strat} onChange={() => setSettings({...settings, dispatchStrategy: strat})} />
                                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{strat}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">Timezone <span className="text-red-500">*</span></label>
                          <select 
                            value={settings.timezone}
                            onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-black text-sm"
                          >
                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1 flex items-center gap-2">
                          <BellIcon size={14} className="text-blue-600" />
                          Emergency Protocol Team SMS Notification Preference
                        </label>
                        <select 
                          value={settings.notificationPreference}
                          onChange={(e) => setSettings({...settings, notificationPreference: e.target.value as NotificationPreference})}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-black text-sm cursor-pointer hover:bg-slate-100 transition-all shadow-inner"
                        >
                          {Object.values(NotificationPreference).map(pref => (
                            <option key={pref} value={pref}>{pref}</option>
                          ))}
                        </select>
                        <p className="text-[9px] font-bold text-slate-400 italic px-1">This setting controls which technicians receive an SMS broadcast when a new job is initialized by Sarah AI.</p>
                      </div>

                      <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 space-y-6">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <Calendar className="text-blue-600" size={18} />
                               <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Master Inspection Availability</h4>
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase italic">Sarah AI Booking Window</p>
                         </div>
                         <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                               <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                  <tr>
                                     <th className="px-6 py-3">Day</th>
                                     <th className="px-6 py-3">Status</th>
                                     <th className="px-6 py-3">Hours</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                  {settings.inspectionSchedule.map((s, idx) => (
                                     <tr key={s.day} className={s.enabled ? 'bg-white' : 'bg-slate-50/50 opacity-60'}>
                                        <td className="px-6 py-4 font-black text-slate-800 text-xs">{s.day}</td>
                                        <td className="px-6 py-4">
                                           <button 
                                              onClick={() => {
                                                 const newSched = [...settings.inspectionSchedule];
                                                 newSched[idx].enabled = !newSched[idx].enabled;
                                                 setSettings({...settings, inspectionSchedule: newSched});
                                              }}
                                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${s.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                                           >
                                              {s.enabled ? 'Open' : 'Closed'}
                                           </button>
                                        </td>
                                        <td className="px-6 py-4 flex items-center gap-2">
                                           <select 
                                              disabled={!s.enabled}
                                              value={s.start}
                                              onChange={(e) => {
                                                 const newSched = [...settings.inspectionSchedule];
                                                 newSched[idx].start = e.target.value;
                                                 setSettings({...settings, inspectionSchedule: newSched});
                                              }}
                                              className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-30"
                                           >
                                              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                           </select>
                                           <span className="text-[10px] font-black text-slate-300">-</span>
                                           <select 
                                              disabled={!s.enabled}
                                              value={s.end}
                                              onChange={(e) => {
                                                 const newSched = [...settings.inspectionSchedule];
                                                 newSched[idx].end = e.target.value;
                                                 setSettings({...settings, inspectionSchedule: newSched});
                                              }}
                                              className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-30"
                                           >
                                              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                           </select>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </div>

                      <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-200 space-y-4 shadow-sm">
                         <div className="flex items-center gap-3">
                           <AlertTriangle className="text-red-600" size={20} />
                           <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">CRITICAL: Emergency Response Protocol</h4>
                         </div>
                         <div className="bg-white p-6 rounded-2xl border border-red-100 flex items-center justify-between gap-6 shadow-inner">
                            <div className="flex-1">
                               <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">On-Site Response Time (Minutes)</label>
                               <p className="text-[10px] font-bold text-slate-400 italic leading-tight">This ETA will be quoted by Sarah AI to every emergency caller. Set this to your fastest reliable arrival time.</p>
                            </div>
                            <input 
                               type="number" 
                               value={settings.onsiteResponseMinutes} 
                               onChange={(e) => setSettings({...settings, onsiteResponseMinutes: parseInt(e.target.value) || 0})} 
                               className="w-32 px-5 py-4 bg-red-50/50 border border-red-100 rounded-2xl outline-none text-red-700 font-black text-center text-xl shadow-sm focus:ring-4 focus:ring-red-600/5 transition-all" 
                            />
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Max Lead Techs</label>
                          <input type="number" value={settings.maxLeadTechs} onChange={(e) => setSettings({...settings, maxLeadTechs: parseInt(e.target.value) || 0})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-black shadow-inner" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Max Assistant Techs</label>
                          <input type="number" value={settings.maxAssistantTechs} onChange={(e) => setSettings({...settings, maxAssistantTechs: parseInt(e.target.value) || 0})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-black shadow-inner" />
                        </div>
                      </div>
                    </div>
                  )}

                  {section.id === 'owners' && (
                    <div className="space-y-8">
                      <div className="flex flex-col gap-2 mb-2 px-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Management Alert Directory</label>
                          <button 
                            onClick={handleAddOwner}
                            className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:text-blue-700 transition-colors"
                          >
                            <PlusCircle size={16} /> Link New Recipient
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed"> Sarah AI will broadcast priority alerts to the assigned identities below. Linked via CRM database.</p>
                      </div>
                      
                      <div className="space-y-6">
                        {settings.owners.map((owner, idx) => {
                          const isAssigned = !!owner.phone;
                          const initials = owner.name ? owner.name.split(' ').map(n => n[0]).join('') : '??';
                          
                          return (
                            <div key={idx} className="relative">
                              {isAssigned ? (
                                <div className="p-8 bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center justify-between group/card hover:border-blue-100 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300">
                                   <div className="flex items-center gap-6">
                                      <div className="w-16 h-16 rounded-[1.5rem] bg-blue-50 border-2 border-blue-100 text-blue-600 flex items-center justify-center font-black text-xl shadow-inner relative">
                                        {initials}
                                        <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1 rounded-full shadow-lg border-2 border-white"><Crown size={12} /></div>
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-3">
                                          <p className="font-black text-slate-800 text-lg tracking-tight leading-none mb-1">{owner.name || 'Unnamed Contact'}</p>
                                          <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Live Link</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                           <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><Smartphone size={10} /> {owner.phone}</div>
                                           <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                           <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><Mail size={10} /> {owner.email}</div>
                                        </div>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-all">
                                      <button onClick={() => setIsSearchingOwnerIdx(idx)} className="p-3 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-white rounded-xl border border-transparent hover:border-blue-100 transition-all shadow-sm" title="Change Contact"><LinkIcon size={18} /></button>
                                      <button onClick={() => handleRemoveOwner(idx)} className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-white rounded-xl border border-transparent hover:border-red-100 transition-all shadow-sm" title="Unlink Alert"><Trash2 size={18} /></button>
                                   </div>
                                </div>
                              ) : (
                                <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50 flex flex-col items-center justify-center text-center group hover:bg-white hover:border-blue-300 transition-all duration-300">
                                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-200 mb-4 shadow-sm group-hover:text-blue-400 transition-colors">
                                      <UserPlus size={24} />
                                   </div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Alert Recipient Slot #{idx + 1} Open</p>
                                   <button 
                                      onClick={() => setIsSearchingOwnerIdx(idx)}
                                      className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:border-blue-600 hover:text-blue-600 shadow-sm transition-all"
                                   >
                                      Link Identity from CRM
                                   </button>
                                </div>
                              )}

                              {isSearchingOwnerIdx === idx && (
                                <div className="absolute top-0 left-0 w-full h-[480px] z-[100] bg-white rounded-[2.5rem] flex flex-col p-8 animate-in zoom-in-95 duration-200 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] border border-slate-200 ring-4 ring-blue-600/5">
                                   <div className="flex items-center justify-between mb-6">
                                      <div className="flex items-center gap-4">
                                         <h5 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3"><LinkIcon size={18} className="text-blue-600" /> CRM Linkage Engine</h5>
                                         <button 
                                            onClick={() => { setIsCreatingNewRecipient(idx); setOwnerSearchQuery(''); }} 
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black uppercase text-[9px] tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                                         >
                                           <UserPlus size={14} /> New Contact
                                         </button>
                                      </div>
                                      <button onClick={() => { setIsSearchingOwnerIdx(null); setOwnerSearchQuery(''); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
                                   </div>
                                   <div className="relative mb-6">
                                      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                      <input 
                                        type="text" 
                                        autoFocus
                                        placeholder="Search entire team directory..." 
                                        value={ownerSearchQuery}
                                        onChange={e => setOwnerSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:ring-8 focus:ring-blue-600/5 transition-all text-sm font-bold shadow-inner"
                                      />
                                   </div>
                                   <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                      {filteredTeamContacts.map(c => (
                                        <button key={c.id} onClick={() => handleLinkContact(idx, c)} className="w-full flex items-center justify-between p-4 rounded-[1.5rem] bg-white border border-slate-100 hover:border-blue-600 hover:bg-blue-50 transition-all text-left shadow-sm group/btn">
                                          <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover/btn:bg-blue-600 group-hover/btn:text-white flex items-center justify-center font-black text-xs transition-colors">{(c.name || '??').split(' ').map(n => n[0]).join('')}</div>
                                            <div>
                                              <p className="text-sm font-black text-slate-800">{c.name}</p>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{c.role || c.type} • {c.phone}</p>
                                            </div>
                                          </div>
                                          <CheckCircle2 size={20} className="text-slate-100 group-hover/btn:text-blue-600 transition-colors" />
                                        </button>
                                      ))}
                                      {filteredTeamContacts.length === 0 && (
                                        <div className="p-16 text-center flex flex-col items-center opacity-40">
                                           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Search size={32} className="text-slate-200" /></div>
                                           <p className="text-sm font-black text-slate-400 uppercase tracking-widest leading-relaxed">No matching identities found <br/> in your current CRM directory.</p>
                                        </div>
                                      )}
                                   </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {section.id === 'service' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Center Zip Code</label>
                          <input type="text" value={settings.centerZipCode} onChange={(e) => setSettings({...settings, centerZipCode: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-black shadow-inner" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Service Mile Radius</label>
                          <input type="number" value={settings.serviceMileRadius} onChange={(e) => setSettings({...settings, serviceMileRadius: parseInt(e.target.value) || 0})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-800 font-black shadow-inner" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Counties / Cities you service</label>
                        <textarea 
                          rows={4}
                          value={settings.serviceAreas} 
                          onChange={(e) => setSettings({...settings, serviceAreas: e.target.value})} 
                          placeholder="e.g. San Luis Obispo, Atascadero, Paso Robles, Santa Maria..."
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none text-slate-800 font-bold shadow-inner resize-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all" 
                        />
                        <p className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">List cities or counties separated by commas.</p>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-10 py-10 bg-white border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-60">* Secure Neural Sync Active</p>
          <div className="flex gap-5">
            <button onClick={onClose} className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 rounded-2xl transition-all active:scale-95">
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-12 py-5 bg-blue-600 text-white font-black uppercase tracking-widest text-[11px] rounded-3xl shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] hover:bg-blue-700 transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
              {isSaving ? 'Deploying...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Forced Onboarding Sub-Modal */}
      {isCreatingNewRecipient !== null && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
           <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 my-auto">
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-600/30"><UserPlus size={32} /></div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">Onboard Alert Recipient</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Silent CRM Identity Creation</p>
                    </div>
                 </div>
                 <button onClick={() => setIsCreatingNewRecipient(null)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button>
              </div>
              <form onSubmit={handleSilentOnboard} className="p-12 space-y-8 bg-slate-50/50">
                 <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name / Title</label>
                      <input required type="text" placeholder="e.g. John Smith (Ops Director)" value={newRecipientForm.name} onChange={e => setNewRecipientForm({...newRecipientForm, name: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-8 focus:ring-blue-600/5 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Cell Phone (SMS Alerts)</label>
                      <input required type="text" placeholder="(555) 555-5555" value={newRecipientForm.phone} onChange={e => setNewRecipientForm({...newRecipientForm, phone: formatPhoneNumberInput(e.target.value)})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-8 focus:ring-blue-600/5 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email (Reports)</label>
                      <input required type="email" placeholder="john@restoration.com" value={newRecipientForm.email} onChange={e => setNewRecipientForm({...newRecipientForm, email: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-8 focus:ring-blue-600/5 transition-all" />
                    </div>
                 </div>
                 <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100 flex items-start gap-4">
                    <Crown size={20} className="text-amber-500 shrink-0" />
                    <p className="text-[10px] font-bold text-blue-700 leading-tight">This recipient will be automatically added as a <span className="font-black">VIP Team Member</span> in your CRM directory.</p>
                 </div>
                 <div className="flex gap-4">
                    <button type="button" onClick={() => setIsCreatingNewRecipient(null)} className="flex-1 py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                       {isSaving ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />} Finalize Identity
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ManageAccount;
