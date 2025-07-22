/*
  # Fresh Start - Complete Authentication System Reset

  1. Changes
    - Drop all existing tables and policies
    - Create clean database schema
    - Implement proper wallet-based authentication
    - Add helper functions for authentication
    - Create storage buckets with proper policies

  2. Security
    - Enable RLS on all tables
    - Create policies that work with wallet addresses
    - Proper storage bucket policies
*/

-- Drop all existing tables and their dependencies
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS signals CASCADE;

-- Drop all existing functions
DROP FUNCTION IF EXISTS get_user_wallet_address() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_on_message() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_last_message() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_signals() CASCADE;
DROP FUNCTION IF EXISTS normalize_address(text) CASCADE;

-- Create helper function to extract wallet address from auth
CREATE OR REPLACE FUNCTION get_user_wallet_address()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'user_metadata')::json ->> 'wallet_address',
    split_part(COALESCE(auth.email(), ''), '@', 1),
    auth.uid()::text
  );
$$;

-- Create profiles table
CREATE TABLE profiles (
  address text PRIMARY KEY,
  username text NOT NULL,
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversations table
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participants text[] NOT NULL,
  last_message text DEFAULT '',
  last_message_time timestamptz DEFAULT now(),
  is_group boolean DEFAULT false,
  group_name text DEFAULT '',
  group_avatar text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender text NOT NULL,
  receiver text NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false,
  status text DEFAULT 'sent',
  error text DEFAULT '',
  retries integer DEFAULT 0,
  encrypted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create attachments table
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_profiles_address ON profiles(address);
CREATE INDEX idx_conversations_participants ON conversations USING GIN(participants);
CREATE INDEX idx_messages_sender_receiver ON messages(sender, receiver);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_attachments_message_id ON attachments(message_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_policy"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (address = get_user_wallet_address());

CREATE POLICY "profiles_update_policy"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (address = get_user_wallet_address())
  WITH CHECK (address = get_user_wallet_address());

-- Conversations policies
CREATE POLICY "conversations_select_policy"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (get_user_wallet_address() = ANY(participants));

CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (get_user_wallet_address() = ANY(participants));

CREATE POLICY "conversations_update_policy"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (get_user_wallet_address() = ANY(participants))
  WITH CHECK (get_user_wallet_address() = ANY(participants));

-- Messages policies
CREATE POLICY "messages_select_policy"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    get_user_wallet_address() = sender OR 
    get_user_wallet_address() = receiver
  );

CREATE POLICY "messages_insert_policy"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (get_user_wallet_address() = sender);

CREATE POLICY "messages_update_policy"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (get_user_wallet_address() = sender)
  WITH CHECK (get_user_wallet_address() = sender);

-- Attachments policies
CREATE POLICY "attachments_select_policy"
  ON attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = attachments.message_id
      AND get_user_wallet_address() = ANY(c.participants)
    )
  );

CREATE POLICY "attachments_insert_policy"
  ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = attachments.message_id
      AND get_user_wallet_address() = ANY(c.participants)
    )
  );

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for attachments bucket
DROP POLICY IF EXISTS "attachments_bucket_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_bucket_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_bucket_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "attachments_bucket_delete_policy" ON storage.objects;

CREATE POLICY "attachments_bucket_select_policy"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "attachments_bucket_insert_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "attachments_bucket_update_policy"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "attachments_bucket_delete_policy"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');

-- Create trigger functions
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
  conv_id uuid;
BEGIN
  -- Find or create conversation
  IF NEW.conversation_id IS NULL THEN
    -- Try to find existing conversation between sender and receiver
    SELECT id INTO conv_id
    FROM conversations
    WHERE participants @> ARRAY[NEW.sender] 
      AND participants @> ARRAY[NEW.receiver]
      AND array_length(participants, 1) = 2
    LIMIT 1;
    
    -- If no conversation exists, create one
    IF conv_id IS NULL THEN
      INSERT INTO conversations (participants, last_message, last_message_time)
      VALUES (ARRAY[NEW.sender, NEW.receiver], NEW.content, NEW.created_at)
      RETURNING id INTO conv_id;
    END IF;
    
    NEW.conversation_id = conv_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message = NEW.content,
    last_message_time = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER messages_conversation_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Insert a test profile to verify the system works
INSERT INTO profiles (address, username, bio, avatar_url)
VALUES (
  '0x742d35cc6634c0532925a3b844bc454e4438f44e',
  'Zaid Shabir',
  'Creator of Kraken | Web3 Developer',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop'
) ON CONFLICT (address) DO UPDATE SET
  username = EXCLUDED.username,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = now();