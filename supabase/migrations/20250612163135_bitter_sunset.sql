/*
  # Create messaging schema for Kraken app

  1. New Tables
    - `profiles`
      - `address` (text, primary key) - wallet address
      - `username` (text, nullable) - display name
      - `bio` (text, nullable) - user bio
      - `avatar_url` (text, nullable) - profile picture URL
      - `created_at` (timestamp) - creation time
      - `updated_at` (timestamp) - last update time
    
    - `conversations`
      - `id` (uuid, primary key)
      - `participants` (text array) - wallet addresses of participants
      - `last_message` (text, nullable) - preview of last message
      - `last_message_time` (timestamp) - time of last message
      - `is_group` (boolean) - whether it's a group chat
      - `group_name` (text, nullable) - name for group chats
      - `group_avatar` (text, nullable) - avatar for group chats
      - `created_at` (timestamp) - creation time
      - `updated_at` (timestamp) - last update time
    
    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid) - reference to conversation
      - `sender` (text) - wallet address of sender
      - `receiver` (text) - wallet address of receiver
      - `content` (text) - message content
      - `read` (boolean) - read status
      - `status` (text) - message status (sent, delivered, failed)
      - `error` (text, nullable) - error message if failed
      - `retries` (integer) - retry count
      - `encrypted` (boolean) - encryption status
      - `created_at` (timestamp) - creation time
    
    - `attachments`
      - `id` (uuid, primary key)
      - `message_id` (uuid) - reference to message
      - `file_path` (text) - path to file
      - `file_name` (text) - original filename
      - `file_size` (bigint) - file size in bytes
      - `file_type` (text) - MIME type
      - `created_at` (timestamp) - creation time

  2. Security
    - All tables have RLS enabled
    - Public access policies for all operations (temporary solution)
    - Indexes for performance optimization

  3. Functions
    - Trigger functions for conversation management
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  address text PRIMARY KEY,
  username text,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversations table
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

-- Create messages table
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

-- Create attachments table
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

-- Create permissive policies for all tables (temporary solution)
-- In production, these should be more restrictive

-- Profiles policies
CREATE POLICY "profiles_public_access" ON profiles FOR ALL TO public USING (true) WITH CHECK (true);

-- Conversations policies  
CREATE POLICY "conversations_public_access" ON conversations FOR ALL TO public USING (true) WITH CHECK (true);

-- Messages policies
CREATE POLICY "messages_public_access" ON messages FOR ALL TO public USING (true) WITH CHECK (true);

-- Attachments policies
CREATE POLICY "attachments_public_access" ON attachments FOR ALL TO public USING (true) WITH CHECK (true);

-- Create trigger function to update conversation on new message
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
$$ LANGUAGE plpgsql;

-- Create trigger function to update last message in conversation
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
$$ LANGUAGE plpgsql;

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