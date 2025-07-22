/*
  # Fix RLS policies for profiles table

  1. Security Changes
    - Drop existing RLS policies that use incorrect email extraction
    - Create new RLS policies that properly use JWT 'sub' field for wallet address matching
    - Ensure authenticated users can only manage their own profiles

  2. Policy Details
    - INSERT: Allow users to create profiles where address matches their JWT sub
    - SELECT: Allow users to read all profiles (for messaging/search functionality)  
    - UPDATE: Allow users to update only their own profiles
*/

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

-- Create new policies with correct JWT handling
CREATE POLICY "profiles_insert_policy"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = address);

CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_policy"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'sub' = address)
  WITH CHECK (auth.jwt() ->> 'sub' = address);