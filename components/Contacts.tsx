
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  ExternalLink,
  UserPlus,
  Smartphone,
  Building2,
  Trash2,
  X,
  Briefcase,
  Users,
  Crown,
  Loader2,
  Save,
  LayoutGrid,
  List as ListIcon,
  ShieldCheck,
  MoreHorizontal,
  Home,
  User
} from 'lucide-react';
import { Contact, ContactType } from '../types';
import { syncContactToSupabase, fetchContactsFromSupabase } from '../lib/supabase';
import { formatPhoneNumberInput } from '../utils/phoneUtils.ts';

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const Contacts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSegment, setActiveSegment] = useState<ContactType | 'All'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [addrParts, setAddrParts] = useState({
    street: '',
    city: '',
    state: 'CA',
    zip: ''
  });

  const [contactForm, setContactForm] = useState<Partial<Contact>>({
    name: '',
    phone: '',
    email: '',
    company: '',
    type: ContactType.HOMEOWNER,
    notes: '',
    vipStatus: false,
    tags: []
  });

  useEffect(() => {
    const loadContacts = async () => {
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
            setCompanyId(profile.company_id);
            const fetched = await fetchContactsFromSupabase(profile.company_id);
            setContacts(fetched);
          }
        }
      } catch (err) {
        console.error("Failed to fetch contacts:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm);
      
      const matchesSegment = activeSegment === 'All' || c.type === activeSegment;
      
      return matchesSearch && matchesSegment;
    });
  }, [contacts, searchTerm, activeSegment]);

  const stats = useMemo(() => {
    const counts = contacts.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: contacts.length,
      vips: contacts.filter(c => c.vipStatus).length,
      counts,
      partnersTotal: contacts.filter(c => c.type === ContactType.REFERRAL_PARTNER || c.type === ContactType.PROPERTY_MANAGER).length,
      carriersTotal: contacts.filter(c => c.type === ContactType.INSURANCE_AGENT || c.type === ContactType.ADJUSTER || c.type === ContactType.TPA).length
    };
  }, [contacts]);

  const handleToggleVip = async (id: string, e: React.MouseEvent) => {
    if (!companyId) return;
    e.stopPropagation();
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    const updated = { ...contact, vipStatus: !contact.vipStatus };
    setContacts(prev => prev.map(c => c.id === id ? updated : c));
    
    try {
      await syncContactToSupabase(updated, companyId);
    } catch (err) {
      console.error("Failed to sync VIP status:", err);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setIsSaving(true);
    try {
      const fullAddress = `${addrParts.street}, ${addrParts.city}, ${addrParts.state} ${addrParts.zip}`;
      
      const newId = contactForm.id || `con-${Date.now()}`;
      const finalContact: Contact = {
        id: newId,
        name: contactForm.name || 'Unknown',
        phone: contactForm.phone || '', // lib/supabase.ts will handle E.164 conversion
        email: contactForm.email || '',
        address: fullAddress,
        company: contactForm.company,
        type: contactForm.type || ContactType.HOMEOWNER,
        vipStatus: contactForm.vipStatus || false,
        notes: contactForm.notes || '',
        tags: contactForm.tags || [],
        pipelineStage: contactForm.pipelineStage || 'Inbound',
        lastActivity: 'Just now',
        customFields: contactForm.customFields || {}
      };

      await syncContactToSupabase(finalContact, companyId);
      
      if (contactForm.id) {
        setContacts(prev => prev.map(c => c.id === newId ? finalContact : c));
      } else {
        setContacts(prev => [finalContact, ...prev]);
      }
      
      setIsAddingContact(false);
      resetForm();
    } catch (err: any) {
      alert(`Error saving contact: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setContactForm({ name: '', phone: '', email: '', company: '', type: ContactType.HOMEOWNER, notes: '', vipStatus: false, tags: [] });
    setAddrParts({ street: '', city: '', state: 'CA', zip: '' });
  };

  const openEdit = (contact: Contact) => {
    setContactForm(contact);
    const parts = contact.address.split(', ');
    if (parts.length >= 3) {
      const stateZip = parts[2].split(' ');
      setAddrParts({
        street: parts[0] || '',
        city: parts[1] || '',
        state: stateZip[0] || 'CA',
        zip: stateZip[1] || ''
      });
    } else {
      setAddrParts({ street: contact.address, city: '', state: 'CA', zip: '' });
    }
    setIsAddingContact(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="font-black text-xs uppercase tracking-[0.3em]">Connecting to Sarah AI CRM Hub...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50/50 overflow-hidden text-slate-900">
      {/* Sidebar Segments */}
      <div className="w-72 border-r border-slate-200 bg-white flex flex-col p-6 z-10 shadow-sm">
        <div className="mb-8">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
             <div className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><Briefcase size={16} /></div>
             CRM Segments
          </h2>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
          <button 
            onClick={() => setActiveSegment('All')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSegment === 'All' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3"><Users size={16} /> Full Directory</div>
            <span className={`px-2 py-0.5 rounded-lg text-[9px] ${activeSegment === 'All' ? 'bg-white/20' : 'bg-slate-100'}`}>{stats.total}</span>
          </button>
          
          <div className="pt-6 pb-2 px-4"><span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Client Categories</span></div>
          
          <button 
            onClick={() => setActiveSegment(ContactType.HOMEOWNER)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSegment === ContactType.HOMEOWNER ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3"><Home size={16} /> Homeowners</div>
            <span className={`px-2 py-0.5 rounded-lg text-[9px] ${activeSegment === ContactType.HOMEOWNER ? 'bg-white/20' : 'bg-slate-100'}`}>{stats.counts[ContactType.HOMEOWNER] || 0}</span>
          </button>

          <button 
            onClick={() => setActiveSegment(ContactType.RENTER)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSegment === ContactType.RENTER ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3"><User size={16} /> Renter/Tenants</div>
            <span className={`px-2 py-0.5 rounded-lg text-[9px] ${activeSegment === ContactType.RENTER ? 'bg-white/20' : 'bg-slate-100'}`}>{stats.counts[ContactType.RENTER] || 0}</span>
          </button>

          <div className="pt-6 pb-2 px-4"><span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Professional Partners</span></div>
          {[ContactType.REFERRAL_PARTNER, ContactType.PROPERTY_MANAGER, ContactType.INSURANCE_AGENT, ContactType.ADJUSTER, ContactType.TPA].map(type => (
            <button 
              key={type}
              onClick={() => setActiveSegment(type)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSegment === type ? 'bg-blue-900 text-white shadow-xl shadow-blue-900/20' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3"><Building2 size={16} /> {type}</div>
              <span className={`px-2 py-0.5 rounded-lg text-[9px] ${activeSegment === type ? 'bg-white/20' : 'bg-slate-100'}`}>{stats.counts[type] || 0}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-6 border-t border-slate-100 space-y-3">
           <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 flex items-center justify-between group cursor-default">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">VIP Partners</span>
                <p className="text-2xl font-black text-slate-800">{stats.vips}</p>
              </div>
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 border border-amber-100 group-hover:scale-110 transition-transform">
                <Crown size={20} />
              </div>
           </div>
           <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 flex items-center justify-between group cursor-default">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Carrier Network</span>
                <p className="text-2xl font-black text-slate-800">{stats.carriersTotal}</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 group-hover:scale-110 transition-transform">
                <ShieldCheck size={20} />
              </div>
           </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-10 py-8 border-b border-slate-200 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-10">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-2">
              {activeSegment === 'All' ? 'Full Directory' : activeSegment}
            </h2>
            <p className="text-sm font-bold text-slate-400">Total {filteredContacts.length} identified contacts in this segment.</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
               <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={20} /></button>
               <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><ListIcon size={20} /></button>
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Find contact or company..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 pl-12 pr-6 py-4 bg-slate-100 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
              />
            </div>
            
            <button 
              onClick={() => { resetForm(); setIsAddingContact(true); }}
              className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-slate-800 transition-all active:scale-95"
            >
              <UserPlus size={18} /> New Contact
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
          {filteredContacts.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {filteredContacts.map((contact) => (
                  <div key={contact.id} onClick={() => openEdit(contact)} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 group cursor-pointer relative overflow-hidden">
                    {contact.vipStatus && <div className="absolute top-0 right-0 p-6"><Crown size={20} className="text-amber-500 fill-amber-500/20" /></div>}
                    <div className="flex items-start gap-5 mb-8">
                      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-xl shadow-inner border-2 transition-colors ${contact.vipStatus ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100'}`}>{contact.name.split(' ').map(n => n[0]).join('')}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight truncate group-hover:text-blue-600 transition-colors">{contact.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">{contact.company || contact.type}</p>
                      </div>
                    </div>
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-3 text-slate-500"><Smartphone size={16} className="text-slate-300" /><span className="text-xs font-bold">{contact.phone}</span></div>
                      <div className="flex items-center gap-3 text-slate-500"><Mail size={16} className="text-slate-300" /><span className="text-xs font-bold truncate">{contact.email}</span></div>
                      <div className="flex items-center gap-3 text-slate-500"><MapPin size={16} className="text-slate-300" /><span className="text-xs font-bold truncate">{contact.address.split(',')[0]}</span></div>
                    </div>
                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex gap-2"><span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${contact.vipStatus ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{contact.type}</span></div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                         <button onClick={(e) => handleToggleVip(contact.id, e)} className={`p-2 rounded-xl transition-all ${contact.vipStatus ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`} title="Mark VIP"><Crown size={16} /></button>
                         <button className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><ExternalLink size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                       <tr><th className="px-8 py-5">Full Name / Entity</th><th className="px-8 py-5">Contact Details</th><th className="px-8 py-5">Relationship</th><th className="px-8 py-5">Address</th><th className="px-8 py-5 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {filteredContacts.map(contact => (
                          <tr key={contact.id} onClick={() => openEdit(contact)} className="group hover:bg-slate-50/50 cursor-pointer transition-colors">
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm border ${contact.vipStatus ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{contact.name.split(' ').map(n => n[0]).join('')}</div>
                                   <div><p className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">{contact.name}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{contact.company || 'Private Individual'}</p></div>
                                </div>
                             </td>
                             <td className="px-8 py-5"><div className="space-y-1"><p className="text-xs font-bold text-slate-700 flex items-center gap-2"><Smartphone size={12} className="text-slate-300" /> {contact.phone}</p><p className="text-xs font-bold text-slate-500 flex items-center gap-2"><Mail size={12} className="text-slate-300" /> {contact.email}</p></div></td>
                             <td className="px-8 py-5"><span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${contact.vipStatus ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{contact.type}</span></td>
                             <td className="px-8 py-5"><p className="text-xs font-bold text-slate-500 truncate max-w-[200px]">{contact.address}</p></td>
                             <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                   <button onClick={(e) => handleToggleVip(contact.id, e)} className={`p-2 rounded-lg transition-all ${contact.vipStatus ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'}`}><Crown size={16} /></button>
                                   <button className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><MoreHorizontal size={18} /></button>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-40 text-slate-300">
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm mb-6 opacity-40">
                  <Users size={32} />
               </div>
               <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-300">No contacts in this segment</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit/Add Contact Modal */}
      {isAddingContact && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-white/20">
            <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-blue-600/20">{contactForm.name ? contactForm.name.split(' ').map(n => n[0]).join('') : <UserPlus size={32} />}</div>
                <div><h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{contactForm.id ? 'Edit Contact' : 'New CRM Record'}</h3><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Phase 1: Permanent Identification</p></div>
              </div>
              <button onClick={() => setIsAddingContact(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button>
            </div>

            <form onSubmit={handleSaveContact} className="flex-1 p-10 space-y-8 bg-slate-50/50">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Full Name / Display Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all outline-none" placeholder="e.g. John Smith" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Cell Phone (Auto-Formatted) <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required 
                      value={contactForm.phone} 
                      onChange={e => setContactForm({...contactForm, phone: formatPhoneNumberInput(e.target.value)})} 
                      className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all outline-none" 
                      placeholder="(XXX) XXX-XXXX" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email Address <span className="text-red-500">*</span></label>
                    <input 
                      type="email" 
                      required
                      value={contactForm.email} 
                      onChange={e => setContactForm({...contactForm, email: e.target.value})} 
                      className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all outline-none invalid:border-red-500" 
                      placeholder="john@example.com" 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Associated Company / Branch</label>
                    <input type="text" value={contactForm.company} onChange={e => setContactForm({...contactForm, company: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all outline-none" placeholder="e.g. State Farm Claims SLO" />
                  </div>

                  {/* Deconstructed Address Grid */}
                  <div className="col-span-2 pt-4">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1 flex items-center gap-2"><MapPin size={12} /> Service Location Details</span>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="col-span-1 md:col-span-4">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Street Address</label>
                          <input type="text" required value={addrParts.street} onChange={e => setAddrParts({...addrParts, street: e.target.value})} className="w-full px-5 py-3.5 bg-white border border-slate-100 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" placeholder="123 Restoration Way" />
                       </div>
                       <div className="col-span-1 md:col-span-2">
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">City</label>
                          <input type="text" required value={addrParts.city} onChange={e => setAddrParts({...addrParts, city: e.target.value})} className="w-full px-5 py-3.5 bg-white border border-slate-100 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" placeholder="San Luis Obispo" />
                       </div>
                       <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">State</label>
                          <select value={addrParts.state} onChange={e => setAddrParts({...addrParts, state: e.target.value})} className="w-full h-[46px] px-5 py-3.5 bg-white border border-slate-100 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all cursor-pointer">
                             {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Zip Code</label>
                          <input type="text" required value={addrParts.zip} onChange={e => setAddrParts({...addrParts, zip: e.target.value.replace(/\D/g, '').slice(0, 5)})} className="w-full px-5 py-3.5 bg-white border border-slate-100 rounded-xl text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" placeholder="93401" />
                       </div>
                    </div>
                  </div>

                  <div className="pt-4 space-y-6 col-span-2">
                     <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Relationship Type</label>
                          <select value={contactForm.type} onChange={e => setContactForm({...contactForm, type: e.target.value as ContactType})} className="w-full h-[54px] px-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all outline-none cursor-pointer">
                             {Object.values(ContactType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button type="button" onClick={() => setContactForm({...contactForm, vipStatus: !contactForm.vipStatus})} className={`w-full h-[54px] flex items-center justify-center gap-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border ${contactForm.vipStatus ? 'bg-amber-500 border-amber-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}><Crown size={16} /> {contactForm.vipStatus ? 'VIP Partner Active' : 'Mark as VIP Partner'}</button>
                        </div>
                     </div>

                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Permanent CRM Notes</label>
                        <textarea value={contactForm.notes} onChange={e => setContactForm({...contactForm, notes: e.target.value})} rows={3} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-[2rem] text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all outline-none resize-none" placeholder="Add specific background info on this contact..." />
                     </div>
                  </div>
               </div>
               <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsAddingContact(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={isSaving || !contactForm.name || !contactForm.phone || !contactForm.email || !addrParts.street}
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? 'Saving...' : 'Sync to CRM'}
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
