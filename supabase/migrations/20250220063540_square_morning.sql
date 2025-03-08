/*
  # Fix RLS policies for conversations and messages

  1. Changes
    - Update RLS policies to properly handle message creation and conversation access
    - Ensure conversation creation works with message insertion
    - Fix participant array handling in policies

  2. Security
    - Maintain proper access control for conversations and messages
    - Ensure users can only access their own conversations and messages
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read for users" ON conversations;
DROP POLICY IF EXISTS "Enable insert for users" ON conversations;
DROP POLICY IF EXISTS "Enable update for users" ON conversations;
DROP POLICY IF EXISTS "Enable read messages for conversation participants" ON messages;
DROP POLICY IF EXISTS "Enable insert messages for conversation participants" ON messages;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- Create new policies for conversations
CREATE POLICY "Users can view their conversations"
ON conversations FOR SELECT
TO authenticated
USING (
  auth.uid()::text = ANY(participants)
);

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = ANY(participants)
);

CREATE POLICY "Users can update their conversations"
ON conversations FOR UPDATE
TO authenticated
USING (
  auth.uid()::text = ANY(participants)
);

-- Create new policies for messages
CREATE POLICY "Users can view messages"
ON messages FOR SELECT
TO authenticated
USING (
  auth.uid()::text = sender OR
  auth.uid()::text = receiver
);

CREATE POLICY "Users can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = sender
);

-- Update the conversation update function to handle auth properly
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
  conv_id uuid;
BEGIN
  -- Try to find existing conversation
  SELECT id INTO conv_id
  FROM conversations 
  WHERE 
    participants @> ARRAY[NEW.sender, NEW.receiver]::text[] AND
    participants <@ ARRAY[NEW.sender, NEW.receiver]::text[] AND
    auth.uid()::text = ANY(participants);
    
  -- If no conversation exists, create one
  IF conv_id IS NULL THEN
    INSERT INTO conversations (
      participants,
      last_message,
      last_message_time
    ) VALUES (
      ARRAY[NEW.sender, NEW.receiver]::text[],
      NEW.content,
      NEW.created_at
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