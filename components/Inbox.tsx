import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  MoreVertical, 
  Send, 
  Bot, 
  Mail, 
  Globe, 
  Tag, 
  Smartphone, 
  Plus, 
  Paperclip, 
  Smile, 
  Hash, 
  Star, 
  Pause, 
  Phone, 
  X,
  Check,
  CheckCheck,
  Play,
  Users,
  MessageCircle,
  Archive,
  UserCircle,
  Loader2,
  AlertCircle,
  User,
  ChevronRight
} from 'lucide-react';
import { ConversationSource, ContactType, Conversation, Message, Contact } from '../types';
import { fetchConversations, fetchMessages, sendMessageToDb, getCurrentUser, supabase, fetchContactsFromSupabase, createConversation } from '../lib/supabase';

type SidebarSection = 'inbox' | 'internal-chat';
type FilterType = 'all' | 'unread' | 'starred' | 'homeowner' | 'partner';

const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SidebarSection>('inbox');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'Email' | 'Chat'>('SMS');
  const [composerText, setComposerText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const selectedContact = contacts.find(c => c.id === selectedConv?.contactId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedConv?.messages]);

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

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `company_id=eq.${companyId}` }, async (payload) => {
        const newMessage = payload.new as any;
        
        if (payload.eventType === 'INSERT') {
          const formatted: Message = {
            id: newMessage.id,
            sender: (newMessage.sender_type === 'User' ? 'agent' : newMessage.sender_type === 'Contact' ? 'contact' : 'ai') as any,
            sender_type: newMessage.sender_type,
            message_type: newMessage.message_type,
            senderId: newMessage.sender_id,
            content: newMessage.content,
            timestamp: new Date(newMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: newMessage.message_type as any,
            status: newMessage.status as any,
            direction: newMessage.direction as 'inbound' | 'outbound'
          };
          
          setConversations(prev => {
            const updated = prev.map(c => 
              c.id === newMessage.conversation_id 
                ? { 
                    ...c, 
                    messages: c.id === selectedConvId ? [...c.messages, formatted] : c.messages, 
                    lastMessage: newMessage.content, 
                    lastMessagePreview: newMessage.content, 
                    last_message_at: newMessage.created_at,
                    timestamp: 'Just now', 
                    isUnread: c.id !== selectedConvId 
                  } 
                : c
            );
            return [...updated].sort((a, b) => 
              new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
            );
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `company_id=eq.${companyId}` }, (payload) => {
        const nc = payload.new as any;
        setConversations(prev => [{
          id: String(nc.id),
          contactId: nc.contact_id,
          lastMessage: nc.last_message || '',
          lastMessagePreview: nc.last_message_preview || nc.last_message || '',
          last_message_at: nc.last_message_at,
          timestamp: 'Just now',
          source: nc.source as any,
          status: nc.status as any,
          urgency: nc.urgency as any,
          isStarred: nc.is_starred,
          isUnread: nc.is_unread,
          type: nc.type as 'external' | 'internal',
          messages: []
        }, ...prev]);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [companyId, selectedConvId]);

  useEffect(() => {
    if (!selectedConvId) return;
    const loadMsgs = async () => {
      const msgs = await fetchMessages(selectedConvId);
      setConversations(prev => prev.map(c => c.id === selectedConvId ? { ...c, messages: msgs, isUnread: false } : c));
    };
    loadMsgs();
  }, [selectedConvId]);

  const filteredConversations = conversations.filter(c => {
    // Advisor Recommended Logic: Separation based on 'type' column
    if (activeSection === 'internal-chat' && c.type !== 'internal') return false;
    if (activeSection === 'inbox' && c.type === 'internal') return false;
    
    if (activeFilter === 'unread') return c.isUnread;
    if (activeFilter === 'starred') return c.isStarred;
    return true;
  });

  const filteredContactsList = useMemo(() => {
    return contacts.filter(c => 
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone.includes(contactSearch)
    );
  }, [contacts, contactSearch]);

  const handleSendMessage = async () => {
    if (!composerText.trim() || !selectedConvId || !companyId) return;
    const msgPayload = {
      sender: 'agent' as const,
      senderId: currentUserId || 'tm1',
      content: composerText,
      source: (selectedChannel.toLowerCase() === 'chat' ? (selectedConv?.type === 'internal' ? ConversationSource.INTERNAL : ConversationSource.CHAT) : selectedChannel.toLowerCase()) as ConversationSource
    };
    try {
      await sendMessageToDb(msgPayload, selectedConvId, companyId);
      setComposerText('');
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleStartNewConversation = async (contactId: string) => {
    if (!companyId) return;
    
    const existing = conversations.find(c => c.contactId === contactId);
    if (existing) {
      setSelectedConvId(existing.id);
      setIsNewMessageModalOpen(false);
      return;
    }

    try {
      const newConv = await createConversation(contactId, companyId);
      setConversations(prev => [newConv, ...prev]);
      setSelectedConvId(newConv.id);
      setIsNewMessageModalOpen(false);
    } catch (err) {
      console.error("Failed to initialize conversation:", err);
      alert("Could not start conversation. Please try again.");
    }
  };

  const StatusIcon = ({ status }: { status?: string }) => {
    switch (status) {
      case 'delivered': return <CheckCheck size={12} className="text-blue-400" />;
      case 'sent': return <Check size={12} className="text-slate-400" />;
      case 'failed': return <AlertCircle size={12} className="text-red-500" />;
      case 'queued': return <Clock size={12} className="text-slate-300 animate-pulse" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="font-black text-[10px] uppercase tracking-widest">Opening Secure Comms Channel...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex animate-in fade-in duration-500 overflow-hidden text-slate-900 bg-white">
      <div className="w-64 border-r border-slate-100 flex flex-col p-4 bg-white z-30">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm">R</div>
          <span className="font-black text-sm uppercase tracking-tight text-slate-800">Unified Inbox</span>
        </div>
        <button 
          onClick={() => setIsNewMessageModalOpen(true)}
          className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 mb-8 shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={16} /> New Message
        </button>
        <div className="flex-1 space-y-2">
          <button onClick={() => { setActiveSection('inbox'); setSelectedConvId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSection === 'inbox' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users size={18} /> Company Inbox
          </button>
          <button onClick={() => { setActiveSection('internal-chat'); setSelectedConvId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${activeSection === 'internal-chat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <MessageCircle size={18} /> Internal Chat
          </button>
        </div>
      </div>

      <div className="w-80 lg:w-96 border-r border-slate-100 flex flex-col flex-shrink-0 z-20 bg-white">
        <div className="p-5 border-b border-slate-50">
          <div className="relative mb-5">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input type="text" placeholder="Search conversations..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900" />
          </div>
          <div className="flex gap-1.5">
            {['all', 'unread', 'starred'].map(f => (
              <button key={f} onClick={() => setActiveFilter(f as any)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all border ${activeFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filteredConversations.map((conv) => {
            const contact = contacts.find(c => c.id === conv.contactId);
            return (
              <button key={conv.id} onClick={() => setSelectedConvId(conv.id)} className={`w-full p-5 border-b border-slate-50 text-left transition-all relative ${selectedConvId === conv.id ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'}`}>
                {conv.isUnread && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full"></div>}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase">
                    {(contact?.name || conv.name || '??').split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-xs truncate">{contact?.name || conv.name || 'Chat'}</span>
                      <span className="text-[9px] font-black text-slate-300 uppercase">{conv.timestamp}</span>
                    </div>
                    <p className="text-[11px] truncate font-bold text-slate-400 leading-none">
                      {conv.lastMessagePreview || conv.lastMessage}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
        {selectedConv ? (
          <>
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase">
                  {(selectedContact?.name || selectedConv.name || '??').split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">{selectedContact?.name || selectedConv.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedContact?.phone || 'Internal'}</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/40 p-10 space-y-8 flex flex-col scrollbar-hide">
              {selectedConv.messages.map((msg) => {
                const isMe = msg.sender === 'agent' || msg.sender === 'ai';
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                    <div className={`p-5 rounded-[2rem] border ${isMe ? 'bg-blue-600 border-blue-500 rounded-tr-none text-white' : 'bg-white border-slate-200 rounded-tl-none text-slate-800'}`}>
                      <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
                      <div className={`flex items-center justify-end gap-2 mt-3 text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                        {msg.timestamp}
                        {isMe && <StatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 p-6 bg-white">
              <div className="flex gap-6 mb-4 px-2">
                {['SMS', 'Email', 'Chat'].map(c => (
                  <button key={c} onClick={() => setSelectedChannel(c as any)} className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] relative ${selectedChannel === c ? 'text-blue-600' : 'text-slate-300'}`}>
                    {c} {selectedChannel === c && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full"></div>}
                  </button>
                ))}
              </div>
              <div className="relative border border-slate-200 rounded-[2.5rem] p-5 bg-slate-50/30">
                <textarea placeholder="Type a message..." value={composerText} onChange={(e) => setComposerText(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 resize-none h-24" />
                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-1">
                    <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors"><Paperclip size={20} /></button>
                    <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors"><Smile size={20} /></button>
                  </div>
                  <button onClick={handleSendMessage} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-3">
                    <Send size={16} fill="currentColor" /> Send
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageSquare size={48} className="mb-4 opacity-10" />
            <p className="font-black text-[10px] uppercase tracking-[0.3em]">Select a conversation</p>
          </div>
        )}
      </div>

      {isNewMessageModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
             <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Plus size={24} /></div>
                  <h3 className="text-xl font-black uppercase tracking-tight">New Message</h3>
                </div>
                <button onClick={() => setIsNewMessageModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={28} /></button>
             </div>
             
             <div className="p-8 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search contacts..." 
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto scrollbar-hide space-y-2">
                  {filteredContactsList.map(contact => (
                    <button 
                      key={contact.id} 
                      onClick={() => handleStartNewConversation(contact.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-blue-50 transition-all text-left group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase shadow-sm group-hover:bg-blue-600 transition-colors">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-sm">{contact.name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{contact.phone}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </button>
                  ))}
                  {filteredContactsList.length === 0 && (
                    <div className="p-20 text-center text-slate-300">
                      <User size={32} className="mx-auto mb-4 opacity-20" />
                      <p className="font-black text-[10px] uppercase tracking-widest">No contacts found</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;