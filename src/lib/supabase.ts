import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Message = {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
  attachments?: {
    url: string;
    type: string;
    name: string;
  }[];
};

export type Profile = {
  id: string;
  username: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'away';
  last_seen?: string;
};

export const uploadFile = async (file: File, path: string) => {
  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(path, file);

  if (error) throw error;
  return data;
};

export const getFileUrl = (path: string) => {
  return supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;
};