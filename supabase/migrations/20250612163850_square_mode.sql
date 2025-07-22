/*
  # Fix Authentication System

  1. Changes
    - Clean up existing policies and create new ones
    - Ensure proper RLS for wallet-based authentication
    - Create storage bucket for avatars
    - Add proper indexes for performance

  2. Security
    - Enable RLS on all tables
    - Create policies that work with Supabase auth
    - Ensure users can only access their own data
*/

-- Drop all existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'conversations', 'messages', 'attachments')
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Ensure all tables exist with proper structure
CREATE TABLE IF NOT EXISTS profiles (
  address text PRIMARY KEY,
  username text,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participants text[] NOT NULL,
  last_message text,
  last_message_time timestamptz DEFAULT now(),
  is_group boolean DEFAULT false,
  group_name text,
  group_avatar text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender text NOT NULL,
  receiver text NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false,
  status text DEFAULT 'sent',
  error text,
  retries integer DEFAULT 0,
  encrypted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender, receiver);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Helper function to extract wallet address from auth user
CREATE OR REPLACE FUNCTION get_user_wallet_address()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'wallet_address',
    split_part(auth.email(), '@', 1)
  );
$$;

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

-- Create storage bucket for attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments bucket
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
BEGIN
  -- Find or create conversation
  IF NEW.conversation_id IS NULL THEN
    -- Try to find existing conversation between sender and receiver
    SELECT id INTO NEW.conversation_id
    FROM conversations
    WHERE participants @> ARRAY[NEW.sender] 
      AND participants @> ARRAY[NEW.receiver]
      AND array_length(participants, 1) = 2
    LIMIT 1;
    
    -- If no conversation exists, create one
    IF NEW.conversation_id IS NULL THEN
      INSERT INTO conversations (participants, last_message, last_message_time)
      VALUES (ARRAY[NEW.sender, NEW.receiver], NEW.content, NEW.created_at)
      RETURNING id INTO NEW.conversation_id;
    END IF;
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
DROP TRIGGER IF EXISTS messages_conversation_trigger ON messages;
CREATE TRIGGER messages_conversation_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON messages;
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();