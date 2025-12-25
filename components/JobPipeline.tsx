
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
  Building,
  Activity,
  Hash,
  Map as MapIcon,
  Shield,
  Droplets,
  Stethoscope,
  UserCheck,
  Phone,
  // Added missing Smartphone icon import
  Smartphone,
  MessageSquare,
  Save,
  Search,
  ChevronRight,
  AlertCircle,
  FileText,
  DollarSign,
  Clock,
  ChevronLeft,
  Send,
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
  ClipboardList,
  Home,
  Tag,
  Briefcase,
  Info,
  CalendarDays,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Users
} from 'lucide-react';
import { PipelineStage, Job, Contact, JobNote, GHLCustomFields, CalendarEvent, ContactType } from '../types.ts';
import { calculateGPP } from '../utils/psychro.ts';
import { fetchJobsFromSupabase, syncJobToSupabase, getCurrentUser, fetchContactsFromSupabase, fetchCalendarEvents } from '../lib/supabase.ts';

const STAGES: PipelineStage[] = ['Inbound', 'Dispatching', 'In Progress', 'Completion', 'Invoiced'];

const JobPipeline: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Staff Member');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // Drawer States
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeJobTab, setActiveJobTab] = useState<'briefing' | 'appointments' | 'fieldwork' | 'notes' | 'documentation' | 'financials'>('briefing');
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  
  // Inline Editing State for Drawer
  const [isEditingBriefing, setIsEditingBriefing] = useState(false);
  const [briefingForm, setBriefingForm] = useState<Partial<Job>>({});

  const initialFormState: Partial<Job> = {
    title: '', stage: 'Inbound', status: 'Open', lossType: 'Water Damage', urgency: 'Medium', contactId: '', propertyManagerId: '', assignedTechIds: [],
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
          setCurrentUserName(userData.profile.full_name || 'Staff Member');
          const [fetchedJobs, fetchedContacts, fetchedEvents] = await Promise.all([
            fetchJobsFromSupabase(cid),
            fetchContactsFromSupabase(cid),
            fetchCalendarEvents(cid)
          ]);
          setJobs(fetchedJobs);
          setContacts(fetchedContacts);
          setEvents(fetchedEvents);
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

  const toggleJobStatus = async () => {
    if (!selectedJob || !companyId) return;

    const nextStatus = selectedJob.status === 'Open' ? 'Closed' : 'Open';
    const updatedJob = { ...selectedJob, status: nextStatus as 'Open' | 'Closed' };

    try {
      setIsSaving(true);
      await syncJobToSupabase(updatedJob, companyId);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBriefing = async () => {
    if (!selectedJob || !companyId) return;
    setIsSaving(true);
    
    const updatedJob: Job = {
      ...selectedJob,
      title: briefingForm.title || selectedJob.title,
      lossType: briefingForm.lossType || selectedJob.lossType,
      urgency: briefingForm.urgency || selectedJob.urgency,
      estimatedValue: briefingForm.estimatedValue ?? selectedJob.estimatedValue,
      propertyManagerId: briefingForm.propertyManagerId,
      customFields: { ...selectedJob.customFields, ...briefingForm.customFields }
    };

    try {
      await syncJobToSupabase(updatedJob, companyId);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);
      setIsEditingBriefing(false);
    } catch (err) {
      console.error("Failed to save briefing details:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !selectedJob || !companyId) return;

    const newNote: JobNote = {
      id: `note-${Date.now()}`,
      author: currentUserName,
      content: newNoteText,
      timestamp: new Date().toISOString(),
      isAiGenerated: false
    };

    const updatedJob = {
      ...selectedJob,
      notes: [newNote, ...(selectedJob.notes || [])]
    };

    try {
      setIsSaving(true);
      await syncJobToSupabase(updatedJob, companyId);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);
      setNewNoteText('');
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedJob || !companyId) return;
    if (!window.confirm("Are you sure you want to permanently delete this project note?")) return;
    const updatedNotes = (selectedJob.notes || []).filter(n => n.id !== noteId);
    const updatedJob = { ...selectedJob, notes: updatedNotes };
    try {
      setIsSaving(true);
      await syncJobToSupabase(updatedJob, companyId);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);
    } catch (err) { console.error(err); } finally { setIsSaving(false); }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    // Constraint 1: One Open Job per Primary Contact
    const openJob = jobs.find(j => j.contactId === newJobForm.contactId && j.status === 'Open' && j.id !== newJobForm.id);
    if (openJob) {
      alert(`This contact already has an active project ("${openJob.title}"). You must close that project before opening a new file for this client.`);
      return;
    }

    setIsSaving(true);
    const jobData: Job = {
      id: newJobForm.id || `job-${Date.now()}`,
      title: newJobForm.title || 'Untitled Job',
      stage: (newJobForm.stage as PipelineStage) || 'Inbound',
      status: (newJobForm.status as 'Open' | 'Closed') || 'Open',
      lossType: newJobForm.lossType || 'Other',
      assignedTechIds: newJobForm.assignedTechIds || [],
      urgency: (newJobForm.urgency as any) || 'Medium',
      estimatedValue: Number(newJobForm.estimatedValue) || 0,
      timestamp: newJobForm.timestamp || new Date().toLocaleDateString(),
      contactId: newJobForm.contactId || '',
      propertyManagerId: newJobForm.propertyManagerId || null,
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

  const relatedEvents = useMemo(() => {
    if (!selectedJob) return [];
    return events.filter(e => e.jobId === selectedJob.id || e.contactId === selectedJob.contactId);
  }, [events, selectedJob]);

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
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">{stage} <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-[8px] text-slate-500 font-black">{jobs.filter(j => j.stage === stage && j.status === 'Open').length}</span></h3>
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-hide pb-8">
                {jobs.filter(j => j.stage === stage && (j.title?.toLowerCase()?.includes(searchTerm.toLowerCase()))).length > 0 ? (
                  jobs.filter(j => j.stage === stage && (j.title?.toLowerCase()?.includes(searchTerm.toLowerCase()))).map((job) => (
                    <div key={job.id} onClick={() => { setSelectedJob(job); setActiveJobTab('briefing'); setIsEditingBriefing(false); }} className={`bg-white p-4 rounded-3xl border shadow-sm hover:shadow-xl transition-all group cursor-pointer active:scale-[0.98] ${job.status === 'Closed' ? 'opacity-50 grayscale border-slate-100 bg-slate-50/50' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                           <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${job.urgency === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{job.urgency}</div>
                           {job.status === 'Closed' && <div className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest">Archived</div>}
                        </div>
                        <div className="text-[8px] font-black text-slate-300 uppercase">{job.timestamp}</div>
                      </div>
                      <h4 className="font-black text-slate-800 text-xs leading-tight mb-3 group-hover:text-blue-600 transition-colors truncate">{job.title || 'Untitled Job'}</h4>
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

      {/* Selected Job Drawer/Overlay - Expanded to 80% */}
      {selectedJob && (
        <div className="fixed inset-0 z-[150] flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-[80vw] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-500">
            <div className={`p-8 border-b border-slate-100 flex items-center justify-between text-white transition-colors ${selectedJob.status === 'Closed' ? 'bg-slate-600' : 'bg-slate-900'}`}>
              <div className="flex items-center gap-6">
                <button onClick={() => setSelectedJob(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors bg-white/5"><ChevronLeft size={28} /></button>
                <div>
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black uppercase tracking-tight">{selectedJob.title || 'Untitled Job'}</h3>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${selectedJob.status === 'Open' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-500/10 border-slate-500/30 text-slate-300'}`}>
                      {selectedJob.status === 'Open' ? 'Active Project' : 'Closed Archive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedJob.lossType} • {selectedJob.stage}</p>
                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job ID: {selectedJob.customFields?.incident_id || 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={toggleJobStatus}
                  className={`px-6 py-3 rounded-2xl transition-all flex items-center gap-3 font-black text-[11px] uppercase tracking-widest border ${selectedJob.status === 'Open' ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'}`}
                >
                  {selectedJob.status === 'Open' ? <><Lock size={18} /> Close File</> : <><Unlock size={18} /> Re-Open File</>}
                </button>
                <button className="p-3.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all" onClick={() => { 
                   setBriefingForm(selectedJob);
                   setIsEditingBriefing(true);
                   setActiveJobTab('briefing');
                }}><Edit2 size={20} /></button>
                <button className="p-3.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all" onClick={() => setSelectedJob(null)}><X size={20} /></button>
              </div>
            </div>

            <div className="flex bg-slate-50 px-8 border-b border-slate-200 sticky top-0 z-10">
              {[
                { id: 'briefing', icon: ClipboardList, label: 'Job Briefing' },
                { id: 'appointments', icon: CalendarDays, label: 'Appointments' },
                { id: 'fieldwork', icon: Droplets, label: 'Moisture Logs' },
                { id: 'notes', icon: MessageSquare, label: 'Project Notes' },
                { id: 'documentation', icon: FileText, label: 'Attachments' },
                { id: 'financials', icon: DollarSign, label: 'Financials' }
              ].map(tab => (
                <button key={tab.id} onClick={() => { setActiveJobTab(tab.id as any); setIsEditingBriefing(false); }} className={`px-8 py-5 text-[11px] font-black uppercase tracking-widest transition-all relative flex items-center gap-3 ${activeJobTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                  <tab.icon size={16} /> {tab.label}
                  {activeJobTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-blue-600 rounded-t-full shadow-[0_-4px_10px_rgba(37,99,235,0.4)]"></div>}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-12 space-y-12 scrollbar-hide">
              {activeJobTab === 'briefing' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
                  <div className="flex items-center justify-between">
                     <div>
                       <h4 className="text-2xl font-black text-slate-800 tracking-tight">Project Intelligence</h4>
                       <p className="text-sm font-bold text-slate-400 mt-1">Core details captured by AI and updated by dispatch.</p>
                     </div>
                     {!isEditingBriefing ? (
                       <button 
                         onClick={() => {
                           setBriefingForm(selectedJob);
                           setIsEditingBriefing(true);
                         }}
                         className="flex items-center gap-3 px-8 py-3.5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95"
                       >
                         <Edit2 size={18} /> Edit Intelligence
                       </button>
                     ) : (
                       <div className="flex gap-3">
                         <button onClick={() => setIsEditingBriefing(false)} className="px-8 py-3.5 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest transition-all hover:bg-slate-200">Cancel</button>
                         <button 
                           onClick={handleSaveBriefing}
                           disabled={isSaving}
                           className="flex items-center gap-3 px-10 py-3.5 bg-emerald-600 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95"
                         >
                           {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Commit Changes
                         </button>
                       </div>
                     )}
                  </div>

                  {isEditingBriefing ? (
                    <div className="space-y-10 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 bg-slate-50 p-10 rounded-[3rem] border border-slate-200">
                        <div className="space-y-6">
                           <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4"><Briefcase size={14} /> Basic Project Details</h5>
                           <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Job Title / Title Protocol</label>
                              <input type="text" value={briefingForm.title || ''} onChange={e => setBriefingForm({...briefingForm, title: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Loss Type</label>
                                <input type="text" value={briefingForm.lossType || ''} onChange={e => setBriefingForm({...briefingForm, lossType: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Urgency Level</label>
                                <select value={briefingForm.urgency} onChange={e => setBriefingForm({...briefingForm, urgency: e.target.value as any})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all cursor-pointer">
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High</option>
                                </select>
                              </div>
                           </div>
                           <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Assign Property Manager / Partner</label>
                              <select value={briefingForm.propertyManagerId || ''} onChange={e => setBriefingForm({...briefingForm, propertyManagerId: e.target.value})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all cursor-pointer">
                                <option value="">No Linked Manager</option>
                                {contacts.filter(c => c.type === ContactType.PROPERTY_MANAGER || c.type === ContactType.REFERRAL_PARTNER).map(c => (
                                  <option key={c.id} value={c.id}>{c.name} ({c.company || c.type})</option>
                                ))}
                              </select>
                           </div>
                        </div>

                        <div className="space-y-6">
                           <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4"><Shield size={14} /> Insurance & Claim Info</h5>
                           <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Insurance Provider</label>
                              <input type="text" value={briefingForm.customFields?.insurance_provider || ''} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, insurance_provider: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Policy #</label>
                                <input type="text" value={briefingForm.customFields?.policy_number || ''} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, policy_number: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Claim #</label>
                                <input type="text" value={briefingForm.customFields?.claim_number || ''} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, claim_number: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                              </div>
                           </div>
                           <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Property Type</label>
                              <select value={briefingForm.customFields?.property_type || 'Residential'} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, property_type: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all">
                                <option value="Residential">Residential</option>
                                <option value="Commercial">Commercial</option>
                                <option value="Industrial">Industrial</option>
                                <option value="Multi-Family">Multi-Family</option>
                              </select>
                           </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                           <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><Bot size={14} /> AI Context & Damage Summary</h5>
                           <div className="space-y-4">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">Sarah AI Transcription/Summary</label>
                              <textarea 
                                value={briefingForm.customFields?.incident_summary || ''}
                                onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, incident_summary: e.target.value}})}
                                className="w-full min-h-[160px] p-6 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-600/5 transition-all shadow-sm"
                              />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Source of Damage</label>
                                <input type="text" value={briefingForm.customFields?.source_of_damage || ''} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, source_of_damage: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Areas Affected</label>
                                <input type="text" value={briefingForm.customFields?.areas_affected || ''} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, areas_affected: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
                              </div>
                           </div>
                        </div>

                        <div className="space-y-6">
                           <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><Home size={14} /> Tenant / Occupant Tracking</h5>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                <input type="text" value={briefingForm.customFields?.tenant_name || ''} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, tenant_name: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" placeholder="Tenant Name" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Direct Phone</label>
                                <input type="text" value={briefingForm.customFields?.tenant_phone || ''} onChange={e => setBriefingForm({...briefingForm, customFields: {...briefingForm.customFields, tenant_phone: e.target.value}})} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" placeholder="(555) 555-5555" />
                              </div>
                           </div>
                           <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 mt-4 flex items-start gap-4">
                              <Info size={20} className="text-emerald-500 shrink-0" />
                              <div>
                                <p className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">Manual Edit Confirmation</p>
                                <p className="text-[10px] font-bold text-emerald-700 leading-tight mt-1">Committing these changes will update the permanent file and trigger any downstream n8n field updates.</p>
                              </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      {/* Left Column: Sarah AI Summary & Source */}
                      <div className="space-y-8">
                         <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1 flex items-center gap-2"><Bot size={14} className="text-purple-600" /> Sarah AI Incident Triage Summary</label>
                          <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2.5rem] relative">
                            <Bot className="absolute top-6 right-8 text-blue-200 opacity-50" size={32} />
                            <p className="text-base font-bold text-blue-900 leading-relaxed italic">"{selectedJob.customFields?.incident_summary || 'No triage summary available.'}"</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Source of Damage</label>
                             <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                               <Droplets size={18} className="text-slate-300" />
                               <span className="text-sm font-black text-slate-800">{selectedJob.customFields?.source_of_damage || 'Unknown'}</span>
                             </div>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Specific Areas Affected</label>
                             <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                               <MapIcon size={18} className="text-slate-300" />
                               <span className="text-sm font-black text-slate-800">{selectedJob.customFields?.areas_affected || 'General'}</span>
                             </div>
                          </div>
                        </div>

                        {/* Linked Property Manager Display */}
                        <div className="space-y-6 pt-4">
                           <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building size={14} className="text-slate-400" /> Linked Property Manager / Contact</label>
                          </div>
                          <div className="p-8 bg-white border-2 border-slate-50 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-5">
                               <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                                 <Building size={24} />
                               </div>
                               <div>
                                 <p className="font-black text-slate-800 text-lg tracking-tight">{getContact(selectedJob.propertyManagerId)?.name || 'No Partner Linked'}</p>
                                 <div className="flex items-center gap-2 mt-0.5">
                                   <Smartphone size={12} className="text-slate-300" />
                                   <span className="text-xs font-bold text-slate-400">{getContact(selectedJob.propertyManagerId)?.phone || 'Direct line not provided'}</span>
                                 </div>
                               </div>
                            </div>
                            {getContact(selectedJob.propertyManagerId)?.phone && <button className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Phone size={20} fill="currentColor" /></button>}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Key Contacts & Tenant Info */}
                      <div className="space-y-8">
                        <div className="bg-slate-50/50 p-8 rounded-[3rem] border border-slate-100 grid grid-cols-2 gap-8">
                          <DataItem label="Job Title" value={selectedJob.title} icon={Tag} />
                          <DataItem label="Loss Type" value={selectedJob.lossType} icon={Activity} />
                          <DataItem label="Primary Owner" value={getContact(selectedJob.contactId)?.name} icon={User} />
                          <DataItem label="Job Opened" value={selectedJob.timestamp} icon={Calendar} />
                          <DataItem label="Insurance Carrier" value={selectedJob.customFields?.insurance_provider} icon={Shield} />
                          <DataItem label="Claim Number" value={selectedJob.customFields?.claim_number} icon={Hash} />
                          <DataItem label="Property Type" value={selectedJob.customFields?.property_type} icon={MapPin} />
                          <DataItem label="Revenue Est." value={`$${selectedJob.estimatedValue?.toLocaleString() || '0.00'}`} icon={DollarSign} />
                        </div>

                        <div className="space-y-6">
                          <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Home size={14} /> Associated Tenant / On-Site Occupant</label>
                            <span className="text-[9px] font-black text-slate-300 uppercase">Emergency Field Context</span>
                          </div>
                          <div className="p-8 bg-white border-2 border-slate-50 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-5">
                               <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                                 <User size={24} />
                               </div>
                               <div>
                                 <p className="font-black text-slate-800 text-lg tracking-tight">{selectedJob.customFields?.tenant_name || 'No Tenant Linked'}</p>
                                 <div className="flex items-center gap-2 mt-0.5">
                                   <Smartphone size={12} className="text-slate-300" />
                                   <span className="text-xs font-bold text-slate-400">{selectedJob.customFields?.tenant_phone || 'Direct line not provided'}</span>
                                 </div>
                               </div>
                            </div>
                            {selectedJob.customFields?.tenant_phone && <button className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Phone size={20} fill="currentColor" /></button>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeJobTab === 'appointments' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight">Project Timeline & Appointments</h4>
                      <p className="text-sm font-bold text-slate-400 mt-1">Chronological dispatch events and scheduled site visits.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {relatedEvents.length > 0 ? relatedEvents.map(event => (
                      <div key={event.id} className={`p-8 rounded-[2.5rem] border flex items-center justify-between bg-white shadow-sm hover:shadow-md transition-all ${event.type === 'emergency' ? 'border-blue-100' : 'border-emerald-100'}`}>
                        <div className="flex items-center gap-6">
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${event.type === 'emergency' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'}`}>
                             {event.type === 'emergency' ? <ShieldCheck size={28} /> : <CalendarDays size={28} />}
                           </div>
                           <div>
                             <h5 className="font-black text-slate-800 text-lg tracking-tight">{event.title}</h5>
                             <div className="flex items-center gap-4 mt-1 text-slate-400">
                               <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"><Clock size={12} /> {new Date(event.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                               <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                               <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"><MapPin size={12} /> {event.location.split(',')[0]}</div>
                             </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Squad Link</p>
                             <div className="flex -space-x-2">
                               {event.assignedTechnicianIds.map(tid => (
                                 <div key={tid} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shadow-sm" title={tid}>
                                   {tid.charAt(0)}
                                 </div>
                               ))}
                             </div>
                           </div>
                           <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${event.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                             {event.status}
                           </div>
                        </div>
                      </div>
                    )) : (
                      <div className="py-20 bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-300">
                         <Calendar size={80} className="mb-6 opacity-10" />
                         <p className="text-xs font-black uppercase tracking-[0.4em] opacity-40">No Appointments Recorded</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeJobTab === 'fieldwork' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
                   <div className="flex items-center justify-between">
                     <div>
                       <h4 className="text-2xl font-black text-slate-800 tracking-tight">Psychrometric Logs</h4>
                       <p className="text-sm font-bold text-slate-400 mt-1">Real-time drying progress tracking and equipment audit.</p>
                     </div>
                     <button className="flex items-center gap-3 px-8 py-3.5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"><Plus size={18} /> New Daily Reading</button>
                   </div>
                   <div className="border-2 border-slate-50 rounded-[3rem] overflow-hidden shadow-2xl">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          <tr>
                            <th className="px-10 py-6">Service Area / Room</th>
                            <th className="px-10 py-6 text-center">Temp / RH %</th>
                            <th className="px-10 py-6 text-center">GPP (Grains)</th>
                            <th className="px-10 py-6 text-right">Equipment Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(selectedJob.readings || []).length > 0 ? (selectedJob.readings || []).map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-10 py-6 font-black text-slate-800 text-base">{r.room}</td>
                              <td className="px-10 py-6 text-center text-sm font-bold text-slate-500"><span className="text-slate-800">{r.temp}°F</span> <span className="mx-2 text-slate-200">|</span> <span className="text-slate-800">{r.rh}%</span></td>
                              <td className="px-10 py-6 text-center font-black text-lg text-blue-600">{r.gpp || calculateGPP(r.temp, r.rh)}</td>
                              <td className="px-10 py-6 text-right"><span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${r.equipmentActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{r.equipmentActive ? 'System Active' : 'Offline'}</span></td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-10 py-32 text-center">
                                <div className="flex flex-col items-center justify-center opacity-20">
                                  <Droplets size={64} className="text-slate-300 mb-4" />
                                  <p className="font-black text-xs uppercase tracking-widest">No Moisture Readings Recorded</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                </div>
              )}

              {activeJobTab === 'notes' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col gap-10">
                  <div className="space-y-6">
                    <h4 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-4"><MessageSquare size={28} className="text-blue-600" /> Project Notes</h4>
                    <div className="relative group">
                      <textarea 
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Type a project update for the whole team and n8n audit..."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[3rem] p-10 text-lg font-bold outline-none focus:ring-12 focus:ring-blue-600/5 focus:border-blue-600/20 transition-all resize-none min-h-[180px] shadow-inner"
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { handleAddNote(); } }}
                      />
                      <button 
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim() || isSaving}
                        className="absolute bottom-6 right-6 bg-blue-600 text-white p-5 rounded-[2rem] shadow-2xl shadow-blue-600/40 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-30"
                      >
                        {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                      </button>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6">Pro-tip: CTRL + Enter to broadcast note.</p>
                  </div>

                  <div className="space-y-8">
                    {(selectedJob.notes && selectedJob.notes.length > 0) ? selectedJob.notes.map((note) => (
                      <div key={note.id} className="bg-white border-2 border-slate-50 p-10 rounded-[3.5rem] shadow-sm relative group hover:shadow-xl transition-all hover:border-blue-50">
                        <div className="flex justify-between items-start mb-8">
                          <div className="flex items-center gap-5">
                             <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-base uppercase shadow-inner border border-blue-100">
                                {(note.author || '??').split(' ').map(n => n[0]).join('')}
                             </div>
                             <div>
                               <p className="text-lg font-black text-slate-800">{note.author || 'Unknown Staff'}</p>
                               <div className="flex items-center gap-3 mt-1 text-slate-400">
                                 <Calendar size={14} />
                                 <span className="text-[11px] font-bold uppercase tracking-widest">{new Date(note.timestamp).toLocaleDateString()} • {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {note.isAiGenerated && <span className="bg-purple-100 text-purple-600 text-[10px] font-black uppercase px-4 py-1.5 rounded-full flex items-center gap-2 border border-purple-200"><Bot size={14} /> AI Activity Log</span>}
                            {!isSaving && (
                              <button 
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                title="Delete Note"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-lg font-bold text-slate-600 leading-relaxed whitespace-pre-wrap px-2">{note.content}</p>
                      </div>
                    )) : (
                      <div className="p-32 bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[4rem] flex flex-col items-center justify-center text-slate-300">
                        <MessageSquare size={80} className="mb-6 opacity-10" />
                        <p className="text-xs font-black uppercase tracking-[0.4em] opacity-40">No Project History Detected</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="py-4 px-10 border-t border-slate-100 flex items-center justify-between bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <div className="flex gap-3">
                 {STAGES.indexOf(selectedJob.stage) > 0 && (
                   <button onClick={() => moveJob(selectedJob.id, 'prev')} className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 text-slate-500 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all hover:bg-slate-100 active:scale-95 border border-slate-200">
                     <ChevronLeft size={14} /> {STAGES[STAGES.indexOf(selectedJob.stage) - 1]}
                   </button>
                 )}
              </div>
              <div className="flex gap-3">
                 {STAGES.indexOf(selectedJob.stage) < STAGES.length - 1 && (
                   <button onClick={() => moveJob(selectedJob.id, 'next')} className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95">
                     Advance to {STAGES[STAGES.indexOf(selectedJob.stage) + 1]} <ArrowRight size={16} />
                   </button>
                 )}
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
                  <input required type="text" value={newJobForm.title || ''} onChange={e => setNewJobForm({...newJobForm, title: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm transition-all" placeholder="e.g. Miller Residence Water Damage" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Primary Owner / Contact <span className="text-red-500 font-black">*</span></label>
                  <select required value={newJobForm.contactId || ''} onChange={e => setNewJobForm({...newJobForm, contactId: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer transition-all">
                    <option value="">Select Primary Owner...</option>
                    {contacts.filter(c => c.type !== ContactType.PROPERTY_MANAGER && c.type !== ContactType.STAFF).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1.5 italic">Property Managers cannot be primary owners. Assign them in the Management field below.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Linked Property Manager / Referral Partner</label>
                  <select value={newJobForm.propertyManagerId || ''} onChange={e => setNewJobForm({...newJobForm, propertyManagerId: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm cursor-pointer transition-all">
                    <option value="">No Linked Partner</option>
                    {contacts.filter(c => c.type === ContactType.PROPERTY_MANAGER || c.type === ContactType.REFERRAL_PARTNER).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.company || c.type})</option>
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
                  <input type="text" value={newJobForm.lossType || ''} onChange={e => setNewJobForm({...newJobForm, lossType: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="e.g. Water Damage (Category 3)" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Estimated Revenue ($)</label>
                  <input type="number" value={newJobForm.estimatedValue || 0} onChange={e => setNewJobForm({...newJobForm, estimatedValue: Number(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-600/10 shadow-sm" placeholder="0.00" />
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
