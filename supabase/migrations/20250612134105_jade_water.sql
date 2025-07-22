/*
  # Fix messaging system RLS policies

  1. Changes
    - Drop ALL existing policies to avoid conflicts
    - Create consistent policies using email-based authentication
    - Ensure all tables use the same auth method
    - Fix conversation participant handling

  2. Security
    - Enable RLS on all tables
    - Use split_part(auth.email(), '@'::text, 1) for consistent auth
    - Proper participant array handling for conversations
*/

-- Drop ALL existing policies to avoid conflicts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on messages table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON messages';
    END LOOP;
    
    -- Drop all policies on profiles table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
    
    -- Drop all policies on conversations table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversations' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON conversations';
    END LOOP;
    
    -- Drop all policies on attachments table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'attachments' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON attachments';
    END LOOP;
END $$;

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Create consistent policies for profiles using email-based auth
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_policy"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (address = split_part(auth.email(), '@'::text, 1));

CREATE POLICY "profiles_update_policy"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (address = split_part(auth.email(), '@'::text, 1));

-- Create consistent policies for messages using email-based auth
CREATE POLICY "messages_insert_policy"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender = split_part(auth.email(), '@'::text, 1));

CREATE POLICY "messages_select_policy"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    sender = split_part(auth.email(), '@'::text, 1) OR 
    receiver = split_part(auth.email(), '@'::text, 1)
  );

CREATE POLICY "messages_update_policy"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (sender = split_part(auth.email(), '@'::text, 1))
  WITH CHECK (sender = split_part(auth.email(), '@'::text, 1));

-- Create consistent policies for conversations using email-based auth
CREATE POLICY "conversations_select_policy"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (split_part(auth.email(), '@'::text, 1) = ANY(participants));

CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (split_part(auth.email(), '@'::text, 1) = ANY(participants));

CREATE POLICY "conversations_update_policy"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (split_part(auth.email(), '@'::text, 1) = ANY(participants));

-- Create policies for attachments
CREATE POLICY "attachments_select_policy"
  ON attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = attachments.message_id
      AND split_part(auth.email(), '@'::text, 1) = ANY(c.participants)
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
      AND split_part(auth.email(), '@'::text, 1) = ANY(c.participants)
    )
  );