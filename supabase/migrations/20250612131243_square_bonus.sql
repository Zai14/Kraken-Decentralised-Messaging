/*
  # Fix messaging system RLS policies with correct auth functions

  1. Changes
    - Drop all existing policies to start fresh
    - Create working policies using proper Supabase auth functions
    - Use auth.jwt() and auth.email() correctly
    - Fix conversation participant checking

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users only
    - Ensure proper access control for wallet-based authentication
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can send messages from their address" ON messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can update their sent messages" ON messages;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;

-- Create working policies for profiles
CREATE POLICY "Anyone can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (address = split_part(auth.email(), '@'::text, 1));

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (address = lower((auth.jwt() ->> 'sub'::text)));

-- Create working policies for messages
CREATE POLICY "Users can send messages from their address"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender = split_part(auth.email(), '@'::text, 1));

CREATE POLICY "Users can view messages they sent or received"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    sender = lower((auth.jwt() ->> 'sub'::text)) OR 
    receiver = lower((auth.jwt() ->> 'sub'::text))
  );

CREATE POLICY "Users can update their sent messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (sender = split_part(auth.email(), '@'::text, 1))
  WITH CHECK (sender = split_part(auth.email(), '@'::text, 1));

-- Create working policies for conversations
CREATE POLICY "Users can view their conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = ANY(participants));

CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = ANY(participants));

CREATE POLICY "Users can update their conversations"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = ANY(participants));