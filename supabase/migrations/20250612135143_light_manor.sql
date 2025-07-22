/*
  # Fix Messages Table RLS Policies

  1. Security Updates
    - Update INSERT policy to use JWT sub field for wallet address comparison
    - Update SELECT policy to use JWT sub field for wallet address comparison  
    - Update UPDATE policy to use JWT sub field for wallet address comparison
    - Ensures authenticated users can properly insert, select, and update their messages

  2. Changes Made
    - Replace `split_part(email(), '@', 1)` with `(auth.jwt() ->> 'sub')::text`
    - This correctly extracts the wallet address from the JWT token's sub field
*/

-- Drop existing policies
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_update_policy" ON messages;

-- Create updated INSERT policy
CREATE POLICY "messages_insert_policy"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'sub')::text = sender);

-- Create updated SELECT policy
CREATE POLICY "messages_select_policy"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'sub')::text = sender OR 
    (auth.jwt() ->> 'sub')::text = receiver
  );

-- Create updated UPDATE policy
CREATE POLICY "messages_update_policy"
  ON messages
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'sub')::text = sender)
  WITH CHECK ((auth.jwt() ->> 'sub')::text = sender);