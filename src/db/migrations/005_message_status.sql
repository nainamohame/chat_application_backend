ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

UPDATE messages SET read_at = created_at WHERE is_read = TRUE AND read_at IS NULL;
