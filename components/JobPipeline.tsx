
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  MapPin, 
  User, 
  AlertCircle, 
  ArrowRight,
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  X,
  Trash2,
  Calendar,
  Shield,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  Camera,
  Droplets,
  FileText,
  History,
  Mail,
  Image as ImageIcon,
  ChevronDown,
  Activity,
  Hash,
  Tag,
  Key,
  ShieldCheck,
  Zap,
  Bot,
  Info,
  Phone,
  HardDrive,
  Crown,
  Save,
  RefreshCw,
  Edit2,
  FileAudio,
  PenTool,
  MessageSquare,
  Send,
  Link2,
  DollarSign,
  ClipboardList,
  Flame,
  Thermometer,
  CloudRain,
  Download,
  Stethoscope,
  Building,
  UserCheck,
  MessageCircle,
  Smartphone,
  Globe,
  PhoneCall,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Wallet,
  Home,
  Users,
  IdCard,
  Map as MapIcon,
  Headphones,
  FileDown,
  Printer,
  FileCheck,
  FolderOpen,
  Link,
  UploadCloud,
  File,
  Loader2
} from 'lucide-react';
import { MOCK_JOBS, MOCK_CONTACTS, MOCK_TECHNICIANS, MOCK_CONVERSATIONS, INITIAL_COMPANY_SETTINGS } from '../constants.tsx';
import { PipelineStage, Job, Contact, GHLCustomFields, JobNote, JobDocument, MoistureReading, FinancialItem, Conversation, ConversationSource } from '../types.ts';
import { calculateGPP, getDryingStatus } from '../utils/psychro.ts';
import { fetchJobsFromSupabase, syncJobToSupabase } from '../lib/supabase.ts';

const STAGES: PipelineStage[] = ['Inbound', 'Dispatching', 'In Progress', 'Completion', 'Invoiced'];

const ACCOUNT_FILES: JobDocument[] = [
  { id: 'f1', name: 'Master Service Agreement.pdf', type: 'form', url: '#', timestamp: 'Jan 10, 2024' },
  { id: 'f2', name: 'Standard Work Auth Template.pdf', type: 'form', url: '#', timestamp: 'Feb 15, 2024' },
  { id: 'f3', name: 'Liability Waiver.pdf', type: 'form', url: '#', timestamp: 'Mar 02, 2024' },
];

