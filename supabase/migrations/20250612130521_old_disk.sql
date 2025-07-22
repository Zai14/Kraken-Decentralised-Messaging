/*
  # Fix RLS policies for email-based authentication

  1. Security Updates
    - Update profiles INSERT policy to work with email-based auth
    - Update messages INSERT policy to work with email-based auth
    - Ensure policies extract wallet address from email format

  The authentication system uses emails in format: {wallet_address}@kraken.web3
  So we need to extract the wallet address from the email using split_part function.
*/

-- Drop existing policies that use jwt() ->> 'sub'
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can send messages from their address" ON messages;
DROP POLICY IF EXISTS "Users can update their sent messages" ON messages;

-- Create new policies that work with email-based authentication
CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (address = split_part(auth.email(), '@', 1));

CREATE POLICY "Users can send messages from their address"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender = split_part(auth.email(), '@', 1));

CREATE POLICY "Users can update their sent messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (sender = split_part(auth.email(), '@', 1))
  WITH CHECK (sender = split_part(auth.email(), '@', 1));