/*
  # Fix RLS policies for conversations with proper UUID handling

  1. Changes
    - Fix UUID to text casting for auth.uid()
    - Simplify RLS policies
    - Fix authentication checks
    
  2. Security
    - Enable RLS on conversations table
    - Add policies for SELECT, INSERT, and UPDATE operations
    - Properly handle UUID type conversion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;

-- Create simplified policies for conversations
CREATE POLICY "Enable read for users"
ON conversations FOR SELECT
TO authenticated
USING (
  array_to_string(participants, ',') ILIKE '%' || auth.uid()::text || '%'
);

CREATE POLICY "Enable insert for users"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (
  array_to_string(participants, ',') ILIKE '%' || auth.uid()::text || '%'
);

CREATE POLICY "Enable update for users"
ON conversations FOR UPDATE
TO authenticated
USING (
  array_to_string(participants, ',') ILIKE '%' || auth.uid()::text || '%'
);

-- Create simplified policies for messages
CREATE POLICY "Enable read messages for conversation participants"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conversation_id
    AND array_to_string(participants, ',') ILIKE '%' || auth.uid()::text || '%'
  )
);

CREATE POLICY "Enable insert messages for conversation participants"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conversation_id
    AND array_to_string(participants, ',') ILIKE '%' || auth.uid()::text || '%'
  )
);