
import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  MoreVertical, 
  Send, 
  Bot, 
  ShieldAlert, 
  Power, 
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
  ChevronDown, 
  UserPlus, 
  Users, 
  MessageCircle, 
  Archive, 
  UserCircle, 
  X,
  Check,
  Play
} from 'lucide-react';
import { MOCK_CONTACTS, MOCK_CONVERSATIONS, MOCK_TEAM, INITIAL_COMPANY_SETTINGS } from '../constants';
import { ConversationSource, ContactType, Conversation, Message } from '../types';

type SidebarSection = 'inbox' | 'internal-chat';
type FilterType = 'all' | 'unread' | 'starred' | 'homeowner' | 'partner';

const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selectedConvId, setSelectedConvId] = useState(MOCK_CONVERSATIONS[0].id);
  const [activeSection, setActiveSection] = useState<SidebarSection>('inbox');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedChannel, setSelectedChannel] = useState<'SMS' | 'Email' | 'Chat'>('SMS');
  const [composerText, setComposerText] = useState('');
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedMembersForGroup, setSelectedMembersForGroup] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const selectedContact = MOCK_CONTACTS.find(c => c.id === selectedConv?.contactId);

  // Helper to get display name for a team member
  const getMemberDisplayName = (memberId: string) => {
    const member = MOCK_TEAM.find(m => m.id === memberId);
    if (memberId === 'tm1' || member?.isMe) return INITIAL_COMPANY_SETTINGS.name;
    return member?.name || 'Unknown User';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setShowTagMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredConversations = conversations.filter(c => {
    if (activeSection === 'internal-chat' && !c.isInternal) return false;
    if (activeSection === 'inbox' && c.isInternal) return false;

    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return c.isUnread;
    if (activeFilter === 'starred') return c.isStarred;
    
    if (activeSection === 'inbox') {
      const contact = MOCK_CONTACTS.find(con => con.id === c.contactId);
      if (activeFilter === 'homeowner') return contact?.type === ContactType.HOMEOWNER;
      if (activeFilter === 'partner') return contact?.type === ContactType.REFERRAL_PARTNER;
    }
    
    return true;
  });

  const handleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConversations(prev => prev.map(c => c.id === id ? { ...c, isStarred: !c.isStarred } : c));
  };

  const selectConversation = (id: string) => {
    setSelectedConvId(id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, isUnread: false } : c));
  };

  const handleSendMessage = () => {
    if (!composerText.trim() || !selectedConv) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      sender: 'agent',
      senderId: 'tm1',
      content: composerText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: (selectedChannel.toLowerCase() === 'chat' ? (selectedConv.isInternal ? ConversationSource.INTERNAL : ConversationSource.CHAT) : selectedChannel.toLowerCase()) as ConversationSource
    };

    setConversations(prev => prev.map(c => 
      c.id === selectedConvId 
        ? { ...c, messages: [...c.messages, newMessage], lastMessage: composerText, timestamp: 'Just now' } 
        : c
    ));
    setComposerText('');
  };

  const toggleUnread = () => {
    if (!selectedConv) return;
    setConversations(prev => prev.map(c => 
      c.id === selectedConvId ? { ...c, isUnread: !c.isUnread } : c
    ));
  };

  const startNewMessage = (targetId: string, isTeam: boolean) => {
    const existing = conversations.find(c => 
      isTeam 
        ? (c.isInternal && c.teamMemberIds?.length === 2 && c.teamMemberIds.includes(targetId) && c.teamMemberIds.includes('tm1'))
        : (c.contactId === targetId)
    );
    
    if (existing) {
      setActiveSection(isTeam ? 'internal-chat' : 'inbox');
      selectConversation(existing.id);
      setIsNewMessageModalOpen(false);
    } else {
      const newConvId = `new-conv-${Date.now()}`;
      const newConv: Conversation = {
        id: newConvId,
        isInternal: isTeam,
        teamMemberIds: isTeam ? ['tm1', targetId] : undefined,
        contactId: isTeam ? undefined : targetId,
        name: isTeam ? getMemberDisplayName(targetId) : undefined,
        lastMessage: 'Starting new conversation...',
        timestamp: 'Just now',
        source: isTeam ? ConversationSource.INTERNAL : ConversationSource.SMS,
        status: 'ai-active',
        urgency: 'Low',
        isStarred: false,
        isUnread: false,
        messages: []
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveSection(isTeam ? 'internal-chat' : 'inbox');
      setSelectedConvId(newConvId);
      setIsNewMessageModalOpen(false);
    }
  };

  const createGroupChat = () => {
    if (selectedMembersForGroup.length < 1) return;
    
    const teamIds = ['tm1', ...selectedMembersForGroup].sort();
    
    // Check for existing group with these exact members to prevent duplicates
    const existingGroup = conversations.find(c => 
      c.isInternal && 
      c.teamMemberIds?.length === teamIds.length &&
      c.teamMemberIds.slice().sort().every((id, idx) => id === teamIds[idx])
    );

    if (existingGroup) {
      setActiveSection('internal-chat');
      selectConversation(existingGroup.id);
      setIsNewMessageModalOpen(false);
      setIsCreatingGroup(false);
      setSelectedMembersForGroup([]);
      return;
    }
    
    const groupName = teamIds.map(id => getMemberDisplayName(id).split(' ')[0]).join(', ');
    
    const newGroupId = `group-${Date.now()}`;
    const newGroup: Conversation = {
      id: newGroupId,
      isInternal: true,
      teamMemberIds: teamIds,
      name: groupName,
      lastMessage: 'Group chat created',
      timestamp: 'Just now',
      source: ConversationSource.INTERNAL,
      status: 'resolved',
      urgency: 'Low',
      isStarred: false,
      isUnread: false,
      messages: [
        { id: `sys-${Date.now()}`, sender: 'system', content: `Group chat created with ${teamIds.length} members`, timestamp: 'Just now', source: 'system' }
      ]
    };
    
    setConversations(prev => [newGroup, ...prev]);
    setActiveSection('internal-chat');
    setSelectedConvId(newGroupId);
    setIsNewMessageModalOpen(false);
    setIsCreatingGroup(false);
    setSelectedMembersForGroup([]);
  };

  const getSourceIcon = (source: ConversationSource | 'system') => {
    switch (source) {
      case ConversationSource.VOICE: return <PhoneCall size={14} />;
      case ConversationSource.SMS: return <Smartphone size={14} />;
      case ConversationSource.EMAIL: return <Mail size={14} />;
      case ConversationSource.CHAT: return <Globe size={14} />;
      case ConversationSource.INTERNAL: return <MessageCircle size={14} />;
      default: return <MessageSquare size={14} />;
    }
  };

  const getSourceColor = (source: ConversationSource | 'system') => {
    switch (source) {
      case ConversationSource.VOICE: return 'bg-blue-50 text-blue-600';
      case ConversationSource.SMS: return 'bg-emerald-50 text-emerald-600';
      case ConversationSource.EMAIL: return 'bg-amber-50 text-amber-600';
      case 'system': return 'bg-slate-50 text-slate-500';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  return (
    <div className="h-full flex animate-in fade-in duration-500 overflow-hidden text-slate-900 bg-white">
      <input type="file" ref={fileInputRef} className="hidden" />

      {/* Left Navigation Sidebar */}
      <div className="w-64 border-r border-slate-100 flex flex-col p-4 bg-white z-30">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm">R</div>
          <span className="font-black text-sm uppercase tracking-tight text-slate-800">Unified Inbox</span>
        </div>

        <button 
          onClick={() => {
            setIsNewMessageModalOpen(true);
            setIsCreatingGroup(false);
          }}
          className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 mb-8 shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={16} />
          New Message
        </button>

        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          <button 
            onClick={() => { setActiveSection('inbox'); setActiveFilter('all'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${
              activeSection === 'inbox' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Users size={18} />
            Company Inbox
          </button>
          
          <button 
            onClick={() => { setActiveSection('internal-chat'); setActiveFilter('all'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest ${
              activeSection === 'internal-chat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <MessageCircle size={18} />
            Internal Chat
          </button>
        </div>
      </div>

      {/* Conversation List Pane */}
      <div className="w-80 lg:w-96 border-r border-slate-100 flex flex-col flex-shrink-0 z-20 bg-white">
        <div className="p-5 border-b border-slate-50">
          <div className="relative mb-5">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-900 placeholder:text-slate-300"
            />
          </div>
          
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'starred', label: 'Starred' },
              ...(activeSection === 'inbox' ? [
                { id: 'homeowner', label: 'Homeowners' },
                { id: 'partner', label: 'Partners' }
              ] : [])
            ].map((f) => (
              <button 
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap border ${
                  activeFilter === f.id 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filteredConversations.map((conv) => {
            const contact = MOCK_CONTACTS.find(c => c.id === conv.contactId);
            const isInternal = conv.isInternal;
            
            return (
              <button 
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`w-full p-5 border-b border-slate-50 text-left transition-all relative group ${
                  selectedConvId === conv.id ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'
                }`}
              >
                {conv.isUnread && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full shadow-lg"></div>
                )}
                {selectedConvId === conv.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {isInternal ? (
                      conv.teamMemberIds?.slice(0, 3).map(id => {
                        const memberName = getMemberDisplayName(id);
                        return (
                          <div key={id} className="w-10 h-10 rounded-2xl border-2 border-white bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-500 shadow-sm overflow-hidden">
                            {memberName.split(' ').map(n => n[0]).join('')}
                          </div>
                        );
                      })
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md">
                        {contact?.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-black text-xs truncate ${conv.isUnread ? 'text-slate-900' : 'text-slate-600'}`}>
                        {isInternal ? (conv.name || 'Team Chat') : contact?.name}
                      </span>
                      <span className="text-[9px] font-black text-slate-300 uppercase">{conv.timestamp}</span>
                    </div>
                    <p className={`text-[11px] truncate font-bold leading-none mb-2 ${conv.isUnread ? 'text-slate-800' : 'text-slate-400'}`}>
                      {conv.lastMessage}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${getSourceColor(conv.source)} opacity-80`}>
                        {getSourceIcon(conv.source)}
                      </div>
                      {conv.isStarred && <Star size={10} className="text-amber-400 fill-amber-400" />}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transcript Pane */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
        {selectedConv ? (
          <>
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between z-10 bg-white/80 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {selectedConv.isInternal ? (
                    selectedConv.teamMemberIds?.map(id => {
                      const memberName = getMemberDisplayName(id);
                      return (
                        <div key={id} className="w-10 h-10 rounded-2xl border-2 border-white bg-slate-800 text-white flex items-center justify-center font-black text-[10px] shadow-lg">
                          {memberName.split(' ').map(n => n[0]).join('')}
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg">
                      {selectedContact?.name.split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                    {selectedConv.isInternal ? (selectedConv.name || 'Team Chat') : selectedContact?.name}
                    {!selectedConv.isInternal && <Star size={14} onClick={(e) => handleStar(e, selectedConv.id)} className={`cursor-pointer transition-colors ${selectedConv.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-200 hover:text-slate-400'}`} />}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-0.5">
                    {selectedConv.isInternal ? `${selectedConv.teamMemberIds?.length} Members` : selectedContact?.phone}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!selectedConv.isInternal && (
                   <>
                    <button className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Start Call" onClick={() => alert('Dialing...')}>
                      <Phone size={18} fill="currentColor" />
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                  </>
                )}
                
                <div className="relative" ref={tagMenuRef}>
                  <button 
                    className={`p-2.5 rounded-xl transition-all ${showTagMenu ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`} 
                    title="Manage Tags"
                    onClick={() => setShowTagMenu(!showTagMenu)}
                  >
                    <Tag size={18} />
                  </button>
                  {showTagMenu && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 z-[100] animate-in slide-in-from-top-2 duration-300">
                      <div className="flex justify-between items-center mb-4 px-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Incident Labels</p>
                        <X size={14} className="cursor-pointer text-slate-300 hover:text-slate-600" onClick={() => setShowTagMenu(false)} />
                      </div>
                      <div className="space-y-1">
                        {['Urgent Lead', 'Water Extraction', 'Follow Up Required', 'Quote Sent', 'Insurance Approved'].map(t => (
                          <button key={t} className="w-full text-left px-4 py-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 rounded-2xl flex items-center justify-between group transition-all">
                            {t}
                            <Plus size={14} className="text-slate-200 group-hover:text-blue-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Reminder" onClick={() => alert('Reminder set')}><Clock size={18} /></button>
                <button className={`p-2.5 rounded-xl transition-all ${selectedConv.isUnread ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`} title="Mark Unread" onClick={toggleUnread}><Mail size={18} /></button>
                <button className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Archive"><Archive size={18} /></button>
                <div className="w-px h-6 bg-slate-100 mx-1"></div>
                <button className="p-2.5 text-slate-400 hover:text-slate-800 rounded-xl"><MoreVertical size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/40 p-10 space-y-8 flex flex-col scrollbar-hide">
              {selectedConv.messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-60">
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm mb-4">
                      <MessageSquare size={32} />
                   </div>
                   <p className="font-black text-[10px] uppercase tracking-widest">No messages yet. Say hello!</p>
                </div>
              ) : (
                selectedConv.messages.map((msg) => {
                  const isMe = msg.senderId === 'tm1';
                  const isSystem = msg.source === 'system';
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center py-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white/50 px-10 py-2 rounded-full border border-slate-100/50">{msg.content}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${isMe ? 'self-end' : 'self-start'} animate-in slide-in-from-bottom-1 duration-300`}>
                      <div className={`flex gap-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`p-5 rounded-[2rem] shadow-sm border ${isMe ? 'bg-blue-600 border-blue-500 rounded-tr-none text-white' : 'bg-white border-slate-200 rounded-tl-none text-slate-800'}`}>
                          <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
                          <div className={`flex items-center gap-2 mt-3 text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                             {msg.timestamp}
                             <span className="w-1 h-1 bg-current rounded-full opacity-30"></span>
                             {getSourceIcon(msg.source as ConversationSource)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 p-6 bg-white shadow-2xl z-20">
              <div className="flex gap-6 mb-4 px-2">
                {['SMS', 'Email', 'Chat'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setSelectedChannel(c as any)}
                    className={`pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                      selectedChannel === c ? 'text-blue-600' : 'text-slate-300 hover:text-slate-600'
                    }`}
                  >
                    {c}
                    {selectedChannel === c && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full"></div>}
                  </button>
                ))}
              </div>
              
              <div className="relative border border-slate-200 rounded-[2.5rem] p-5 bg-slate-50/30 focus-within:bg-white transition-all shadow-inner">
                <textarea 
                  placeholder="Type a message..."
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 resize-none h-24 placeholder:text-slate-300"
                />
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors" title="Attach" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
                    <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors" title="Emoji"><Smile size={20} /></button>
                    <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors" title="Variable" onClick={() => setComposerText(p => p + '{{contact_name}} ')}><Hash size={20} /></button>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={handleSendMessage} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-3">
                      <Send size={16} fill="currentColor" /> Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <MessageSquare size={48} className="mb-4 opacity-5" />
            <p className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-300">Select a conversation</p>
          </div>
        )}
      </div>

      {/* New Message Modal Restored & Functional with Group Chat support */}
      {isNewMessageModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20">
            <div className="px-10 py-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 text-xl uppercase tracking-tight">
                  {isCreatingGroup ? 'Create Team Group Chat' : 'Create New Conversation'}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {isCreatingGroup ? 'Select members to include in group' : 'Select recipient from CRM or Team'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {!isCreatingGroup && (
                  <button 
                    onClick={() => setIsCreatingGroup(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-100 transition-all"
                  >
                    <Users size={14} /> Group Chat
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsNewMessageModalOpen(false);
                    setIsCreatingGroup(false);
                    setSelectedMembersForGroup([]);
                  }}
                  className="p-3 hover:bg-slate-200 rounded-2xl transition-all"
                >
                  <X size={24} className="text-slate-400 hover:text-slate-900" />
                </button>
              </div>
            </div>
            
            <div className="p-10 flex-1 overflow-y-auto space-y-10 scrollbar-hide">
              {isCreatingGroup ? (
                <div>
                  <div className="space-y-3">
                    {MOCK_TEAM.filter(m => !m.isMe).map(m => (
                      <button 
                        key={m.id} 
                        onClick={() => {
                          setSelectedMembersForGroup(prev => 
                            prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                          );
                        }} 
                        className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all text-left shadow-sm group border ${
                          selectedMembersForGroup.includes(m.id) ? 'border-blue-600 bg-blue-50' : 'bg-white border-slate-100 hover:border-blue-200'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-md transition-all ${
                          selectedMembersForGroup.includes(m.id) ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'
                        }`}>
                          {getMemberDisplayName(m.id).split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-slate-800">{getMemberDisplayName(m.id)}</p>
                          <p className="text-[10px] font-bold text-slate-400">{m.role}</p>
                        </div>
                        {selectedMembersForGroup.includes(m.id) && (
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedMembersForGroup.length > 0 && (
                    <button 
                      onClick={createGroupChat}
                      className="w-full mt-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-700"
                    >
                      Start Group Chat ({selectedMembersForGroup.length + 1} Members)
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <Users size={14} /> Team Directory
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {MOCK_TEAM.map(m => (
                        <button 
                          key={m.id} 
                          onClick={() => startNewMessage(m.id, true)} 
                          className="flex items-center gap-4 p-4 bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 rounded-3xl transition-all text-left shadow-sm group"
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-md transition-colors ${m.id === 'tm1' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white group-hover:bg-blue-600'}`}>
                            {getMemberDisplayName(m.id).split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800">{getMemberDisplayName(m.id)}</p>
                            <p className="text-[10px] font-bold text-slate-400">{m.role}{m.id === 'tm1' ? ' (Me)' : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <UserCircle size={14} /> Contact CRM
                    </h4>
                    <div className="space-y-3">
                      {MOCK_CONTACTS.map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => startNewMessage(c.id, false)} 
                          className="w-full flex items-center gap-4 p-4 bg-white border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 rounded-3xl transition-all text-left shadow-sm group"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs shadow-md group-hover:bg-blue-600 group-hover:text-white transition-all">
                            {c.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black text-slate-800">{c.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{c.phone}</p>
                          </div>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{c.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex justify-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Restoration AI Secure Messaging</p>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar Restored & Polished AI Control */}
      <div className="w-80 border-l border-slate-100 flex flex-col bg-slate-50/30 z-30">
        {selectedConv && selectedContact ? (
          <div className="p-8 space-y-8 h-full scrollbar-hide">
            
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${isAiPaused ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white'}`}>
                      <Bot size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-slate-800 uppercase tracking-tight">Sarah AI</h4>
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isAiPaused ? 'text-slate-400' : 'text-emerald-500'}`}>
                        {isAiPaused ? 'Automation Off' : 'Live Monitor'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${isAiPaused ? 'bg-slate-200' : 'bg-emerald-500 animate-pulse'}`}></div>
               </div>
               
               <button 
                  onClick={() => setIsAiPaused(!isAiPaused)}
                  className={`w-full py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm flex items-center justify-center gap-3 active:scale-95 ${
                    isAiPaused 
                      ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-700' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-red-600 hover:border-red-100'
                  }`}
                >
                  {isAiPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                  {isAiPaused ? 'Resume Automation' : 'Pause for Takeover'}
                </button>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-50">
                  <UserCircle size={18} className="text-blue-600" />
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Client Brief</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1">Status Stage</span>
                    <p className="text-xs font-black text-slate-800">{selectedContact.pipelineStage}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1">Category</span>
                    <span className="inline-block text-[9px] font-black text-blue-600 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded uppercase tracking-widest">{selectedContact.type}</span>
                  </div>
                </div>
            </div>
          </div>
        ) : selectedConv?.isInternal ? (
          <div className="p-8 space-y-8 h-full scrollbar-hide">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Participants</h4>
                <div className="space-y-3">
                  {selectedConv.teamMemberIds?.map(id => {
                    const member = MOCK_TEAM.find(m => m.id === id);
                    const memberName = getMemberDisplayName(id);
                    return (
                      <div key={id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-all">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${id === 'tm1' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}>
                          {memberName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{memberName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{member?.role}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="w-full mt-6 py-3 border border-dashed border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Participant
                </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const getSourceColor = (source: ConversationSource | 'system') => {
  switch (source) {
    case ConversationSource.VOICE: return 'bg-blue-50 text-blue-600';
    case ConversationSource.SMS: return 'bg-emerald-50 text-emerald-600';
    case ConversationSource.EMAIL: return 'bg-amber-50 text-amber-600';
    case 'system': return 'bg-slate-50 text-slate-500';
    default: return 'bg-slate-50 text-slate-600';
  }
};

export default Inbox;