const JobPipeline: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeJobTab, setActiveJobTab] = useState<'briefing' | 'fieldwork' | 'logistics' | 'documentation' | 'financials' | 'compliance'>('briefing');
  const [logisticsSubTab, setLogisticsSubTab] = useState<'notes' | 'comms'>('notes');
  const [documentationSubTab, setDocumentationSubTab] = useState<'vault' | 'reports'>('vault');
  const [financialsSubTab, setFinancialsSubTab] = useState<'estimates' | 'invoices' | 'payments'>('estimates');
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [newJobFormTab, setNewJobFormTab] = useState<'basic' | 'loss' | 'insurance' | 'stakeholders'>('basic');
  
  const [noteInput, setNoteInput] = useState('');
  
  // Search states for Stakeholders tab
  const [ownerSearch, setOwnerSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [isOwnerSearchOpen, setIsOwnerSearchOpen] = useState(false);
  const [isTenantSearchOpen, setIsTenantSearchOpen] = useState(false);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: Partial<Job> = {
    title: '', stage: 'Inbound', lossType: 'Water Damage', urgency: 'Medium', contactId: MOCK_CONTACTS[0].id, assignedTechIds: [],
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

  // Load Data
  useEffect(() => {
    const loadJobs = async () => {
      try {
        setIsLoading(true);
        const fetched = await fetchJobsFromSupabase(INITIAL_COMPANY_SETTINGS.id);
        setJobs(fetched.length > 0 ? fetched : MOCK_JOBS.map(j => ({ ...j, notes: [], documents: [], readings: [], financials: [] })));
      } catch (err) {
        console.error("Failed to fetch jobs:", err);
        setJobs(MOCK_JOBS.map(j => ({ ...j, notes: [], documents: [], readings: [], financials: [] })));
      } finally {
        setIsLoading(false);
      }
    };
    loadJobs();
  }, []);

  const getContact = (id: string) => MOCK_CONTACTS.find(c => c.id === id);

  const moveJob = async (id: string, direction: 'next' | 'prev') => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    const idx = STAGES.indexOf(job.stage);
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    
    if (nextIdx >= 0 && nextIdx < STAGES.length) {
      const nextStage = STAGES[nextIdx];
      const updatedJob = { ...job, stage: nextStage };
      
      try {
        await syncJobToSupabase(updatedJob, INITIAL_COMPANY_SETTINGS.id);
        setJobs(prev => prev.map(j => j.id === id ? updatedJob : j));
        if (selectedJob?.id === id) setSelectedJob(updatedJob);
      } catch (err) {
        console.error("Failed to move job stage:", err);
        alert("Sync error while promoting job stage.");
      }
    }
  };

  const deleteJob = (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this job file?')) {
      // In a systematic sync, we'd delete from Supabase here
      setJobs(prev => prev.filter(j => j.id !== id));
      setSelectedJob(null);
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
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
      contactId: newJobForm.contactId || MOCK_CONTACTS[0].id,
      customFields: newJobForm.customFields,
      notes: newJobForm.notes || [],
      readings: newJobForm.readings || [],
      documents: newJobForm.documents || [],
      financials: newJobForm.financials || []
    };

    try {
      await syncJobToSupabase(jobData, INITIAL_COMPANY_SETTINGS.id);
      
      setJobs(prev => newJobForm.id ? prev.map(j => j.id === newJobForm.id ? jobData : j) : [jobData, ...prev]);
      if (selectedJob?.id === newJobForm.id) setSelectedJob(jobData);
      
      setIsNewJobModalOpen(false);
      setNewJobForm(initialFormState);
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(`Sync error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditDetails = () => {
    if (!selectedJob) return;
    setNewJobForm({ ...selectedJob });
    // Keep selectedJob as is so the background modal stays open
    setNewJobFormTab('basic');
    setIsNewJobModalOpen(true);
  };

  const handleAddReading = (room: string) => {
    if (!selectedJob) return;
    const newReading: MoistureReading = {
      id: `rd-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      room,
      temp: 72,
      rh: 45,
      gpp: calculateGPP(72, 45),
      moistureContent: 12,
      equipmentActive: true
    };
    const updated = { ...selectedJob, readings: [...selectedJob.readings, newReading] };
    setJobs(prev => prev.map(j => j.id === selectedJob.id ? updated : j));
    setSelectedJob(updated);
  };

  const updateReading = (id: string, field: keyof MoistureReading, val: any) => {
    if (!selectedJob) return;
    const updatedReadings = selectedJob.readings.map(r => {
      if (r.id === id) {
        const updatedR = { ...r, [field]: val };
        if (field === 'temp' || field === 'rh') {
          updatedR.gpp = calculateGPP(updatedR.temp, updatedR.rh);
        }
        return updatedR;
      }
      return r;
    });
    const updated = { ...selectedJob, readings: updatedReadings };
    setJobs(prev => prev.map(j => j.id === selectedJob.id ? updated : j));
    setSelectedJob(updated);
  };

  const handleLinkContact = (role: 'owner' | 'tenant', contact: Contact) => {
    if (role === 'owner') {
      setNewJobForm({
        ...newJobForm,
        customFields: {
          ...newJobForm.customFields,
          owner_dm_name: contact.name,
          owner_dm_phone: contact.phone
        }
      });
      setIsOwnerSearchOpen(false);
      setOwnerSearch('');
    } else {
      setNewJobForm({
        ...newJobForm,
        customFields: {
          ...newJobForm.customFields,
          tenant_name: contact.name,
          tenant_phone: contact.phone
        }
      });
      setIsTenantSearchOpen(false);
      setTenantSearch('');
    }
  };

  const handleAttachWorkAuth = (file: JobDocument) => {
    // In a real app, this might link by ID. Here we simulate attaching to the form.
    setNewJobForm({
      ...newJobForm,
      documents: [...(newJobForm.documents || []), file]
    });
    setIsFilePickerOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newDoc: JobDocument = {
        id: `upl-${Date.now()}`,
        name: file.name,
        type: 'form',
        url: '#',
        timestamp: 'Just now'
      };
      setNewJobForm({
        ...newJobForm,
        documents: [...(newJobForm.documents || []), newDoc]
      });
    }
  };

  const filteredOwnerContacts = useMemo(() => 
    MOCK_CONTACTS.filter(c => c.name.toLowerCase().includes(ownerSearch.toLowerCase())),
    [ownerSearch]
  );

  const filteredTenantContacts = useMemo(() => 
    MOCK_CONTACTS.filter(c => c.name.toLowerCase().includes(tenantSearch.toLowerCase())),
    [tenantSearch]
  );

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

  const renderBriefingTab = (job: Job) => {
    const cf = job.customFields || {};
    const contact = getContact(job.contactId);
    const assignedTechs = MOCK_TECHNICIANS.filter(t => job.assignedTechIds.includes(t.id));

    return (
      <div className="animate-in fade-in duration-300 grid grid-cols-12 gap-6 h-full content-start">
        <div className="col-span-4 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapIcon size={12} /> Site & Client</h4>
            <button onClick={handleEditDetails} className="text-blue-600 hover:text-blue-700"><Edit2 size={12} /></button>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"><MapPin size={16} /></div>
              <div>
                <p className="text-sm font-black text-slate-900 leading-tight">{contact?.address || 'No Address'}</p>
                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-0.5">Service Location</p>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0"><User size={16} /></div>
                <div>
                  <p className="text-sm font-black text-slate-800 leading-tight">{cf.owner_dm_name || contact?.name || 'Unassigned'}</p>
                  <p className="text-[10px] font-bold text-slate-400">{cf.owner_dm_phone || contact?.phone || 'No Phone'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center gap-2 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"><Phone size={12} /> Call</button>
                <button className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm"><MessageSquare size={12} /> SMS</button>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
               <DataItem label="Job ID" value={job.id.toUpperCase()} icon={Hash} mono />
               <DataItem label="Prop Type" value={cf.property_type} icon={Building} />
               <DataItem label="Work Auth" value={cf.work_authorized === 'Yes' ? 'Executed' : 'Pending'} icon={UserCheck} />
            </div>
          </div>
        </div>

        <div className="col-span-5 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Droplets size={12} className="text-blue-500" /> Loss Assessment</h4>
            <div className="flex items-center gap-1.5"><Bot size={10} className="text-blue-600" /><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sarah AI Live</span></div>
          </div>
          <div className="p-6 flex flex-col gap-6">
            <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl relative">
              <p className="text-xs font-bold text-slate-700 leading-relaxed italic pr-4">
                "{cf.new_lead_call_summary || cf.incident_summary || 'Aggregating data...'}"
              </p>
              <Bot className="absolute top-2 right-3 text-blue-200 opacity-30" size={24} />
            </div>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-2">
              <DataItem label="Source" value={cf.source_of_damage} icon={Activity} />
              <DataItem label="Service" value={cf.service_needed} icon={Stethoscope} />
              <DataItem label="Impacted" value={cf.areas_affected} icon={LayoutGrid} isFull />
            </div>
          </div>
        </div>

        <div className="col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100"><h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Shield size={12} className="text-emerald-500" /> Insurance</h4></div>
            <div className="p-5 space-y-4">
              <DataItem label="Carrier" value={cf.insurance_provider} />
              <div className="grid grid-cols-2 gap-4"><DataItem label="Claim" value={cf.claim_number} mono /><DataItem label="Policy" value={cf.policy_number} mono /></div>
            </div>
          </div>
          <div className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between"><h4 className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Users size={12} /> Squad</h4></div>
            <div className="p-5 space-y-3">
              {assignedTechs.map(tech => (
                <div key={tech.id} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-black text-[9px]">{tech.name[0]}</div>
                    <div className="min-w-0"><p className="text-[11px] font-black truncate">{tech.name}</p><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{tech.role}</p></div>
                  </div>
                  <button className="p-1.5 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all"><Phone size={10} /></button>
                </div>
              ))}
              <button className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[8px] font-black uppercase text-slate-500 hover:text-blue-400 transition-all mt-1">Manage</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDocumentationTab = (job: Job) => {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-2xl w-fit mb-6">
           <button onClick={() => setDocumentationSubTab('vault')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${documentationSubTab === 'vault' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><FolderOpen size={14} /> Evidence Vault</button>
           <button onClick={() => setDocumentationSubTab('reports')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${documentationSubTab === 'reports' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><FileDown size={14} /> PDF Reports</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {documentationSubTab === 'vault' ? (
            <div className="grid grid-cols-12 gap-6">
               <div className="col-span-4 bg-slate-900 text-white p-6 rounded-3xl shadow-lg h-fit">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-6"><FileAudio size={14} /> Audio Logs</h4>
                  <button className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><FileAudio size={20} /></div>
                       <div className="text-left"><p className="text-xs font-black">Sarah AI Intake Call</p><p className="text-[9px] font-black text-slate-500 uppercase">Today • 3:24</p></div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600" />
                  </button>
               </div>
               <div className="col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14} /> Visual Evidence</h4>
                    <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">New Folder</button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {['Before', 'During', 'Final Proof', 'Inventory'].map(c => (
                      <div key={c} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-white hover:border-blue-200 transition-all cursor-pointer shadow-sm group">
                        <ImageIcon size={24} className="text-slate-300 group-hover:text-blue-50 transition-colors" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-800">{c}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          ) : (
            <div className="space-y-6">
               <div className="grid grid-cols-3 gap-6">
                {[
                  { title: 'Moisture Log', icon: <Thermometer size={18}/> },
                  { title: 'Proof of Loss', icon: <ShieldCheck size={18}/> },
                  { title: 'Completion Cert', icon: <FileCheck size={18}/> }
                ].map((rep, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-600 transition-all group cursor-pointer flex flex-col justify-between min-h-[140px]">
                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:text-blue-600 transition-colors">{rep.icon}</div>
                    <div>
                       <h4 className="text-xs font-black text-slate-800">{rep.title}</h4>
                       <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Generate PDF</p>
                    </div>
                  </div>
                ))}
               </div>
               <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center opacity-30 flex flex-col items-center">
                  <FileDown size={40} className="mb-4" />
                  <p className="font-black text-[10px] uppercase tracking-widest">No Archived Report Packages Found</p>
               </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFieldworkTab = (job: Job) => {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300 space-y-6">
        <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-sm">
           <div>
              <h3 className="text-sm font-black tracking-tight">Psychrometric Analysis</h3>
              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-0.5">Automated GPP Calculations</p>
           </div>
           <button onClick={() => handleAddReading('Kitchen')} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all">
              <Thermometer size={14} /> New Record
           </button>
        </div>
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-3">Room/Date</th>
                    <th className="px-6 py-3">Temp</th>
                    <th className="px-6 py-3">RH %</th>
                    <th className="px-6 py-3">GPP</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">EQ</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 overflow-y-auto scrollbar-hide">
                 {job.readings.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-bold italic text-xs">No moisture logs identified for this project.</td></tr>
                 ) : job.readings.map(r => {
                    const status = getDryingStatus(r.gpp);
                    return (
                       <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3"><p className="text-xs font-black text-slate-800">{r.room}</p><p className="text-[8px] font-bold text-slate-400">{r.date}</p></td>
                          <td className="px-6 py-3"><input type="number" value={r.temp} onChange={e => updateReading(r.id, 'temp', parseInt(e.target.value))} className="w-12 bg-slate-50 border-none rounded p-1 text-xs font-black" /></td>
                          <td className="px-6 py-3"><input type="number" value={r.rh} onChange={e => updateReading(r.id, 'rh', parseInt(e.target.value))} className="w-12 bg-slate-50 border-none rounded p-1 text-xs font-black" /></td>
                          <td className="px-6 py-3"><span className="text-[10px] font-black text-blue-600 font-mono">{r.gpp}</span></td>
                          <td className="px-6 py-3"><span className={`text-[8px] font-black uppercase tracking-widest ${status.color}`}>{status.label}</span></td>
                          <td className="px-6 py-3 text-right">
                             <button onClick={() => updateReading(r.id, 'equipmentActive', !r.equipmentActive)} className={`p-1.5 rounded-lg ${r.equipmentActive ? 'text-blue-600 bg-blue-50' : 'text-slate-300'}`}><Zap size={12} fill={r.equipmentActive ? 'currentColor' : 'none'} /></button>
                          </td>
                       </tr>
                    );
                 })}
              </tbody>
           </table>
        </div>
      </div>
    );
  };

  const renderLogisticsTab = (job: Job) => {
    const linkedConv = MOCK_CONVERSATIONS.find(c => c.contactId === job.contactId);
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6 self-start">
           <button onClick={() => setLogisticsSubTab('notes')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${logisticsSubTab === 'notes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><ClipboardList size={14} /> Intelligence Logs</button>
           <button onClick={() => setLogisticsSubTab('comms')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${logisticsSubTab === 'comms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><MessageCircle size={14} /> Active Comms</button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {logisticsSubTab === 'notes' ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide pb-24">
                {job.notes.map(n => (
                  <div key={n.id} className={`p-5 rounded-2xl border ${n.isAiGenerated ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-200'}`}>
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center gap-2">
                         {n.isAiGenerated ? <Bot size={12} className="text-blue-600" /> : <div className="w-4 h-4 bg-slate-800 rounded flex items-center justify-center text-[7px] text-white font-black">{n.author[0]}</div>}
                         <span className="text-[8px] font-black text-slate-800 uppercase tracking-widest">{n.isAiGenerated ? 'AI Insights' : n.author}</span>
                      </div>
                      <span className="text-[7px] font-black text-slate-300 uppercase">{n.timestamp}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{n.content}"</p>
                  </div>
                ))}
                {job.notes.length === 0 && <div className="flex flex-col items-center justify-center h-40 opacity-20"><MessageSquare size={32}/><p className="text-[10px] font-black uppercase mt-2">No intelligence recorded</p></div>}
              </div>
              <div className="pt-4 border-t border-slate-100 bg-white">
                 <div className="relative">
                    <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Add job note..." className="w-full pl-5 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/10" />
                    <button onClick={() => { if (!noteInput.trim()) return; const newNote = { id: Date.now().toString(), author: 'Admin', content: noteInput, timestamp: 'Just now' }; const updated = { ...selectedJob!, notes: [newNote, ...selectedJob!.notes] }; setJobs(prev => prev.map(j => j.id === selectedJob!.id ? updated : j)); setSelectedJob(updated); setNoteInput(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"><Send size={14} fill="currentColor" /></button>
                 </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-slate-50 rounded-3xl border border-slate-200 shadow-inner overflow-hidden flex flex-col">
              {!linkedConv ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-6 text-center opacity-50">
                   <Smartphone size={32} className="mb-2" />
                   <p className="font-black text-[9px] uppercase tracking-widest">No Linked Comms</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                     {linkedConv.messages.map(msg => (
                       <div key={msg.id} className={`flex flex-col ${msg.sender === 'contact' ? 'items-start' : 'items-end'}`}>
                          <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-xs font-bold border shadow-sm ${msg.sender === 'contact' ? 'bg-white border-slate-200' : 'bg-blue-600 border-blue-500 text-white'}`}>
                            <p className="leading-relaxed">{msg.content}</p>
                            <p className="text-[7px] font-black uppercase mt-1.5 opacity-60 text-right">{msg.timestamp}</p>
                          </div>
                       </div>
                     ))}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                     <input placeholder="Type SMS..." className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none" />
                     <button className="p-2 bg-blue-600 text-white rounded-lg"><Send size={14} fill="currentColor" /></button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFinancialsTab = (job: Job) => {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6 self-start">
           <button onClick={() => setFinancialsSubTab('estimates')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${financialsSubTab === 'estimates' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><FileSpreadsheet size={14} /> Estimates</button>
           <button onClick={() => setFinancialsSubTab('invoices')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${financialsSubTab === 'invoices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Receipt size={14} /> Invoices</button>
           <button onClick={() => setFinancialsSubTab('payments')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${financialsSubTab === 'payments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Wallet size={14} /> Payments</button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {financialsSubTab === 'estimates' ? (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-200 cursor-pointer">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:text-blue-500 transition-colors"><FileSpreadsheet size={20} /></div>
                 <div><p className="text-xs font-black text-slate-800">Standard Mitigation Scope</p><p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Xactimate Sync • $2,450.22</p></div>
              </div>
              <Download size={16} className="text-slate-200 group-hover:text-blue-50" />
            </div>
          ) : (
            <div className="p-16 text-center opacity-20 flex flex-col items-center grayscale"><Receipt size={40} className="mb-2" /><p className="font-black text-[10px] uppercase tracking-widest">Awaiting financial sync...</p></div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="font-black text-xs uppercase tracking-[0.3em]">Downloading Deployment Data...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50 relative text-slate-900">
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
        <div><h2 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">Job Pipeline</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Operations Matrix</p></div>
        <div className="flex items-center gap-3">
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
                {jobs.filter(j => j.stage === stage && (j.title.toLowerCase().includes(searchTerm.toLowerCase()))).map((job) => (
                  <div key={job.id} onClick={() => { setSelectedJob(job); setActiveJobTab('briefing'); }} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group cursor-pointer active:scale-[0.98]">
                    <div className="flex justify-between items-start mb-3">
                      <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${job.urgency === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{job.urgency}</div>
                      <div className="text-[8px] font-black text-slate-300 uppercase">{job.timestamp}</div>
                    </div>
                    <h4 className="font-black text-slate-800 text-xs leading-tight mb-3 group-hover:text-blue-600 transition-colors truncate">{job.title}</h4>
                    <div className="flex items-center gap-2 text-slate-500"><User size={10} className="text-slate-300" /><span className="text-[10px] font-bold truncate">{getContact(job.contactId)?.name}</span></div>
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Project Info</span><ArrowRight size={12} className="text-slate-300 group-hover:text-blue-600" /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8"><div className="bg-white rounded-3xl border border-slate-200 p-20 text-center opacity-20"><ListIcon size={32} className="mx-auto" /><p className="mt-4 font-black text-xs uppercase tracking-widest">Optimizing list views...</p></div></div>
      )}

      {/* Main Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-[500] flex items-center justify-end p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-[1250px] h-full md:h-[96vh] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in slide-in-from-right-10 duration-500">
            
            {/* COMPACT HEADER */}
            <div className="px-8 py-5 bg-slate-900 text-white flex-shrink-0 flex items-center justify-between relative">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-inner ${selectedJob.urgency === 'High' ? 'bg-red-600' : 'bg-blue-600'}`}>{selectedJob.title[0]}</div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black tracking-tight leading-none mb-1 truncate">{selectedJob.title}</h3>
                  <div className="flex items-center gap-3">
                     <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${selectedJob.urgency === 'High' ? 'border-red-500/30 text-red-400' : 'border-blue-500/30 text-blue-400'}`}>{selectedJob.urgency} Priority</div>
                     <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                     <div className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest"><CheckCircle2 size={10} /> {selectedJob.stage}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden lg:flex flex-col items-end gap-0.5 text-right">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest font-mono">FILE_ID: {selectedJob.id.toUpperCase()}</span>
                  <span className="text-[8px] font-bold text-white/40 uppercase tracking-tight">Project Sync Active</span>
                </div>
                <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"><X size={24} /></button>
              </div>
            </div>

            {/* TAB NAVIGATION - INTEGRATED & COMPACT */}
            <div className="bg-slate-900 border-t border-white/5 px-8 flex-shrink-0 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 py-2">
                {[ 
                  { id: 'briefing', label: 'Briefing', icon: <ClipboardList size={12} /> }, 
                  { id: 'fieldwork', label: 'Fieldwork', icon: <Thermometer size={12} /> }, 
                  { id: 'documentation', label: 'Documentation', icon: <FolderOpen size={12} /> },
                  { id: 'logistics', label: 'Logistics', icon: <History size={12} /> }, 
                  { id: 'financials', label: 'Financials', icon: <DollarSign size={12} /> }, 
                  { id: 'compliance', label: 'Compliance', icon: <ShieldCheck size={12} /> } 
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveJobTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeJobTab === tab.id ? 'bg-white text-slate-900' : 'text-white/40 hover:text-white/70'}`}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN CONTENT - MAXIMIZED SPACE */}
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-slate-50/50">
              {activeJobTab === 'briefing' && renderBriefingTab(selectedJob)}
              {activeJobTab === 'fieldwork' && renderFieldworkTab(selectedJob)}
              {activeJobTab === 'documentation' && renderDocumentationTab(selectedJob)}
              {activeJobTab === 'logistics' && renderLogisticsTab(selectedJob)}
              {activeJobTab === 'financials' && renderFinancialsTab(selectedJob)}
              {activeJobTab === 'compliance' && <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-30"><Shield size={40} /><p className="font-black text-[9px] uppercase tracking-widest mt-4">Security module locked</p></div>}
            </div>

            {/* COMPACT FOOTER ACTIONS */}
            <div className="px-8 py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-4 flex-shrink-0">
              <button onClick={() => deleteJob(selectedJob.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Project"><Trash2 size={18} /></button>
              <div className="flex gap-3 flex-1 justify-end">
                <button onClick={handleEditDetails} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"><RefreshCw size={12} /> Edit Intel</button>
                {STAGES.indexOf(selectedJob.stage) < STAGES.length - 1 && (
                  <button onClick={() => moveJob(selectedJob.id, 'next')} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">Promote Stage <ArrowRight size={14} /></button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/New Intel Modal */}
      {isNewJobModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 flex flex-col my-auto max-h-[92vh]">
            <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">{newJobForm.id ? <Edit2 size={20} /> : <Briefcase size={20} />}</div>
                <div><h3 className="text-lg font-black uppercase tracking-tight">{newJobForm.id ? 'Refine Project' : 'Deploy Project'}</h3><p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Enterprise Sync Core</p></div>
              </div>
              <button onClick={() => setIsNewJobModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="flex bg-slate-100 p-1 mx-8 mt-6 rounded-2xl border border-slate-200 flex-shrink-0">
               {[
                 { id: 'basic', label: 'Basic' },
                 { id: 'loss', label: 'Loss Assessment' },
                 { id: 'insurance', label: 'Insurance' },
                 { id: 'stakeholders', label: 'Stakeholders' }
               ].map(tab => (
                  <button key={tab.id} onClick={() => setNewJobFormTab(tab.id as any)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${newJobFormTab === tab.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>{tab.label}</button>
               ))}
            </div>
            <form onSubmit={handleSaveJob} className="p-8 space-y-6 overflow-y-auto scrollbar-hide flex-1">
               {newJobFormTab === 'basic' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Project Title</label><input required type="text" value={newJobForm.title} onChange={e => setNewJobForm({...newJobForm, title: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" /></div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Priority</label><select value={newJobForm.urgency} onChange={e => setNewJobForm({...newJobForm, urgency: e.target.value as any})} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
                        <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Prop Type</label><select value={newJobForm.customFields?.property_type} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, property_type: e.target.value}})} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"><option value="Residential">Residential</option><option value="Commercial">Commercial</option></select></div>
                     </div>
                     <div><label className="block text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Incident Summary</label><textarea rows={3} value={newJobForm.customFields?.incident_summary} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, incident_summary: e.target.value}})} className="w-full px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-xs font-bold italic" /></div>
                  </div>
               )}
               {newJobFormTab === 'loss' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Source of Damage</label><input type="text" value={newJobForm.customFields?.source_of_damage} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, source_of_damage: e.target.value}})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="e.g. Kitchen Pipe Burst" /></div>
                     <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Service Needed</label><input type="text" value={newJobForm.customFields?.service_needed} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, service_needed: e.target.value}})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="e.g. Water Extraction / Drying" /></div>
                     <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Areas Affected (Impacted)</label><textarea rows={2} value={newJobForm.customFields?.areas_affected} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, areas_affected: e.target.value}})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="e.g. Kitchen, Living Room, Hallway" /></div>
                  </div>
               )}
               {newJobFormTab === 'insurance' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                        <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Insurance Provider</label><input type="text" value={newJobForm.customFields?.insurance_provider} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, insurance_provider: e.target.value}})} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" /></div>
                        <div className="grid grid-cols-2 gap-4">
                           <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Claim Number</label><input type="text" value={newJobForm.customFields?.claim_number} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, claim_number: e.target.value}})} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono" /></div>
                           <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Policy Number</label><input type="text" value={newJobForm.customFields?.policy_number} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, policy_number: e.target.value}})} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono" /></div>
                        </div>
                     </div>
                     <div className="bg-blue-50/30 p-6 rounded-3xl border border-blue-100 space-y-4">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] block mb-2 px-1">Adjuster Information</span>
                        <div className="grid grid-cols-2 gap-4">
                           <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Name</label><input type="text" value={newJobForm.customFields?.adjuster_name} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, adjuster_name: e.target.value}})} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" /></div>
                           <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email</label><input type="email" value={newJobForm.customFields?.adjuster_email} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, adjuster_email: e.target.value}})} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" /></div>
                        </div>
                     </div>
                  </div>
               )}
               {newJobFormTab === 'stakeholders' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 relative">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Crown size={12} className="text-amber-500" /> Owner / DM</span>
                        <div className="relative">
                          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-600/10">
                            <Search size={14} className="text-slate-300 mr-3" />
                            <input 
                              type="text" 
                              placeholder="Search for existing contact..." 
                              value={ownerSearch || newJobForm.customFields?.owner_dm_name}
                              onChange={(e) => { setOwnerSearch(e.target.value); setIsOwnerSearchOpen(true); }}
                              onFocus={() => setIsOwnerSearchOpen(true)}
                              className="flex-1 bg-transparent border-none outline-none text-xs font-bold" 
                            />
                            {newJobForm.customFields?.owner_dm_name && (
                              <button type="button" onClick={() => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, owner_dm_name: '', owner_dm_phone: ''}})} className="text-slate-300 hover:text-red-500"><X size={14} /></button>
                            )}
                          </div>
                          {isOwnerSearchOpen && ownerSearch && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-2 overflow-hidden">
                              <div className="max-h-40 overflow-y-auto scrollbar-hide space-y-1">
                                {filteredOwnerContacts.map(c => (
                                  <button key={c.id} type="button" onClick={() => handleLinkContact('owner', c)} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl flex items-center justify-between">
                                    <div><p className="text-[11px] font-black text-slate-800">{c.name}</p><p className="text-[9px] font-bold text-slate-400">{c.phone}</p></div>
                                    <span className="text-[7px] font-black uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c.type}</span>
                                  </button>
                                ))}
                                {filteredOwnerContacts.length === 0 && <div className="p-4 text-center text-[9px] font-black text-slate-300 uppercase">No contacts found</div>}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <DataItem label="Linked Name" value={newJobForm.customFields?.owner_dm_name} />
                           <DataItem label="Linked Phone" value={newJobForm.customFields?.owner_dm_phone} />
                        </div>
                     </div>

                     <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 relative">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={12} /> Tenant (If Applicable)</span>
                        <div className="relative">
                          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-600/10">
                            <Search size={14} className="text-slate-300 mr-3" />
                            <input 
                              type="text" 
                              placeholder="Search for existing contact..." 
                              value={tenantSearch || newJobForm.customFields?.tenant_name}
                              onChange={(e) => { setTenantSearch(e.target.value); setIsTenantSearchOpen(true); }}
                              onFocus={() => setIsTenantSearchOpen(true)}
                              className="flex-1 bg-transparent border-none outline-none text-xs font-bold" 
                            />
                            {newJobForm.customFields?.tenant_name && (
                              <button type="button" onClick={() => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, tenant_name: '', tenant_phone: ''}})} className="text-slate-300 hover:text-red-500"><X size={14} /></button>
                            )}
                          </div>
                          {isTenantSearchOpen && tenantSearch && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-2 overflow-hidden">
                              <div className="max-h-40 overflow-y-auto scrollbar-hide space-y-1">
                                {filteredTenantContacts.map(c => (
                                  <button key={c.id} type="button" onClick={() => handleLinkContact('tenant', c)} className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl flex items-center justify-between">
                                    <div><p className="text-[11px] font-black text-slate-800">{c.name}</p><p className="text-[9px] font-bold text-slate-400">{c.phone}</p></div>
                                    <span className="text-[7px] font-black uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c.type}</span>
                                  </button>
                                ))}
                                {filteredTenantContacts.length === 0 && <div className="p-4 text-center text-[9px] font-black text-slate-300 uppercase">No contacts found</div>}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <DataItem label="Linked Name" value={newJobForm.customFields?.tenant_name} />
                           <DataItem label="Linked Phone" value={newJobForm.customFields?.tenant_phone} />
                        </div>
                     </div>

                     <div className="space-y-4">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Work Authorization</label>
                        <select value={newJobForm.customFields?.work_authorized} onChange={e => setNewJobForm({...newJobForm, customFields: {...newJobForm.customFields, work_authorized: e.target.value}})} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold shadow-sm mb-4"><option value="No">No (Pending Auth)</option><option value="Yes">Yes (Auth Executed)</option></select>
                        
                        {newJobForm.customFields?.work_authorized === 'Yes' && (
                          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] animate-in slide-in-from-top-2 duration-300 space-y-4">
                             <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2"><FileCheck size={14} /> Authorization Payload</span>
                                <div className="flex gap-2">
                                  <div className="relative">
                                    <button type="button" onClick={() => setIsFilePickerOpen(!isFilePickerOpen)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-600 rounded-lg text-[9px] font-black uppercase border border-emerald-200 shadow-sm hover:bg-emerald-50 transition-colors"><Link size={10} /> Link File</button>
                                    {isFilePickerOpen && (
                                      <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-2 overflow-hidden">
                                        <p className="text-[8px] font-black text-slate-400 uppercase p-2 border-b border-slate-50">Account Vault</p>
                                        <div className="max-h-40 overflow-y-auto scrollbar-hide">
                                          {ACCOUNT_FILES.map(f => (
                                            <button key={f.id} type="button" onClick={() => handleAttachWorkAuth(f)} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-3">
                                              <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-slate-400"><File size={12} /></div>
                                              <div className="min-w-0 flex-1"><p className="text-[10px] font-black text-slate-700 truncate">{f.name}</p></div>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-emerald-700 transition-colors"><UploadCloud size={10} /> Upload New</button>
                                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                </div>
                             </div>
                             
                             <div className="space-y-2">
                                {newJobForm.documents?.filter(d => d.type === 'form').length === 0 ? (
                                  <p className="text-[10px] italic text-emerald-600 opacity-60">No authorization document attached.</p>
                                ) : (
                                  newJobForm.documents?.filter(d => d.type === 'form').map(doc => (
                                    <div key={doc.id} className="bg-white p-3 rounded-2xl border border-emerald-100 flex items-center justify-between shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner"><FileText size={14} /></div>
                                        <div className="min-w-0"><p className="text-xs font-black text-slate-800 truncate">{doc.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase">{doc.timestamp}</p></div>
                                      </div>
                                      <button type="button" onClick={() => setNewJobForm({...newJobForm, documents: newJobForm.documents.filter(d => d.id !== doc.id)})} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                                    </div>
                                  ))
                                )}
                             </div>
                          </div>
                        )}
                     </div>
                  </div>
               )}
               <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/90 backdrop-blur-md pb-2 mt-auto">
                 <button type="button" onClick={() => setIsNewJobModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-[9px] tracking-widest">Cancel</button>
                 <button type="submit" disabled={isSaving} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                    {newJobForm.id ? 'Sync Updates' : 'Deploy Project'}
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
