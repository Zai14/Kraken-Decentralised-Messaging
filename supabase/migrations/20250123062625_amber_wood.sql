/*
  # Add user profiles and update data types

  1. Changes
    - Drop all existing policies to allow column type changes
    - Create profiles table
    - Update column types for wallet addresses
    - Recreate all policies with updated types
    - Add initial profile data

  2. Security
    - Enable RLS on profiles table
    - Recreate all policies with proper types
*/

-- Drop ALL existing policies to allow column modifications
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations they're part of" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON attachments;
DROP POLICY IF EXISTS "Users can upload attachments to their conversations" ON attachments;

-- Create profiles table
CREATE TABLE profiles (
  address text PRIMARY KEY,
  username text,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Update column types
ALTER TABLE messages 
ALTER COLUMN sender TYPE text;

ALTER TABLE conversations 
ALTER COLUMN participants TYPE text[] USING participants::text[];

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

-- Policies for profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (address = auth.jwt()->>'sub');

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (address = auth.jwt()->>'sub');

-- Insert initial profile for Zaid Shabir
INSERT INTO profiles (address, username, bio, avatar_url)
VALUES (
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  'Zaid Shabir',
  'Creator of DMessage | Web3 Developer',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop'
);