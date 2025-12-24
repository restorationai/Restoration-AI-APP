
import React, { useState, useMemo, useEffect } from 'react';
import { 
  MapPin, 
  User, 
  ArrowRight,
  Plus,
  LayoutGrid,
  List as ListIcon,
  X,
  Edit2,
  Bot,
  Loader2,
  Users,
  Building,
  Activity,
  Hash,
  Map as MapIcon,
  Shield,
  Droplets,
  Stethoscope,
  UserCheck,
  Phone,
  MessageSquare,
  Save,
  Search,
  ChevronRight,
  AlertCircle,
  FileText,
  DollarSign,
  Clock,
  ChevronLeft
} from 'lucide-react';
import { PipelineStage, Job, Contact } from '../types.ts';
import { calculateGPP } from '../utils/psychro.ts';
import { fetchJobsFromSupabase, syncJobToSupabase, getCurrentUser, fetchContactsFromSupabase } from '../lib/supabase.ts';

const STAGES: PipelineStage[] = ['Inbound', 'Dispatching', 'In Progress', 'Completion', 'Invoiced'];

const JobPipeline: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeJobTab, setActiveJobTab] = useState<'briefing' | 'fieldwork' | 'logistics' | 'documentation' | 'financials' | 'compliance'>('briefing');
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  
  const initialFormState: Partial<Job> = {
    title: '', stage: 'Inbound', lossType: 'Water Damage', urgency: 'Medium', contactId: '', assignedTechIds: [],
    customFields: { 
      incident_summary: '', 
      work_authorized: 'No', 
      property_type: 'Residential', 
      source_of_damage: '',
      is_insurance_claim: 'No',
      service_needed: '',
      urgency_level: 'Medium',
      areas_affected: '',
      insurance_provider: '',
      policy_number: '',
      claim_number: '',
      adjuster_name: '',
      adjuster_email: '',
      incident_id: `RA-${Math.floor(1000 + Math.random() * 9000)}`,
      owner_dm_name: '',
      owner_dm_phone: '',
      tenant_name: '',
      tenant_phone: ''
    },
    notes: [], documents: [], readings: [], financials: []
  };

  const [newJobForm, setNewJobForm] = useState<Partial<Job>>(initialFormState);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const userData = await getCurrentUser();
        const cid = userData?.profile?.company_id;
        if (cid) {
          setCompanyId(cid);
          const [fetchedJobs, fetchedContacts] = await Promise.all([
            fetchJobsFromSupabase(cid),
            fetchContactsFromSupabase(cid)
          ]);
          setJobs(fetchedJobs);
          setContacts(fetchedContacts);
        }
      } catch (err) {
        console.error("Failed to fetch jobs/contacts:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const getContact = (id: string) => contacts.find(c => c.id === id);

  const moveJob = async (id: string, direction: 'next' | 'prev') => {
    const job = jobs.find(j => j.id === id);
    if (!job || !companyId) return;

    const idx = STAGES.indexOf(job.stage);
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    
    if (nextIdx >= 0 && nextIdx < STAGES.length) {
      const nextStage = STAGES[nextIdx];
      const updatedJob = { ...job, stage: nextStage };
      
      try {
        await syncJobToSupabase(updatedJob, companyId);
        setJobs(prev => prev.map(j => j.id === id ? updatedJob : j));
        if (selectedJob?.id === id) setSelectedJob(updatedJob);
      } catch (err) {
        console.error("Failed to move job stage:", err);
      }
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setIsSaving(true);
    
    const jobData: Job = {
      id: newJobForm.id || `job-${Date.now()}`,
      title: newJobForm.title || 'Untitled Job',
      stage: (newJobForm.stage as PipelineStage) || 'Inbound',
      lossType: newJobForm.lossType || 'Other',
      assignedTechIds: newJobForm.assignedTechIds || [],
      urgency: (newJobForm.urgency as any) || 'Medium',
      estimatedValue: Number(newJobForm.estimatedValue) || 0,
      timestamp: newJobForm.timestamp || new Date().toLocaleDateString(),
      contactId: newJobForm.contactId || '',
      customFields: newJobForm.customFields,
      notes: newJobForm.notes || [],
      readings: newJobForm.readings || [],
      documents: newJobForm.documents || [],
      financials: newJobForm.financials || []
    };

    try {
      await syncJobToSupabase(jobData, companyId);
      setJobs(prev => newJobForm.id ? prev.map(j => j.id === newJobForm.id ? jobData : j) : [jobData, ...prev]);
      setIsNewJobModalOpen(false);
      setNewJobForm(initialFormState);
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(`Sync error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const DataItem = ({ label, value, mono = false, icon: Icon, isFull = false }: { label: string, value?: string, mono?: boolean, icon?: any, isFull?: boolean }) => (
    <div className={`flex flex-col gap-1 ${isFull ? 'col-span-full' : ''}`}>
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
        {Icon && <Icon size={10} className="text-slate-300" />} {label}
      </span>
      <span className={`text-xs font-bold ${mono ? 'font-mono text-blue-600' : 'text-slate-800'}`}>
        {value || <span className="text-slate-200 italic font-medium">--</span>}
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="font-black text-xs uppercase tracking-[0.3em]">Connecting to Job Pipeline Hub...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50 relative text-slate-900">
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">Job Pipeline</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Operations Matrix</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input 
              type="text" 
              placeholder="Filter by title..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold w-48 focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setViewMode('board')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'board' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={12} /> Board</button>
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><ListIcon size={12} /> List</button>
          </div>
          <button onClick={() => { setNewJobForm(initialFormState); setIsNewJobModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:bg-slate-800 transition-all active:scale-95"><Plus size={14} /> New Job</button>
        </div>
      </header>

      {viewMode === 'board' ? (
        <div className="flex-1 overflow-x-auto p-6 flex gap-6 scrollbar-hide">
          {STAGES.map((stage) => (
            <div key={stage} className="flex-shrink-0 w-80 flex flex-col gap-3">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">{stage} <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[8px] text-slate-500 font-black">{jobs.filter(j => j.stage === stage).length}</span></h3>
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hide pb-8">
                {jobs.filter(j => j.stage === stage && (j.title.toLowerCase().includes(searchTerm.toLowerCase()))).length > 0 ? (
                  jobs.filter(j => j.stage === stage && (j.title.toLowerCase().includes(searchTerm.toLowerCase()))).map((job) => (
                    <div key={job.id} onClick={() => { setSelectedJob(job); setActiveJobTab('briefing'); }} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group cursor-pointer active:scale-[0.98]">
                      <div className="flex justify-between items-start mb-3">
                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${job.urgency === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{job.urgency}</div>
                        <div className="text-[8px] font-black text-slate-300 uppercase">{job.timestamp}</div>
                      </div>
                      <h4 className="font-black text-slate-800 text-xs leading-tight mb-3 group-hover:text-blue-600 transition-colors truncate">{job.title}</h4>
                      <div className="flex items-center gap-2 text-slate-500"><User size={10} className="text-slate-300" /><span className="text-[10px] font-bold truncate">{getContact(job.contactId)?.name || 'Walk-in/Manual'}</span></div>
                      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Project Info</span><ArrowRight size={12} className="text-slate-300 group-hover:text-blue-600" /></div>
                    </div>
                  ))
                ) : (
                  <div className="h-20 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center opacity-40">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Empty Stage</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8">
          <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center opacity-20">
            <ListIcon size={32} className="mx-auto" />
            <p className="mt-4 font-black text-xs uppercase tracking-widest">Optimizing list views...</p>
          </div>
        </div>
      )}

      {/* Selected Job Drawer/Overlay */}
      {selectedJob && (
        <div className="fixed inset-0 z-[150] flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-500">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ChevronLeft size={24} /></button>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{selectedJob.title}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedJob.lossType} • {selectedJob.stage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all" onClick={() => { setNewJobForm(selectedJob); setIsNewJobModalOpen(true); }}><Edit2 size={18} /></button>
                <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all" onClick={() => setSelectedJob(null)}><X size={18} /></button>
              </div>
            </div>

            <div className="flex bg-slate-50 px-8 border-b border-slate-200 sticky top-0 z-10">
              {['briefing', 'fieldwork', 'logistics', 'documentation', 'financials'].map(tab => (
                <button key={tab} onClick={() => setActiveJobTab(tab as any)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeJobTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                  {tab}
                  {activeJobTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full"></div>}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
              {activeJobTab === 'briefing' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                  <div className="grid grid-cols-2 gap-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                    <DataItem label="Client Name" value={getContact(selectedJob.contactId)?.name} icon={User} />
                    <DataItem label="Service Location" value={selectedJob.customFields?.areas_affected || getContact(selectedJob.contactId)?.address} icon={MapPin} />
                    <DataItem label="Company/Entity" value={getContact(selectedJob.contactId)?.company} icon={Building} />
                    <DataItem label="Project Start" value={selectedJob.timestamp} icon={Activity} />
                    <DataItem label="Insurance Carrier" value={selectedJob.customFields?.insurance_provider} icon={Shield} />
                    <DataItem label="Claim Number" value={selectedJob.customFields?.claim_number} icon={Hash} />
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Sarah AI Incident Summary</label>
                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl relative">
                      <Bot className="absolute top-4 right-4 text-blue-200" size={24} />
                      <p className="text-sm font-bold text-blue-900 leading-relaxed italic">"{selectedJob.customFields?.incident_summary || 'No summary available from initial triage.'}"</p>
                    </div>
                  </div>
                </div>
              )}

              {activeJobTab === 'fieldwork' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                   <div className="flex items-center justify-between">
                     <h4 className="text-lg font-black tracking-tight">Psychrometric Logs</h4>
                     <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus size={14} /> Add Reading</button>
                   </div>
                   <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4">Room/Area</th>
                            <th className="px-6 py-4 text-center">Temp/RH</th>
                            <th className="px-6 py-4 text-center">GPP</th>
                            <th className="px-6 py-4 text-right">Equipment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedJob.readings.map(r => (
                            <tr key={r.id}>
                              <td className="px-6 py-4 font-bold text-slate-800 text-xs">{r.room}</td>
                              <td className="px-6 py-4 text-center text-xs font-mono">{r.temp}° / {r.rh}%</td>
                              <td className="px-6 py-4 text-center font-black text-xs text-blue-600">{r.gpp || calculateGPP(r.temp, r.rh)}</td>
                              <td className="px-6 py-4 text-right"><span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${r.equipmentActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{r.equipmentActive ? 'Active' : 'Off'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-white shadow-2xl">
              <div className="flex gap-4">
                 {STAGES.indexOf(selectedJob.stage) > 0 && <button onClick={() => moveJob(selectedJob.id, 'prev')} className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all hover:bg-slate-200 active:scale-95"><ChevronLeft size={16} /> Previous Stage</button>}
              </div>
              <div className="flex gap-4">
                 {STAGES.indexOf(selectedJob.stage) < STAGES.length - 1 && <button onClick={() => moveJob(selectedJob.id, 'next')} className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-600/30 transition-all hover:bg-blue-700 active:scale-95">Advance to {STAGES[STAGES.indexOf(selectedJob.stage) + 1]} <ArrowRight size={16} /></button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Job Modal */}
      {isNewJobModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 my-auto">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Plus size={24} /></div>
                <h3 className="text-xl font-black uppercase tracking-tight">{newJobForm.id ? 'Modify Pipeline Job' : 'Create New Pipeline Job'}</h3>
              </div>
              <button onClick={() => setIsNewJobModalOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <form onSubmit={handleSaveJob} className="p-10 space-y-6 overflow-y-auto scrollbar-hide max-h-[75vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Job Title / Project Name</label>
                  <input required type="text" value={newJobForm.title} onChange={e => setNewJobForm({...newJobForm, title: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all" placeholder="e.g. Miller Residence Water Damage" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Link CRM Contact</label>
                  <select required value={newJobForm.contactId} onChange={e => setNewJobForm({...newJobForm, contactId: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer transition-all">
                    <option value="">Select a contact...</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Pipeline Stage</label>
                    <select value={newJobForm.stage} onChange={e => setNewJobForm({...newJobForm, stage: e.target.value as PipelineStage})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer">
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Urgency</label>
                    <select value={newJobForm.urgency} onChange={e => setNewJobForm({...newJobForm, urgency: e.target.value as any})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Loss Category</label>
                  <input type="text" value={newJobForm.lossType} onChange={e => setNewJobForm({...newJobForm, lossType: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="e.g. Water Damage (Category 3)" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Estimated Revenue ($)</label>
                  <input type="number" value={newJobForm.estimatedValue} onChange={e => setNewJobForm({...newJobForm, estimatedValue: Number(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="0.00" />
                </div>
              </div>

              <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/90 backdrop-blur-sm pb-2">
                <button type="button" onClick={() => setIsNewJobModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? 'Syncing...' : 'Sync Pipeline Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPipeline;