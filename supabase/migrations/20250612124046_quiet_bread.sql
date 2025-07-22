/*
  # Fix Messages Table RLS Policies

  1. Security Updates
    - Drop existing restrictive policies that use uid() incorrectly
    - Create new policies that work with wallet address authentication
    - Allow authenticated users to insert messages where they are the sender
    - Allow authenticated users to update messages they sent
    - Allow authenticated users to view messages where they are sender or receiver

  2. Policy Details
    - INSERT policy: Users can send messages if their profile address matches the sender
    - UPDATE policy: Users can update messages they sent
    - SELECT policy: Users can view messages they sent or received
*/

-- Drop existing policies that may be causing issues
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated users to send messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated users to update their sent messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated users to view their messages" ON messages;

-- Create new INSERT policy for sending messages
CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.address = messages.sender 
      AND auth.uid()::text = profiles.address
    )
  );

-- Create new UPDATE policy for updating sent messages
CREATE POLICY "Users can update sent messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.address = messages.sender 
      AND auth.uid()::text = profiles.address
    )
  );

-- Create new SELECT policy for viewing messages
CREATE POLICY "Users can view their messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE auth.uid()::text = profiles.address 
      AND (profiles.address = messages.sender OR profiles.address = messages.receiver)
    )
  );