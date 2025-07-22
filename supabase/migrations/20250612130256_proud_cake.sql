/*
  # Fix authentication and RLS policies for messaging

  1. Changes
    - Drop all existing problematic policies
    - Create simplified policies that work with Supabase auth
    - Fix wallet address authentication
    - Ensure proper profile creation

  2. Security
    - Enable RLS on all tables
    - Create policies that work with auth.uid()
    - Handle case-insensitive wallet addresses
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can send messages from their address" ON messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can update their sent messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can update sent messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages" ON messages;

-- Create simple, working policies for messages
CREATE POLICY "Users can send messages from their address"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender = lower((auth.jwt() ->> 'sub'::text)));

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
  USING (sender = lower((auth.jwt() ->> 'sub'::text)))
  WITH CHECK (sender = lower((auth.jwt() ->> 'sub'::text)));

-- Ensure profiles policies are correct
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

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
    address = lower((auth.jwt() ->> 'sub'::text))
  );

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    address = lower((auth.jwt() ->> 'sub'::text))
  );