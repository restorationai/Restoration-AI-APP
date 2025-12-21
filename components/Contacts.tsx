
import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Tag as TagIcon, 
  Mail, 
  Phone, 
  MapPin, 
  ExternalLink,
  ChevronRight,
  UserPlus,
  // Added missing Smartphone icon import
  Smartphone
} from 'lucide-react';
import { MOCK_CONTACTS } from '../constants';
import { Contact } from '../types';

const Contacts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = MOCK_CONTACTS.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 text-slate-900">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Contact CRM</h2>
          <p className="text-slate-500 text-sm">Manage your leads, technicians, and partners in one unified directory.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all">
          <UserPlus size={18} />
          Create Contact
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, email, or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-bold hover:bg-slate-50 shadow-sm transition-all">
              <Filter size={16} />
              Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-bold hover:bg-slate-50 shadow-sm transition-all">
              <TagIcon size={16} />
              Tags
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-[0.15em]">
                <th className="px-8 py-5">Contact Details</th>
                <th className="px-8 py-5">Pipeline Stage</th>
                <th className="px-8 py-5">Tags & Indicators</th>
                <th className="px-8 py-5">Last Activity</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-blue-600">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-base flex items-center gap-2">
                          {contact.name}
                          <ExternalLink size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-blue-500" />
                        </p>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                            <Smartphone size={10} /> {contact.phone}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                            <Mail size={10} /> {contact.email}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200">
                      {contact.pipelineStage}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                      {contact.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded-md border border-blue-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold text-slate-500">{contact.lastActivity}</span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2.5 text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 hover:bg-white rounded-xl transition-all">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredContacts.length === 0 && (
          <div className="p-20 text-center text-slate-300">
            <Search size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold">No contacts found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Contacts;
