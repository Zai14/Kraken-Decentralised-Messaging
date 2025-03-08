import create from 'zustand';
import { supabase } from './supabase';

interface Message {
  id: string;
  content: string;
  sender: string;
  receiver: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  retries?: number;
  error?: string;
}

interface MessageState {
  messages: Message[];
  sendingQueue: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  setMessageStatus: (messageId: string, status: Message['status'], error?: string) => void;
  loadMessages: (userId: string) => Promise<void>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  sendingQueue: [],
  
  addMessage: async (message) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      ...message,
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    set(state => ({
      messages: [...state.messages, newMessage],
      sendingQueue: [...state.sendingQueue, newMessage],
    }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('messages')
        .insert({
          id: newMessage.id,
          content: newMessage.content,
          sender: user.id,
          receiver: message.receiver.toLowerCase(),
        });

      if (error) throw error;

      set(state => ({
        sendingQueue: state.sendingQueue.filter(m => m.id !== newMessage.id),
        messages: state.messages.map(m =>
          m.id === newMessage.id ? { ...m, status: 'sent' } : m
        ),
      }));
    } catch (error: any) {
      console.error('Error sending message:', error);
      set(state => ({
        messages: state.messages.map(m =>
          m.id === newMessage.id
            ? { ...m, status: 'failed', error: error.message }
            : m
        ),
      }));
    }
  },

  retryMessage: async (messageId) => {
    const state = get();
    const message = state.messages.find(m => m.id === messageId);
    if (!message || message.status !== 'failed') return;

    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, status: 'sending', error: undefined } : m
      ),
    }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('messages')
        .insert({
          id: message.id,
          content: message.content,
          sender: user.id,
          receiver: message.receiver.toLowerCase(),
        });

      if (error) throw error;

      set(state => ({
        messages: state.messages.map(m =>
          m.id === messageId ? { ...m, status: 'sent' } : m
        ),
      }));
    } catch (error: any) {
      set(state => ({
        messages: state.messages.map(m =>
          m.id === messageId
            ? { ...m, status: 'failed', error: error.message }
            : m
        ),
      }));
    }
  },

  setMessageStatus: (messageId, status, error) => {
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, status, error } : m
      ),
    }));
  },

  loadMessages: async (userId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender.eq.${user.id},receiver.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = data.map((msg) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        receiver: msg.receiver,
        timestamp: msg.created_at,
        status: 'sent',
      }));

      set({ messages: formattedMessages });
    } catch (error) {
      console.error('Error loading messages:', error);
      throw error;
    }
  },
}));