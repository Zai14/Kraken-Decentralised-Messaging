/*
  # Update profiles and policies

  1. Changes
    - Safely updates existing profiles table
    - Recreates all policies with proper authentication checks
    - Updates column types for messages and conversations
    - Ensures proper RLS for all tables
  
  2. Security
    - Enables RLS on all tables
    - Updates policies for proper authentication checks
    - Ensures case-insensitive wallet address handling
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations they're part of" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON attachments;
DROP POLICY IF EXISTS "Users can upload attachments to their conversations" ON attachments;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Safely modify profiles table if needed
DO $$ 
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE profiles ADD COLUMN bio text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE profiles ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update column types
ALTER TABLE messages 
ALTER COLUMN sender TYPE text;

ALTER TABLE conversations 
ALTER COLUMN participants TYPE text[] USING participants::text[];

-- Enable RLS on all tables (idempotent)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Recreate policies for conversations
CREATE POLICY "Users can view their conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (auth.jwt()->>'sub' = ANY(participants));

CREATE POLICY "Users can create conversations they're part of"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt()->>'sub' = ANY(participants));

CREATE POLICY "Users can update their conversations"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'sub' = ANY(participants));

-- Recreate policies for messages
CREATE POLICY "Users can view messages in their conversations"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND auth.jwt()->>'sub' = ANY(participants)
    )
  );

CREATE POLICY "Users can send messages to their conversations"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND auth.jwt()->>'sub' = ANY(participants)
    )
  );

-- Recreate policies for attachments
CREATE POLICY "Users can view attachments in their conversations"
  ON attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = attachments.message_id
      AND auth.jwt()->>'sub' = ANY(c.participants)
    )
  );

CREATE POLICY "Users can upload attachments to their conversations"
  ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id
      AND auth.jwt()->>'sub' = ANY(c.participants)
    )
  );

-- New profile policies with proper authentication checks
CREATE POLICY "Anyone can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    address = lower(auth.jwt()->>'sub')
  );

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    address = lower(auth.jwt()->>'sub')
  );

-- Safely insert initial profile if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE address = '0x742d35cc6634c0532925a3b844bc454e4438f44e'
  ) THEN
    INSERT INTO profiles (address, username, bio, avatar_url)
    VALUES (
      '0x742d35cc6634c0532925a3b844bc454e4438f44e',
      'Zaid Shabir',
      'Creator of DMessage | Web3 Developer',
      'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop'
    );
  END IF;
END $$;