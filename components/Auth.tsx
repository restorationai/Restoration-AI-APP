
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2, Building2, User, Phone, ArrowRight, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // 1. Sign up the user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("Authentication failed to initialize.");

        // 2. Create the company entry
        // Note: If email confirmation is ON, this might still fail if RLS is strictly 'authenticated'
        const companyId = `CO-${Date.now()}`;
        const { error: companyError } = await supabase
          .from('companies')
          .insert({ 
            id: companyId, 
            name: companyName,
            status: 'Active',
            joined_date: new Date().toISOString()
          });

        if (companyError) {
          console.error("Company Creation Error:", companyError);
          // If we get an RLS error here, it's usually because the user isn't 'logged in' yet (email confirm pending)
          if (companyError.code === '42501') {
            throw new Error("Security Policy Denied: Please ensure 'Confirm Email' is disabled in Supabase Auth settings, or check RLS policies.");
          }
          throw new Error(companyError.message);
        }

        // 3. Create the user profile linked to that company
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            company_id: companyId,
            full_name: fullName,
            role: 'admin'
          });

        if (profileError) {
          console.error("Profile Creation Error:", profileError);
          throw new Error(profileError.message);
        }

        setMessage({ 
          type: 'success', 
          text: 'Onboarding successful! If you do not see a dashboard, please check your email to verify your account.' 
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Auth System Error:", err);
      const errorText = err.message || "An unexpected system error occurred.";
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0f172a] text-white">
      {/* Branding Side */}
      <div className="hidden md:flex md:w-1/2 p-16 flex-col justify-between bg-gradient-to-br from-blue-700 to-blue-900 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-blue-500 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-emerald-500 rounded-full blur-[120px] opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-white text-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/50">
              <Zap size={28} fill="currentColor" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Restoration AI</h1>
          </div>
          <div className="space-y-8">
            <h2 className="text-5xl font-black leading-tight max-w-lg">The Operating System for Restoration Pros.</h2>
            <p className="text-blue-100 text-lg font-medium leading-relaxed max-w-md">Proprietary dispatching, AI voice agents, and multi-tenant CRM built specifically for the field.</p>
          </div>
        </div>

        <div className="relative z-10 pt-10">
          <div className="flex gap-4">
             <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10 backdrop-blur-md text-center min-w-[120px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Live Agents</p>
                <p className="text-xl font-black">24/7/365</p>
             </div>
             <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10 backdrop-blur-md text-center min-w-[120px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Sync Status</p>
                <p className="text-xl font-black">Encrypted</p>
             </div>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-20 relative">
        <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center md:text-left">
            <h3 className="text-3xl font-black tracking-tight mb-2">
              {isSignUp ? 'Onboard Your Agency' : 'System Access'}
            </h3>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">
              {isSignUp ? 'Enterprise Multi-Tenant Node' : 'Authenticated Deployment Only'}
            </p>
          </div>

          {message && (
            <div className={`p-5 rounded-2xl border flex items-start gap-3 text-xs font-bold animate-in zoom-in-95 duration-300 ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              {message.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
              <span className="break-words leading-relaxed">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {isSignUp && (
              <>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input required type="text" placeholder="Restoration Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm text-white" />
                </div>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input required type="text" placeholder="Full Name (Admin)" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm text-white" />
                </div>
              </>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input required type="email" placeholder="Professional Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm text-white" />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input required type="password" placeholder="System Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm text-white" />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
              {isSignUp ? 'Finalize Roster' : 'Begin Deployment'}
            </button>
          </form>

          <div className="text-center space-y-4">
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="text-slate-400 hover:text-blue-400 text-xs font-black uppercase tracking-widest transition-colors"
            >
              {isSignUp ? 'Already Onboarded? System Login' : 'Need Enterprise Access? Sign Up'}
            </button>
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">Restoration AI Secure Neural Gateway v2.4</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
