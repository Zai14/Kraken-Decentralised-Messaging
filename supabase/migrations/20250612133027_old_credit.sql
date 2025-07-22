-- Add encrypted column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS encrypted boolean DEFAULT false;

-- Update existing messages to be marked as unencrypted
UPDATE messages 
SET encrypted = false 
WHERE encrypted IS NULL;