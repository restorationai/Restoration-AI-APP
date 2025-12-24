
import React, { useState, useEffect } from 'react';
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
  Globe
} from 'lucide-react';
import { SERVICE_OPTIONS, TIMEZONES } from '../constants';
import { DispatchStrategy, NotificationPreference, RestorationCompany } from '../types';
import { syncCompanySettingsToSupabase } from '../lib/supabase.ts';
import { formatPhoneNumberInput } from '../utils/phoneUtils.ts';

interface ManageAccountProps {
  isOpen: boolean;
  onClose: () => void;
  companySettings: RestorationCompany;
  onSettingsUpdate: (settings: RestorationCompany) => void;
}

const ManageAccount: React.FC<ManageAccountProps> = ({ isOpen, onClose, companySettings, onSettingsUpdate }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('business');
  const [settings, setSettings] = useState<RestorationCompany>(companySettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSettings(companySettings);
  }, [companySettings]);

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
  };

  const handleRemoveOwner = (index: number) => {
    if (settings.owners.length <= 1) return;
    setSettings(prev => ({
      ...prev,
      owners: prev.owners.filter((_, i) => i !== index)
    }));
  };

  const handleOwnerChange = (index: number, field: string, value: string) => {
    const updatedOwners = [...settings.owners];
    let finalValue = value;
    if (field === 'phone') {
      finalValue = formatPhoneNumberInput(value);
    }
    updatedOwners[index] = { ...updatedOwners[index], [field]: finalValue };
    setSettings({ ...settings, owners: updatedOwners });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = { ...settings };
      // Syncing will internally handle E.164 conversion in lib/supabase.ts
      await syncCompanySettingsToSupabase(payload);
      onSettingsUpdate(payload);
      alert('Settings successfully deployed to Sarah AI.');
      onClose();
    } catch (err: any) {
      console.error('Save failed:', err);
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

                      {/* HIGH VISIBILITY EMERGENCY SECTION */}
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

                      <div className="bg-blue-600/5 p-8 rounded-[2.5rem] border border-blue-600/10 space-y-6">
                         <div className="flex items-center gap-3 mb-2">
                           <Clock className="text-blue-600" size={18} />
                           <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">AI Scheduling Logic (Inspections)</h4>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                               <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Min Scheduling Notice (Hours)</label>
                               <input 
                                 type="number" 
                                 value={settings.minimumSchedulingNotice} 
                                 onChange={(e) => setSettings({...settings, minimumSchedulingNotice: parseInt(e.target.value) ?? 4})}
                                 className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none text-slate-800 font-black shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all" 
                               />
                            </div>
                            <div>
                               <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Appt Buffer Time (Mins)</label>
                               <input 
                                 type="number" 
                                 value={settings.appointmentBufferTime} 
                                 onChange={(e) => setSettings({...settings, appointmentBufferTime: parseInt(e.target.value) ?? 30})}
                                 className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none text-slate-800 font-black shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all" 
                               />
                            </div>
                            <div className="col-span-2">
                               <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Default Inspection Duration (Mins)</label>
                               <input 
                                 type="number" 
                                 value={settings.defaultInspectionDuration} 
                                 onChange={(e) => setSettings({...settings, defaultInspectionDuration: parseInt(e.target.value) ?? 120})}
                                 className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none text-slate-800 font-black shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all" 
                               />
                            </div>
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
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2 mb-2 px-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Management Alert Directory</label>
                          <button 
                            onClick={handleAddOwner}
                            className="flex items-center gap-2 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:text-blue-700 transition-colors"
                          >
                            <PlusCircle size={16} /> Add Recipient
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed">The contacts below receive real-time SMS and Email alerts for new dispatches, job assignments, and Sarah AI activities.</p>
                      </div>
                      
                      <div className="space-y-4">
                        {settings.owners.map((owner, idx) => (
                          <div key={idx} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner relative group/owner transition-all hover:bg-slate-100/50">
                            <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                  <BellRing size={20} />
                                </div>
                                <span className="font-black text-slate-900 text-sm uppercase tracking-tight">Alert Recipient #{idx + 1}</span>
                              </div>
                              {settings.owners.length > 1 && (
                                <button 
                                  onClick={() => handleRemoveOwner(idx)}
                                  className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/owner:opacity-100"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                            <div className="space-y-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                 <div>
                                   <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name / Title</label>
                                   <input 
                                     type="text" 
                                     placeholder="e.g. John Smith (Owner)" 
                                     value={owner.name} 
                                     onChange={(e) => handleOwnerChange(idx, 'name', e.target.value)}
                                     className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none text-slate-800 font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all" 
                                   />
                                 </div>
                                 <div>
                                   <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Cell Phone (SMS)</label>
                                   <input 
                                     type="text" 
                                     placeholder="(555) 555-5555" 
                                     value={owner.phone} 
                                     onChange={(e) => handleOwnerChange(idx, 'phone', e.target.value)}
                                     className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none text-slate-800 font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all" 
                                   />
                                 </div>
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email for Activity Reports</label>
                                <input 
                                  type="email" 
                                  placeholder="reports@company.com" 
                                  value={owner.email} 
                                  onChange={(e) => handleOwnerChange(idx, 'email', e.target.value)}
                                  className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none text-slate-800 font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all" 
                                />
                              </div>
                            </div>
                          </div>
                        ))}
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
    </div>
  );
};

export default ManageAccount;
