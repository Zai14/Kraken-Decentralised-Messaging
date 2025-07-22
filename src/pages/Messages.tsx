import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, ArrowLeft, AlertCircle, Plus, Users, Clock, CheckCircle, MessageCircle, Zap, Shield, ShieldOff, Lock, Unlock } from 'lucide-react';
import { shortenAddress } from '../lib/web3';
import { useContext } from 'react';
import { AuthContext } from '../App';
import { messagingService, type Message } from '../lib/messagingService';

interface Conversation {
  id: string;
  participants: string[];
  last_message: string;
  last_message_time: string;
  is_group: boolean;
  group_name?: string;
}

export function Messages() {
  const [newMessage, setNewMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [showRecipient, setShowRecipient] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState({ gun: false });
  const [recipientStatus, setRecipientStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [disappearAfterMinutes, setDisappearAfterMinutes] = useState<number | undefined>(undefined);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { walletAddress } = useContext(AuthContext);

  useEffect(() => {
    if (walletAddress) {
      initializeMessaging();
    }
    
    return () => {
      messagingService.destroy();
    };
  }, [walletAddress]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Check recipient status when recipient changes
    if (recipient) {
      checkRecipientStatus();
    }
  }, [recipient, onlineUsers]);

  const checkRecipientStatus = () => {
    if (!recipient) {
      setRecipientStatus('unknown');
      return;
    }

    const isRecipientOnline = onlineUsers.includes(recipient.toLowerCase());
    setRecipientStatus(isRecipientOnline ? 'online' : 'offline');
  };

  const initializeMessaging = async () => {
    if (!walletAddress) return;

    try {
      setInitializing(true);
      console.log('Initializing messaging for wallet:', walletAddress);
      
      // Initialize messaging service
      await messagingService.initialize(walletAddress);
      
      // Get connection status
      const status = messagingService.getConnectionStatus();
      setConnectionStatus(status);
      console.log('Connection status:', status);
      
      // Load existing messages from local storage
      const existingMessages = await messagingService.loadMessagesFromLocal();
      setMessages(existingMessages);
      console.log('Loaded existing messages:', existingMessages.length);
      
      // Generate conversations from messages
      generateConversationsFromMessages(existingMessages);
      
      // Set up real-time message listener
      messagingService.onMessage((message) => {
        console.log('New message received via', message.transport, ':', message);
        setMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          const newMessages = [...prev, message].sort((a, b) => a.timestamp - b.timestamp);
          generateConversationsFromMessages(newMessages);
          return newMessages;
        });
      });
      
      // Set up presence listener
      messagingService.onPresence((users) => {
        setOnlineUsers(users);
        console.log('Online users updated:', users);
      });
      
      console.log('Messaging initialized successfully');
      
    } catch (error) {
      console.error('Error initializing messaging:', error);
    } finally {
      setInitializing(false);
    }
  };

  const generateConversationsFromMessages = (messageList: Message[]) => {
    if (!walletAddress) return;

    const conversationMap = new Map<string, Conversation>();

    messageList.forEach(message => {
      const participants = [message.sender, message.receiver].sort();
      const conversationId = participants.join('-');

      if (!conversationMap.has(conversationId)) {
        conversationMap.set(conversationId, {
          id: conversationId,
          participants,
          last_message: message.content,
          last_message_time: new Date(message.timestamp).toISOString(),
          is_group: false
        });
      } else {
        const conversation = conversationMap.get(conversationId)!;
        if (message.timestamp > new Date(conversation.last_message_time).getTime()) {
          conversation.last_message = message.content;
          conversation.last_message_time = new Date(message.timestamp).toISOString();
        }
      }
    });

    const conversationList = Array.from(conversationMap.values())
      .filter(conv => conv.participants.includes(walletAddress.toLowerCase()))
      .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

    setConversations(conversationList);
    console.log('Generated conversations:', conversationList.length);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !walletAddress) return;

    const targetRecipient = selectedConversation 
      ? selectedConversation.participants.find(p => p !== walletAddress.toLowerCase()) || recipient
      : recipient;

    if (!targetRecipient.trim()) return;

    setLoading(true);
    console.log('Sending message to:', targetRecipient, 'content:', newMessage.trim(), 'encrypted:', encryptionEnabled);
    
    try {
      // Add to local state immediately for better UX
      const localMessage: Message = {
        id: crypto.randomUUID(),
        sender: walletAddress.toLowerCase(),
        receiver: targetRecipient.toLowerCase(),
        content: newMessage.trim(),
        timestamp: Date.now(),
        status: 'sending',
        transport: 'gun',
        encrypted: encryptionEnabled
      };
      
      setMessages(prev => {
        const newMessages = [...prev, localMessage].sort((a, b) => a.timestamp - b.timestamp);
        generateConversationsFromMessages(newMessages);
        return newMessages;
      });
      
      // Send via messaging service
      await messagingService.sendMessage(newMessage.trim(), targetRecipient, encryptionEnabled);
      
      // Update message status to sent
      setMessages(prev => prev.map(msg => 
        msg.id === localMessage.id 
          ? { ...msg, status: 'sent' as const }
          : msg
      ));
      
      setNewMessage('');
      
      if (showRecipient) {
        setShowRecipient(false);
      }
      
      console.log('Message sent successfully');
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update message status to failed
      setMessages(prev => prev.map(msg => 
        msg.id === (prev[prev.length - 1]?.id) 
          ? { ...msg, status: 'failed' as const }
          : msg
      ));
      
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowRecipient(false);
    
    const otherParticipant = conversation.participants.find(p => p !== walletAddress?.toLowerCase());
    if (otherParticipant) {
      setRecipient(otherParticipant);
    }
  };

  const handleNewMessage = () => {
    setSelectedConversation(null);
    setRecipient('');
    setShowRecipient(true);
    setRecipientStatus('unknown');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="w-3 h-3 animate-spin opacity-60" />;
      case 'sent':
        return <CheckCircle className="w-3 h-3 text-blue-400 opacity-60" />;
      case 'delivered':
        return <CheckCircle className="w-3 h-3 text-green-400 opacity-60" />;
      case 'pending_decryption':
        return <Loader2 className="w-3 h-3 animate-spin text-yellow-400 opacity-60" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400 opacity-60" />;
      default:
        return null;
    }
  };

  const getEncryptionIcon = (encrypted: boolean) => {
    return encrypted ? (
      <Shield className="w-3 h-3 text-green-400 opacity-60" title="Encrypted" />
    ) : (
      <ShieldOff className="w-3 h-3 text-yellow-400 opacity-60" title="Unencrypted" />
    );
  };

  const getRecipientStatusIndicator = () => {
    switch (recipientStatus) {
      case 'online':
        return (
          <div className="flex items-center space-x-1 text-xs text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center space-x-1 text-xs text-yellow-400">
            <Clock className="w-3 h-3" />
            <span>Offline - will deliver when online</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getConnectionStatusIcon = () => {
    if (connectionStatus.gun) {
      return <Zap className="w-4 h-4 text-green-500" title="Gun.js P2P" />;
    } else {
      return <Zap className="w-4 h-4 text-red-500" title="Disconnected" />;
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center space-y-4">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
          <p className="text-gray-400">Please connect your wallet to continue</p>
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
          <p className="text-gray-400">Initializing messaging system...</p>
          <p className="text-sm text-gray-500">Discovering Gun.js peers and setting up connections</p>
        </div>
      </div>
    );
  }

  const getConversationMessages = () => {
    if (!selectedConversation && !recipient) return [];
    
    if (selectedConversation) {
      return messages.filter(m => 
        selectedConversation.participants.includes(m.sender) && 
        selectedConversation.participants.includes(m.receiver)
      );
    }
    
    return messages.filter(m => 
      (m.sender.toLowerCase() === recipient.toLowerCase() && m.receiver.toLowerCase() === walletAddress.toLowerCase()) ||
      (m.sender.toLowerCase() === walletAddress.toLowerCase() && m.receiver.toLowerCase() === recipient.toLowerCase())
    );
  };

  const getConversationTitle = () => {
    if (selectedConversation) {
      if (selectedConversation.is_group) {
        return selectedConversation.group_name || 'Group Chat';
      }
      const otherParticipant = selectedConversation.participants.find(p => p !== walletAddress?.toLowerCase());
      return otherParticipant ? shortenAddress(otherParticipant) : 'Unknown';
    }
    return recipient ? shortenAddress(recipient) : 'New Message';
  };

  const getMessageDisplayContent = (message: Message): string => {
    // Check if message has expired
    if (message.isExpired || (message.expiresAt && Date.now() > message.expiresAt)) {
      return '⏰ This message has disappeared';
    }
    
    // Check if message is burn after reading and hasn't been read yet
    if (message.burnAfterReading && 
        message.sender !== walletAddress?.toLowerCase() && 
        !message.isRead) {
      return '🔥 Burn after reading - Tap to read';
    }
    
    // Check if message was burned after reading
    if (message.burnAfterReading && message.isRead && 
        message.sender !== walletAddress?.toLowerCase()) {
      return '🔥 This message has been burned';
    }
    
    return message.content;
  };

  const getTimeRemaining = (message: Message): string => {
    if (!message.expiresAt) return '';
    
    const remaining = message.expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const minutes = Math.floor(remaining / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleMessageClick = (message: Message) => {
    // Only handle click for burn after reading messages that haven't been read
    if (message.burnAfterReading && 
        message.sender !== walletAddress?.toLowerCase() && 
        !message.isRead) {
      
      // Mark message as read
      const updatedMessage = { ...message, isRead: true };
      
      // Update local messages
      setMessages(prev => prev.map(msg => 
        msg.id === message.id ? updatedMessage : msg
      ));
      
      // Schedule message burning after 1 second
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id ? { ...msg, isExpired: true } : msg
        ));
      }, 1000);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar - Conversations List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-white">Messages</h1>
            <button
              onClick={handleNewMessage}
              className="p-2 hover:bg-zinc-700 rounded-full transition-colors text-zinc-400 hover:text-white"
              title="New Message"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          {/* Online Users Count */}
          <div className="text-sm text-zinc-400">
            {onlineUsers.length} users online
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <MessageCircle className="w-12 h-12 text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">No conversations yet</h3>
              <p className="text-sm text-zinc-500">Start a new conversation by clicking the + button above</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => handleConversationSelect(conversation)}
                className={`w-full p-4 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 ${
                  selectedConversation?.id === conversation.id ? 'bg-zinc-800' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                    {conversation.is_group ? (
                      <Users className="w-5 h-5 text-zinc-300" />
                    ) : (
                      <span className="text-sm text-zinc-300">
                        {conversation.participants.find(p => p !== walletAddress?.toLowerCase())?.slice(2, 4).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-white truncate">
                        {conversation.is_group 
                          ? conversation.group_name || 'Group Chat'
                          : shortenAddress(conversation.participants.find(p => p !== walletAddress?.toLowerCase()) || '')
                        }
                      </h3>
                      {onlineUsers.includes(conversation.participants.find(p => p !== walletAddress?.toLowerCase()) || '') && (
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 truncate">
                      {conversation.last_message || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 p-4">
          {showRecipient ? (
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-white">New Message</h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setEncryptionEnabled(!encryptionEnabled)}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs transition-colors ${
                    encryptionEnabled 
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                      : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  }`}
                >
                  {encryptionEnabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{encryptionEnabled ? 'Encrypted' : 'Unencrypted'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleNewMessage}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h2 className="font-medium text-white">{getConversationTitle()}</h2>
                  {recipient && onlineUsers.includes(recipient) && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  {getRecipientStatusIndicator()}
                </div>
              </div>
              <button
                onClick={() => setEncryptionEnabled(!encryptionEnabled)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs transition-colors ${
                  encryptionEnabled 
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                    : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                }`}
              >
                {encryptionEnabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                <span>{encryptionEnabled ? 'Encrypted' : 'Unencrypted'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {getConversationMessages().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="w-16 h-16 text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">No messages yet</h3>
              <p className="text-sm text-zinc-500">
                Send your first {encryptionEnabled ? 'encrypted' : 'unencrypted'} message via Gun.js P2P network!
              </p>
            </div>
          ) : (
            getConversationMessages().map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender.toLowerCase() === walletAddress.toLowerCase() ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  onClick={() => handleMessageClick(message)}
                  className={`max-w-[70%] rounded-2xl p-4 ${
                    message.sender.toLowerCase() === walletAddress.toLowerCase()
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-white'
                  } ${
                    message.burnAfterReading && 
                    message.sender !== walletAddress?.toLowerCase() && 
                    !message.isRead && 
                    !message.isExpired 
                      ? 'cursor-pointer hover:opacity-80' 
                      : ''
                  } ${message.isExpired ? 'opacity-60 italic' : ''}`}
                >
                  <p className="text-sm break-words">{getMessageDisplayContent(message)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-xs opacity-60">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                      {message.disappearAfter && !message.isExpired && (
                        <span className="text-xs opacity-60 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {getTimeRemaining(message)}
                        </span>
                      )}
                      {message.burnAfterReading && (
                        <span className="text-xs opacity-60" title="Burn after reading">
                          🔥
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(message.status)}
                      {getEncryptionIcon(message.encrypted)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-zinc-800">
          {showRecipient && (
            <div className="mb-2">
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter Ethereum address (0x...)"
                className="w-full bg-zinc-900 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {recipient && getRecipientStatusIndicator()}
            </div>
          )}
          
          {/* Message Options Panel */}
          {showMessageOptions && (
            <div className="mb-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Message Options</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Disappear After</label>
                  <select
                    value={disappearAfterMinutes || ''}
                    onChange={(e) => setDisappearAfterMinutes(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full bg-zinc-700 text-zinc-100 rounded px-3 py-2 text-sm"
                  >
                    <option value="">Never</option>
                    <option value="1">1 minute</option>
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="1440">24 hours</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="burnAfterReading"
                    checked={burnAfterReading}
                    onChange={(e) => setBurnAfterReading(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="burnAfterReading" className="text-xs text-zinc-400">
                    🔥 Burn after reading (one-time view)
                  </label>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setShowMessageOptions(!showMessageOptions)}
              className={`p-3 rounded-xl transition-colors ${
                showMessageOptions || disappearAfterMinutes || burnAfterReading
                  ? 'bg-blue-500 text-white' 
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
              }`}
              title="Message Options"
            >
              <Clock className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                encryptionEnabled 
                  ? "Type an encrypted message..." 
                  : "Type an unencrypted message..."
              }
              className="flex-1 bg-zinc-900 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || (!recipient.trim() && !selectedConversation) || loading}
              className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-4 text-xs text-zinc-400">
              {(disappearAfterMinutes || burnAfterReading) && (
                <span className="text-blue-400">
                  {disappearAfterMinutes && `⏰ ${disappearAfterMinutes}min`}
                  {disappearAfterMinutes && burnAfterReading && ' • '}
                  {burnAfterReading && '🔥 Burn after reading'}
                </span>
              )}
              {!connectionStatus.gun && (
                <span className="text-red-400">No connections available</span>
              )}
              {recipientStatus === 'offline' && (
                <span className="text-yellow-400">Recipient offline - message will be delivered when they come online</span>
              )}
            </div>
            <div className="flex items-center space-x-2 text-xs text-zinc-500">
              {getConnectionStatusIcon()}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}