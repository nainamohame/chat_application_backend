const pool = require("../config/db");

// Returns each message annotated with delivered_count / read_count from the OTHER members,
// plus audience_size = members.length - 1.  Used by both REST history and socket emits.
const enrichSelect = `
  m.id, m.sender_id, m.conversation_id, m.content, m.created_at,
  u.name AS sender_name,
  (SELECT COUNT(*)::int
     FROM conversation_members cm
     WHERE cm.conversation_id = m.conversation_id
       AND cm.user_id <> m.sender_id
       AND cm.last_delivered_at IS NOT NULL
       AND cm.last_delivered_at >= m.created_at) AS delivered_count,
  (SELECT COUNT(*)::int
     FROM conversation_members cm
     WHERE cm.conversation_id = m.conversation_id
       AND cm.user_id <> m.sender_id
       AND cm.last_read_at IS NOT NULL
       AND cm.last_read_at >= m.created_at) AS read_count,
  (SELECT COUNT(*)::int - 1
     FROM conversation_members cm
     WHERE cm.conversation_id = m.conversation_id) AS audience_size
`;

const insertInto = async (conversationId, senderId, content) => {
    const { rows } = await pool.query(
        `WITH inserted AS (
       INSERT INTO messages(conversation_id, sender_id, content)
       VALUES($1, $2, $3)
       RETURNING id, sender_id, conversation_id, content, created_at
     )
     SELECT ${enrichSelect}
     FROM inserted m
     JOIN users u ON u.id = m.sender_id`,
        [conversationId, senderId, content]
    );
    return rows[0];
};

const findById = async (id) => {
    const { rows } = await pool.query(
        `SELECT ${enrichSelect}
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1`,
        [id]
    );
    return rows[0];
};

const listForConversation = async (conversationId, limit = 50, before = null) => {
    const params = [conversationId, limit];
    let where = `m.conversation_id = $1`;
    if (before) {
        params.push(before);
        where += ` AND m.created_at < $3`;
    }
    const { rows } = await pool.query(
        `SELECT ${enrichSelect}
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT $2`,
        params
    );
    return rows.reverse();
};

const listAfter = async (conversationId, afterTimestamp) => {
    const { rows } = await pool.query(
        `SELECT ${enrichSelect}
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1 AND m.created_at > $2
     ORDER BY m.created_at ASC`,
        [conversationId, afterTimestamp]
    );
    return rows;
};

module.exports = { insertInto, findById, listForConversation, listAfter };
