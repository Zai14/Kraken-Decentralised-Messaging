/*
  # Add WebRTC signaling support

  1. New Tables
    - `signals`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `from_address` (text)
      - `to_address` (text)
      - `signal_data` (jsonb)

  2. Security
    - Enable RLS on signals table
    - Add policies for authenticated users to manage their signals
*/

-- Create signals table for WebRTC
CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  from_address text NOT NULL,
  to_address text NOT NULL,
  signal_data jsonb NOT NULL
);

-- Enable RLS
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Create policies for signals
CREATE POLICY "Users can insert their own signals"
  ON signals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = from_address
  );

CREATE POLICY "Users can read signals addressed to them"
  ON signals
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = to_address
  );

-- Add index for better query performance
CREATE INDEX idx_signals_to_address ON signals(to_address);

-- Add cleanup function for old signals
CREATE OR REPLACE FUNCTION cleanup_old_signals()
RETURNS trigger AS $$
BEGIN
  DELETE FROM signals
  WHERE created_at < NOW() - INTERVAL '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to cleanup old signals
CREATE TRIGGER cleanup_old_signals_trigger
AFTER INSERT ON signals
EXECUTE FUNCTION cleanup_old_signals();