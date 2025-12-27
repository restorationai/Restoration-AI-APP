
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  MessageSquare, 
  Clock, 
  MoreVertical, 
  Send, 
  Bot, 
  Mail, 
  Globe, 
  Smartphone, 
  Plus, 
  Paperclip, 
  Smile, 
  Star, 
  X,
  Check,
  CheckCheck,
  MessageCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Image as ImageIcon,
  User,
  Info
} from 'lucide-react';
import { ConversationSource, Conversation, Message, Contact } from '../types';
import { fetchConversations, fetchMessages, sendMessageToDb, getCurrentUser, supabase, fetchContactsFromSupabase, createConversation } from '../lib/supabase';

type SidebarSection = 'inbox' | 'internal-chat';
type FilterType = 'all' | 'unread' | 'starred';

const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SidebarSection>('inbox');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'Email' | 'Chat'>('SMS');
  const [composerText, setComposerText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedConv = useMemo(() => conversations.find(c => c.id === selectedConvId), [conversations, selectedConvId]);
  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedConv?.contactId), [contacts, selectedConv]);

  // Force scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedConv?.messages, isMessagesLoading]);

  // Initial Data Load
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const user = await getCurrentUser();
        if (user?.profile?.company_id) {
          setCompanyId(user.profile.company_id);
          setCurrentUserId(user.id);
          const [fetchedConvs, fetchedContacts] = await Promise.all([
            fetchConversations(user.profile.company_id),
            fetchContactsFromSupabase(user.profile.company_id)
          ]);
          setConversations(fetchedConvs);
          setContacts(fetchedContacts);
        }
      } catch (err) {
        console.error("Failed to load inbox:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Sync Messages when selecting a conversation
  useEffect(() => {
    if (!selectedConvId) return;
    
    const loadMsgs = async () => {
      setIsMessagesLoading(true);
      try {
        const msgs = await fetchMessages(selectedConvId);
        setConversations(prev => prev.map(c => 
          c.id === selectedConvId ? { ...c, messages: msgs, isUnread: false } : c
        ));
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        setIsMessagesLoading(false);
      }
    };
    loadMsgs();
  }, [selectedConvId]);

  // Real-time Subscriptions for Inserts and Updates
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`inbox-sync-v7-${companyId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `company_id=eq.${companyId}` 
      }, (payload) => {
        const newMessage = payload.new as any;
        
        const formatted: Message = {
          id: newMessage.id,
          sender: (newMessage.sender_type?.toLowerCase() === 'user' ? 'agent' : 
                   newMessage.sender_type?.toLowerCase() === 'contact' ? 'contact' : 
                   newMessage.sender_type?.toLowerCase() === 'ai' ? 'ai' : 'system') as any,
          sender_type: newMessage.sender_type,
          message_type: newMessage.message_type,
          senderId: newMessage.sender_id,
          content: newMessage.content,
          timestamp: new Date(newMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: newMessage.source as any,
          status: newMessage.status as any,
          direction: newMessage.direction as 'inbound' | 'outbound',
          mediaUrls: newMessage.media_urls || []
        };
        
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id === String(newMessage.conversation_id)) {
              const exists = c.messages.some(m => m.id === formatted.id);
              const previewText = newMessage.content || (newMessage.media_urls?.length ? 'Sent an attachment' : 'New Message');
              return { 
                ...c, 
                messages: exists ? c.messages : [...c.messages, formatted], 
                lastMessage: previewText,
                last_message_at: newMessage.created_at,
                timestamp: 'Just now',
                isUnread: c.id !== selectedConvId 
              };
            }
            return c;
          });
          return [...updated].sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
        });
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages', 
        filter: `company_id=eq.${companyId}` 
      }, (payload) => {
        const updatedMsg = payload.new as any;
        setConversations(prev => prev.map(c => {
          if (c.id === String(updatedMsg.conversation_id)) {
            return {
              ...c,
              messages: c.messages.map(m => m.id === updatedMsg.id ? { ...m, status: updatedMsg.status } : m)
            };
          }
          return c;
        }));
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [companyId, selectedConvId]);

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const matchesCategory = activeSection === 'internal-chat' ? c.category === 'internal_chat' : c.category === 'company_inbox';
      const matchesFilter = activeFilter === 'all' ? true : (activeFilter === 'unread' ? c.isUnread : c.isStarred);
      return matchesCategory && matchesFilter;
    });
  }, [conversations, activeSection, activeFilter]);

  const handleSendMessage = async () => {
    if (!composerText.trim() || !selectedConvId || !companyId || isSending) {
      return;
    }
    
    setIsSending(true);
    let source = ConversationSource.SMS;
    if (selectedChannel === 'Email') source = ConversationSource.EMAIL;
    if (selectedChannel === 'Chat') source = selectedConv?.category === 'internal_chat' ? ConversationSource.INTERNAL : ConversationSource.CHAT;

    try {
      await sendMessageToDb({
        sender: 'agent',
        senderId: currentUserId || 'tm1',
        content: composerText,
        source: source
      }, selectedConvId, companyId);
      setComposerText('');
    } catch (err: any) {
      console.error("Dispatch Sync Failed:", err.message || err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartNewConversation = async (contactId: string) => {
    if (!companyId) return;
    const existing = conversations.find(c => c.contactId === contactId);
    if (existing) { setSelectedConvId(existing.id); setIsNewMessageModalOpen(false); return; }
    try {
      const newConv = await createConversation(contactId, companyId);
      setConversations(prev => [newConv, ...prev]);
      setSelectedConvId(newConv.id);
      setIsNewMessageModalOpen(false);
    } catch (err) { console.error(err); }
  };

  const SourceIcon = ({ source, size = 12, className }: { source: string, size?: number, className?: string }) => {
    switch (source?.toLowerCase()) {
      case 'sms': return <Smartphone size={size} className={className} />;
      case 'email': return <Mail size={size} className={className} />;
      case 'chat': return <Globe size={size} className={className} />;
      case 'internal': return <ShieldCheck size={size} className={className} />;
      default: return <MessageSquare size={size} className={className} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Loading Secure Thread...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex animate-in fade-in duration-500 overflow-hidden text-slate-900 bg-slate-50/30">
      {/* Sidebar - Segments */}
      <div className="w-20 lg:w-64 border-r border-slate-200 flex flex-col bg-white z-30 shadow-sm">
        <div className="p-6 mb-4 flex items-center justify-center lg:justify-start gap-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20"><MessageCircle size={24} /></div>
          <h2 className="hidden lg:block font-black text-lg tracking-tight">Comms</h2>
        </div>
        
        <div className="px-4 mb-8">
           <button onClick={() => setIsNewMessageModalOpen(true)} className="w-full h-12 lg:h-auto lg:py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 shadow-xl hover:bg-blue-700 transition-all active:scale-95">
            <Plus size={20} /> <span className="hidden lg:block">Compose</span>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => { setActiveSection('inbox'); setSelectedConvId(null); }} className={`w-full flex items-center justify-center lg:justify-start gap-4 px-4 py-3.5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSection === 'inbox' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-50'}`}>
            <MessageSquare size={20} /> <span className="hidden lg:block">Client Inbox</span>
          </button>
          <button onClick={() => { setActiveSection('internal-chat'); setSelectedConvId(null); }} className={`w-full flex items-center justify-center lg:justify-start gap-4 px-4 py-3.5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSection === 'internal-chat' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-400 hover:bg-slate-50'}`}>
            <ShieldCheck size={20} /> <span className="hidden lg:block">Staff Chat</span>
          </button>
        </nav>
      </div>

      {/* Thread List */}
      <div className="w-80 lg:w-[380px] border-r border-slate-200 flex flex-col flex-shrink-0 z-20 bg-white">
        <div className="p-6 border-b border-slate-100 space-y-5">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input type="text" placeholder="Search threads..." className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" />
          </div>
          <div className="flex gap-2">
            {['all', 'unread', 'starred'].map(f => (
              <button key={f} onClick={() => setActiveFilter(f as any)} className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${activeFilter === f ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>{f}</button>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50/20">
          {filteredConversations.length > 0 ? filteredConversations.map((conv) => {
            const contact = contacts.find(c => c.id === conv.contactId);
            const isActive = selectedConvId === conv.id;
            const displayName = contact?.name || conv.name || 'Unknown Contact';
            return (
              <button key={conv.id} onClick={() => setSelectedConvId(conv.id)} className={`w-full p-6 border-b border-slate-100 text-left transition-all relative group ${isActive ? 'bg-white shadow-inner ring-1 ring-slate-100' : 'hover:bg-white'}`}>
                {conv.isUnread && <div className="absolute right-6 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-600 rounded-full shadow-lg"></div>}
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center font-black text-xs uppercase shadow-sm border-2 transition-all ${isActive ? 'bg-blue-600 text-white border-blue-100' : 'bg-slate-100 text-slate-400 border-white'}`}>
                    {displayName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-[13px] text-slate-800 truncate">{displayName}</span>
                      <span className="text-[9px] font-black text-slate-300 uppercase whitespace-nowrap">{conv.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <SourceIcon source={conv.source} size={10} className="text-slate-400" />
                       <p className={`text-[12px] truncate font-bold leading-tight ${conv.isUnread ? 'text-slate-900' : 'text-slate-400'}`}>{conv.lastMessagePreview || conv.lastMessage}</p>
                    </div>
                  </div>
                </div>
              </button>
            );
          }) : (
            <div className="p-20 text-center opacity-30 flex flex-col items-center">
               <MessageSquare size={48} className="mb-4 text-slate-300" />
               <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Thread Inbox Empty</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Display */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white shadow-2xl">
        {selectedConv ? (
          <>
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white/90 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center font-black text-xs uppercase text-white shadow-lg ${selectedConv.category === 'internal_chat' ? 'bg-slate-900' : 'bg-blue-600'}`}>
                  {(selectedContact?.name || selectedConv.name || '??').split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-[15px] tracking-tight">{selectedContact?.name || selectedConv.name || 'Unknown Contact'}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedContact?.phone || 'Outbound Protocol'}</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Sarah AI Monitoring</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                 <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Star size={20} /></button>
                 <button className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all"><MoreVertical size={20} /></button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/20 p-8 lg:p-10 space-y-10 flex flex-col scrollbar-hide">
              {isMessagesLoading ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                    <Loader2 className="animate-spin text-blue-600 mb-4" size={28} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing History...</span>
                 </div>
              ) : selectedConv.messages.map((msg, idx) => {
                const sType = (msg.sender_type || '').toLowerCase();
                const isContact = sType === 'contact';
                const isAgent = sType === 'user' || sType === 'agent';
                const isAI = sType === 'ai';
                const isSystem = sType === 'system';
                
                const isOutbound = isAgent || isAI || isSystem;
                const isAuditLog = isSystem && !msg.direction;

                if (isAuditLog) {
                  return (
                    <div key={msg.id || idx} className="flex flex-col items-center gap-3 my-6 animate-in fade-in zoom-in-95 duration-500">
                       <div className="flex items-center gap-3 px-6 py-2.5 bg-white border border-slate-200 rounded-full shadow-sm">
                          <Info size={14} className="text-blue-500" />
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{msg.content}</p>
                       </div>
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-tight">{msg.timestamp}</span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id || idx} className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} max-w-[85%] lg:max-w-[70%] ${isOutbound ? 'self-end' : 'self-start'} group animate-in slide-in-from-${isOutbound ? 'right' : 'left'}-4 duration-300`}>
                    <div className="flex items-center gap-2 mb-1.5 px-3">
                       {isOutbound && (
                         <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                           {isAI && <><Bot size={10} className="text-purple-500" /> Sarah AI</>}
                           {isAgent && <><User size={10} className="text-blue-500" /> Human Agent</>}
                           {isSystem && <><AlertCircle size={10} className="text-slate-500" /> Automated Relay</>}
                         </span>
                       )}
                       {isContact && <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{selectedContact?.name || 'Inbound Party'}</span>}
                    </div>

                    <div className={`relative p-5 lg:p-6 rounded-[2rem] border text-[14px] font-bold leading-relaxed whitespace-pre-wrap shadow-sm transition-all ${
                      isContact ? 'bg-white border-slate-200 text-slate-800 rounded-tl-none' : 
                      isAgent ? 'bg-blue-600 border-blue-500 text-white rounded-tr-none shadow-blue-600/10' :
                      isAI ? 'bg-purple-600 border-purple-500 text-white rounded-tr-none shadow-purple-600/10' :
                      'bg-slate-800 border-slate-700 text-white rounded-tr-none shadow-slate-900/10'
                    }`}>
                      {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                        <div className="mb-4 grid grid-cols-1 gap-2">
                           {msg.mediaUrls.map((url, i) => (
                             <img key={i} src={url} className="rounded-2xl max-h-[400px] w-full object-cover border border-white/20 shadow-lg" alt="Attachment" />
                           ))}
                        </div>
                      )}
                      
                      {msg.content}
                      
                      <div className={`flex items-center justify-end gap-2 mt-4 text-[9px] font-black uppercase tracking-widest ${isOutbound ? 'text-white/40' : 'text-slate-300'}`}>
                         <SourceIcon source={msg.source || 'sms'} size={10} className="" />
                         {msg.timestamp} 
                         {isOutbound && (msg.status === 'delivered' ? <CheckCheck size={12} className="text-blue-200" /> : <Check size={12} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 p-8 bg-white shadow-2xl">
              <div className="flex gap-8 mb-5 px-4">
                {[
                  { id: 'SMS', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-600' },
                  { id: 'Email', icon: Mail, color: 'text-slate-700', bg: 'bg-slate-900' },
                  { id: 'Chat', icon: Globe, color: 'text-emerald-600', bg: 'bg-emerald-600' }
                ].map(c => (
                  <button key={c.id} onClick={() => setSelectedChannel(c.id as any)} className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] relative flex items-center gap-2.5 transition-all ${selectedChannel === c.id ? c.color : 'text-slate-300'}`}>
                    <c.icon size={14} /> {c.id} {selectedChannel === c.id && <div className={`absolute bottom-0 left-0 right-0 h-[3px] rounded-full ${c.bg}`}></div>}
                  </button>
                ))}
              </div>
              
              <div className="relative border-2 border-slate-100 rounded-[2.8rem] p-7 lg:p-8 bg-slate-50/50 shadow-inner group-focus-within:border-blue-600/30 transition-all">
                <textarea 
                  placeholder={`Send ${selectedChannel} to ${selectedContact?.name || 'Client'}...`} 
                  value={composerText} 
                  onChange={e => setComposerText(e.target.value)} 
                  className="w-full bg-transparent border-none outline-none text-[15px] font-bold text-slate-800 placeholder:text-slate-300 resize-none min-h-[70px]" 
                  onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                />
                <div className="flex items-center justify-between mt-6">
                  <div className="flex gap-3">
                    <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-2xl transition-all shadow-sm"><Paperclip size={22} /></button>
                    <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-2xl transition-all shadow-sm"><Smile size={22} /></button>
                    <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-2xl transition-all shadow-sm"><ImageIcon size={22} /></button>
                  </div>
                  <button 
                    onClick={handleSendMessage} 
                    disabled={!composerText.trim() || isSending} 
                    className={`px-12 py-4 rounded-[1.6rem] font-black uppercase text-[11px] tracking-widest shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] transition-all flex items-center gap-4 active:scale-95 disabled:opacity-30 ${
                      selectedChannel === 'SMS' ? 'bg-blue-600 text-white hover:bg-blue-700' : 
                      selectedChannel === 'Email' ? 'bg-slate-900 text-white hover:bg-black' : 
                      'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} fill="currentColor" />} 
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/40">
            <div className="w-28 h-28 bg-white rounded-[3rem] border border-slate-100 shadow-xl flex items-center justify-center mb-8 opacity-40 animate-pulse">
              <Bot size={56} className="text-slate-200" />
            </div>
            <h4 className="font-black text-xs uppercase tracking-[0.4em] text-slate-400">Sarah AI: Neural Relay Active</h4>
            <p className="text-[10px] font-bold text-slate-400 mt-2 opacity-60 text-center uppercase tracking-widest">Awaiting session link initiation</p>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {isNewMessageModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
             <div className="px-10 py-9 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30"><Plus size={32} /></div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">New Thread</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">CRM Secure Routing</p>
                  </div>
                </div>
                <button onClick={() => setIsNewMessageModalOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button>
             </div>
             
             <div className="p-10 space-y-8">
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search CRM Directory..." 
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm font-bold outline-none focus:ring-8 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all"
                  />
                </div>

                <div className="max-h-[350px] overflow-y-auto scrollbar-hide space-y-2">
                  {contacts.filter(c => (c.name || '').toLowerCase().includes(contactSearch.toLowerCase()) || (c.phone || '').includes(contactSearch)).map(contact => (
                    <button key={contact.id} onClick={() => handleStartNewConversation(contact.id)} className="w-full flex items-center justify-between p-5 rounded-[1.8rem] hover:bg-blue-50 transition-all text-left border border-transparent hover:border-blue-100 group">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-[1rem] bg-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center font-black text-[11px] uppercase text-slate-400">
                          {(contact.name || '??').split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-[14px] leading-none mb-1.5">{contact.name || 'Unnamed Contact'}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{contact.phone} • {contact.type}</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-600 transition-all" />
                    </button>
                  ))}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
