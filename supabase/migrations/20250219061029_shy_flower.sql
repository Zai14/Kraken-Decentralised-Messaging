/*
  # Fix messages table schema

  1. Changes
    - Add receiver column to messages table
    - Add status column to messages table
    - Add error column to messages table
    - Add retries column to messages table
    - Update existing rows with default values
    - Create trigger for conversation management

  2. Security
    - Update RLS policies for new schema
*/

-- First, add columns as nullable
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS receiver text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS error text,
ADD COLUMN IF NOT EXISTS retries integer DEFAULT 0;

-- Update existing rows with default values
UPDATE messages
SET receiver = sender
WHERE receiver IS NULL;

-- Now make receiver NOT NULL
ALTER TABLE messages
ALTER COLUMN receiver SET NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver 
ON messages(sender, receiver);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;

CREATE POLICY "Users can view their messages"
ON messages
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = sender OR 
  auth.uid()::text = receiver
);

CREATE POLICY "Users can send messages"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = sender
);

-- Add function to update conversation on message insert
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
    participants <@ ARRAY[NEW.sender, NEW.receiver]::text[];
    
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
$$ LANGUAGE plpgsql;

-- Create trigger for conversation updates
DROP TRIGGER IF EXISTS messages_conversation_trigger ON messages;
CREATE TRIGGER messages_conversation_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();