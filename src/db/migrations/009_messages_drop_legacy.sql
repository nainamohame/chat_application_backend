ALTER TABLE messages ALTER COLUMN conversation_id SET NOT NULL;

ALTER TABLE messages DROP COLUMN IF EXISTS receiver_id;
ALTER TABLE messages DROP COLUMN IF EXISTS is_read;
ALTER TABLE messages DROP COLUMN IF EXISTS delivered_at;
ALTER TABLE messages DROP COLUMN IF EXISTS read_at;

DROP INDEX IF EXISTS idx_messages_pair;
