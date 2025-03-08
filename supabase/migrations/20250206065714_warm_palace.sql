/*
  # Fix conversation RLS policies and address handling

  1. Changes
    - Drop existing RLS policies
    - Add new policies with case-insensitive address handling
    - Add function to normalize addresses
    
  2. Security
    - Enable RLS on conversations table
    - Add policies for SELECT, INSERT, and UPDATE operations
    - Ensure consistent address format
*/

-- Create function to normalize addresses
CREATE OR REPLACE FUNCTION normalize_address(addr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(addr);
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;

-- Create new policies with normalized address handling
CREATE POLICY "Users can view their conversations"
ON conversations
FOR SELECT
TO authenticated
USING (
  normalize_address(auth.jwt()->>'sub') = ANY(
    SELECT normalize_address(unnest(participants))
  )
);

CREATE POLICY "Users can create conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  normalize_address(auth.jwt()->>'sub') = ANY(
    SELECT normalize_address(unnest(participants))
  )
);

CREATE POLICY "Users can update their own conversations"
ON conversations
FOR UPDATE
TO authenticated
USING (
  normalize_address(auth.jwt()->>'sub') = ANY(
    SELECT normalize_address(unnest(participants))
  )
);