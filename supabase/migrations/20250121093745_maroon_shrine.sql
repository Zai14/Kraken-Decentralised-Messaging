/*
  # Add File Sharing and Group Chat Features

  1. New Tables
    - `attachments`
      - `id` (uuid, primary key)
      - `message_id` (uuid, foreign key)
      - `file_path` (text)
      - `file_name` (text)
      - `file_size` (bigint)
      - `file_type` (text)
      - `created_at` (timestamp)

  2. Changes to Existing Tables
    - Add `is_group` to conversations
    - Add `group_name` to conversations
    - Add `group_avatar` to conversations

  3. Security
    - Enable RLS on attachments table
    - Add policies for file access
*/

-- Add group chat fields to conversations
ALTER TABLE conversations 
ADD COLUMN is_group boolean DEFAULT false,
ADD COLUMN group_name text,
ADD COLUMN group_avatar text;

-- Create attachments table
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Policies for attachments
CREATE POLICY "Users can view attachments in their conversations"
  ON attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = attachments.message_id
      AND auth.jwt()->>'sub' = ANY(c.participants)
    )
  );

CREATE POLICY "Users can upload attachments to their conversations"
  ON attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id
      AND auth.jwt()->>'sub' = ANY(c.participants)
    )
  );