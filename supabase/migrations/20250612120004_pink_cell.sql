/*
  # Fix authentication and RLS policies

  1. Changes
    - Update RLS policies to work with Supabase auth properly
    - Fix conversation and message access control
    - Ensure proper UUID handling for auth.uid()

  2. Security
    - Maintain proper access control for all tables
    - Fix authentication checks for wallet-based users
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON attachments;
DROP POLICY IF EXISTS "Users can upload attachments to their conversations" ON attachments;

-- Create new policies for conversations that work with auth.uid()
CREATE POLICY "Users can view their conversations"
ON conversations FOR SELECT
TO authenticated
USING (
  (auth.uid())::text = ANY(participants)
);

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid())::text = ANY(participants)
);

CREATE POLICY "Users can update their conversations"
ON conversations FOR UPDATE
TO authenticated
USING (
  (auth.uid())::text = ANY(participants)
);

-- Create new policies for messages
CREATE POLICY "Users can view messages"
ON messages FOR SELECT
TO authenticated
USING (
  (auth.uid())::text = sender OR
  (auth.uid())::text = receiver
);

CREATE POLICY "Users can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid())::text = sender
);

-- Create new policies for attachments
CREATE POLICY "Users can view attachments in their conversations"
ON attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = attachments.message_id
    AND (auth.jwt()->>'sub') = ANY(c.participants)
  )
);

CREATE POLICY "Users can upload attachments to their conversations"
ON attachments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = attachments.message_id
    AND (auth.jwt()->>'sub') = ANY(c.participants)
  )
);

-- Update the conversation trigger function to work with auth
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
  conv_id uuid;
BEGIN
  -- Try to find existing conversation between sender and receiver
  SELECT id INTO conv_id
  FROM conversations 
  WHERE 
    participants @> ARRAY[NEW.sender, NEW.receiver]::text[] AND
    participants <@ ARRAY[NEW.sender, NEW.receiver]::text[];
    
  -- If no conversation exists, create one
  IF conv_id IS NULL THEN
    INSERT INTO conversations (
      participants,
      last_message,
      last_message_time,
      is_group
    ) VALUES (
      ARRAY[NEW.sender, NEW.receiver]::text[],
      NEW.content,
      NEW.created_at,
      false
    )
    RETURNING id INTO conv_id;
  ELSE
    -- Update existing conversation
    UPDATE conversations
    SET 
      last_message = NEW.content,
      last_message_time = NEW.created_at,
      updated_at = now()
    WHERE id = conv_id;
  END IF;

  -- Set the conversation_id for the message
  NEW.conversation_id = conv_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;