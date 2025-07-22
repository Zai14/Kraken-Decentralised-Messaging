/*
  # Fix Messages Table RLS Policies

  1. Changes
    - Drop all existing problematic policies
    - Create new policies that properly work with wallet address authentication
    - Fix INSERT, UPDATE, and SELECT policies for messages table

  2. Security
    - Ensure only authenticated users can send messages from their own address
    - Allow users to view messages where they are sender or receiver
    - Allow users to update their own sent messages
*/

-- Drop existing policies that may be causing issues
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated users to send messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated users to update their sent messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated users to view their messages" ON messages;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can update sent messages" ON messages;

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