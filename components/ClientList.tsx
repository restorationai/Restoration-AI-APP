
import React from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Mail,
  Phone
} from 'lucide-react';
import { MOCK_RESTORATION_COMPANIES } from '../constants';

const ClientList: React.FC = () => {
  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Restoration Companies</h2>
          <p className="text-slate-500">Manage your software clients and their subscription status.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
          <Plus size={20} />
          Onboard New Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Total Clients</p>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">{MOCK_RESTORATION_COMPANIES.length}</span>
            <span className="text-emerald-500 text-sm font-bold flex items-center mb-1">
              <TrendingUp size={16} /> +2 this month
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Active AI Agents</p>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">12</span>
            <span className="text-slate-400 text-sm font-medium mb-1">Across all clients</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Total Monthly Dispatches</p>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-800">276</span>
            <span className="text-blue-500 text-sm font-medium mb-1">System wide</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Filter by company or owner name..." 
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-2 outline-none">
              <option>All Statuses</option>
              <option>Active</option>
              <option>Past Due</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Owner</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Total Jobs</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_RESTORATION_COMPANIES.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{company.name}</p>
                        <p className="text-xs text-slate-400">Joined {company.joinedDate}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{company.ownerName}</p>
                    <div className="flex gap-2 mt-1">
                      <button className="text-slate-400 hover:text-blue-600"><Mail size={14} /></button>
                      <button className="text-slate-400 hover:text-blue-600"><Phone size={14} /></button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      company.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {company.status === 'Active' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {company.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-slate-600">{company.plan}</span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">
                    {company.totalDispatches}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientList;
