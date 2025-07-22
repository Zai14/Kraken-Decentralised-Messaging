/*
  # Fix Messages RLS Policy

  1. Security Updates
    - Update INSERT policy for messages table to work with email-based authentication
    - Ensure sender matches the wallet address extracted from authenticated user's email
    - Fix policy to use auth.email() instead of auth.uid()

  2. Changes
    - Drop existing INSERT policy that uses auth.uid()
    - Create new INSERT policy that extracts wallet address from email
    - Update other policies to be consistent with email-based authentication
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can send messages from their address" ON messages;
DROP POLICY IF EXISTS "Users can update their sent messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;

-- Create new INSERT policy that works with email-based authentication
CREATE POLICY "Users can send messages from their address"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender = split_part(auth.email(), '@', 1));

-- Create new UPDATE policy
CREATE POLICY "Users can update their sent messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (sender = split_part(auth.email(), '@', 1))
  WITH CHECK (sender = split_part(auth.email(), '@', 1));

-- Create new SELECT policy
CREATE POLICY "Users can view messages they sent or received"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    sender = split_part(auth.email(), '@', 1) OR 
    receiver = split_part(auth.email(), '@', 1)
  );