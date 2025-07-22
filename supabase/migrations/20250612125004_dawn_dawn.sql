/*
  # Fix RLS policies for messages table

  1. Changes
    - Drop existing restrictive policies that cause RLS violations
    - Create new policies that properly authenticate users based on wallet addresses
    - Use auth.jwt() instead of jwt() function
    - Ensure consistency with profiles table authentication pattern

  2. Security
    - Users can only send messages from their own wallet address
    - Users can only view messages they sent or received
    - Users can only update messages they sent
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can update sent messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages" ON messages;

-- Create new policies that work with wallet address authentication
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