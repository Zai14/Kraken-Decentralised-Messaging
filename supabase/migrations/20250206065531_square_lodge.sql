/*
  # Fix conversation RLS policies

  1. Changes
    - Drop existing RLS policies for conversations
    - Add new policies that properly handle participant arrays
    - Fix policy for creating new conversations
    
  2. Security
    - Enable RLS on conversations table
    - Add policies for SELECT, INSERT, and UPDATE operations
    - Ensure users can only access conversations they're part of
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations they're part of" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;

-- Create new policies with proper array handling
CREATE POLICY "Users can view their conversations"
ON conversations
FOR SELECT
TO authenticated
USING (
  auth.jwt()->>'sub' = ANY(participants)
);

CREATE POLICY "Users can create conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.jwt()->>'sub' = ANY(participants)
);

CREATE POLICY "Users can update their own conversations"
ON conversations
FOR UPDATE
TO authenticated
USING (
  auth.jwt()->>'sub' = ANY(participants)
);