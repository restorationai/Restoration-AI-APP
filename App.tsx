
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Calendar, 
  Users, 
  GitBranch, 
  Settings as SettingsIcon,
  Bell,
  Search,
  ChevronDown,
  Menu,
  X,
  LogOut,
  FileText,
  Contact as ContactIcon,
  Phone,
  Delete,
  Loader2
} from 'lucide-react';
import DispatchScheduling from './components/DispatchScheduling.tsx';
import ManageAccount from './components/ManageAccount.tsx';
import Inbox from './components/Inbox.tsx';
import Contacts from './components/Contacts.tsx';
import Placeholder from './components/Placeholder.tsx';
import UnifiedCalendar from './components/UnifiedCalendar.tsx';
import { INITIAL_COMPANY_SETTINGS } from './constants.tsx';
import { fetchCompanySettings } from './lib/supabase.ts';
import { RestorationCompany } from './types.ts';

type Tab = 'dashboard' | 'conversations' | 'calendars' | 'job-pipeline' | 'dispatch' | 'settings' | 'estimates-ai' | 'contacts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dispatch');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDialpad, setShowDialpad] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [companySettings, setCompanySettings] = useState<RestorationCompany>(INITIAL_COMPANY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        const liveSettings = await fetchCompanySettings(INITIAL_COMPANY_SETTINGS.id);
        if (liveSettings) {
          setCompanySettings(liveSettings);
        }
      } catch (err) {
        console.error("Failed to fetch initial company settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="font-black text-xs uppercase tracking-[0.3em]">Connecting to Sarah AI Neural Link...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dispatch':
        return <DispatchScheduling onOpenSettings={() => setShowAccountModal(true)} />;
      case 'conversations':
        return <Inbox />;
      case 'contacts':
        return <Contacts />;
      case 'calendars':
        return <UnifiedCalendar />;
      case 'job-pipeline':
        return <Placeholder title="Job Pipeline" icon={<GitBranch className="w-12 h-12" />} />;
      case 'estimates-ai':
        return <Placeholder title="Estimates AI" icon={<FileText className="w-12 h-12" />} />;
      case 'settings':
        return (
          <ManageAccount 
            onClose={() => setActiveTab('dispatch')} 
            isOpen={true} 
            companySettings={companySettings}
            onSettingsUpdate={setCompanySettings}
          />
        );
      default:
        return <Placeholder title={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} coming soon...`} icon={<LayoutDashboard className="w-12 h-12" />} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'conversations', label: 'Conversations', icon: <MessageSquare size={20} /> },
    { id: 'contacts', label: 'Contacts', icon: <ContactIcon size={20} /> },
    { id: 'calendars', label: 'Calendars', icon: <Calendar size={20} /> },
    { id: 'job-pipeline', label: 'Job Pipeline', icon: <GitBranch size={20} /> },
    { id: 'dispatch', label: 'Dispatch Scheduling', icon: <Users size={20} /> },
    { id: 'estimates-ai', label: 'Estimates AI', icon: <FileText size={20} /> },
  ];

  const handleDialClick = (num: string) => setDialNumber(prev => prev + num);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col z-50 shadow-2xl`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="font-black text-xl">R</span>
          </div>
          {isSidebarOpen && <span className="font-black text-lg whitespace-nowrap tracking-tight">Restoration AI</span>}
        </div>

        <nav className="flex-1 mt-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center px-4 py-3 transition-colors ${
                activeTab === item.id 
                  ? 'bg-blue-600/10 border-r-4 border-blue-600 text-blue-400' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {isSidebarOpen && <span className="ml-3 font-black uppercase text-[10px] tracking-widest">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <button onClick={() => setShowAccountModal(true)} className="w-full flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white">
            <SettingsIcon size={20} />
            {isSidebarOpen && <span className="ml-3 font-black uppercase text-[10px] tracking-widest">Settings</span>}
          </button>
          <button className="w-full flex items-center px-4 py-3 text-red-400 hover:bg-red-900/20">
            <LogOut size={20} />
            {isSidebarOpen && <span className="ml-3 font-black uppercase text-[10px] tracking-widest">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg">
              <Menu size={20} className="text-slate-600" />
            </button>
            <h1 className="text-lg font-black uppercase tracking-tight text-slate-800">
              {navItems.find(i => i.id === activeTab)?.label || 'Settings'}
            </h1>
          </div>

          <div className="flex items-center gap-4 relative">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Global search..." className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-blue-500 font-medium" />
            </div>
            
            <div className="relative">
              <button onClick={() => setShowDialpad(!showDialpad)} className={`p-2 rounded-full transition-all ${showDialpad ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Phone size={20} />
              </button>
              
              {showDialpad && (
                <div className="absolute top-full right-0 mt-4 w-72 bg-white rounded-[2rem] shadow-2xl border border-slate-200 p-6 z-[100] animate-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">Smart Dialer</h4>
                    <button onClick={() => setShowDialpad(false)} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>
                  </div>
                  <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center flex items-center justify-center relative">
                    <span className="text-xl font-black text-slate-800 tracking-wider">{dialNumber || 'Enter Number'}</span>
                    {dialNumber && <button onClick={() => setDialNumber(prev => prev.slice(0, -1))} className="absolute right-3 p-1.5 text-slate-300 hover:text-red-500"><Delete size={16} /></button>}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {['1','2','3','4','5','6','7','8','9','*','0','#'].map((n) => (
                      <button key={n} onClick={() => handleDialClick(n)} className="w-full aspect-square rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-lg text-slate-700 hover:bg-slate-50 active:scale-95 shadow-sm">{n}</button>
                    ))}
                  </div>
                  <button className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3">
                    <Phone size={20} fill="currentColor" /> Connect Call
                  </button>
                </div>
              )}
            </div>

            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            <button className="flex items-center gap-2 hover:bg-slate-100 p-1.5 rounded-xl transition-all">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs">
                {companySettings.name?.split(' ').map(n => n[0]).join('') || 'RA'}
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-slate-50/50">
          {renderContent()}
        </div>

        {showAccountModal && (
          <ManageAccount 
            isOpen={showAccountModal} 
            onClose={() => setShowAccountModal(false)}
            companySettings={companySettings}
            onSettingsUpdate={setCompanySettings}
          />
        )}
      </main>
    </div>
  );
};

export default App;
