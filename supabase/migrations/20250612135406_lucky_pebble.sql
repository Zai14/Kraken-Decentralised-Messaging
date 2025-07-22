/*
  # Fix Messages RLS Policy for Wallet Authentication

  1. Changes
    - Drop existing message policies that use jwt() ->> 'sub'
    - Create new policies that use auth.email() to extract wallet address
    - Ensure consistency with other table policies

  2. Security
    - Maintain proper access control for messages
    - Use wallet address from email for authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_update_policy" ON messages;

-- Create new policies using wallet address from email
CREATE POLICY "messages_insert_policy"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (split_part(auth.email(), '@'::text, 1) = sender);

CREATE POLICY "messages_select_policy"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    (split_part(auth.email(), '@'::text, 1) = sender) OR 
    (split_part(auth.email(), '@'::text, 1) = receiver)
  );

CREATE POLICY "messages_update_policy"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (split_part(auth.email(), '@'::text, 1) = sender)
  WITH CHECK (split_part(auth.email(), '@'::text, 1) = sender);