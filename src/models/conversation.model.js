const pool = require("../config/db");

const COLS = "id, type, name, created_by, created_at, updated_at";

const create = async ({ type, name, createdBy }) => {
    const { rows } = await pool.query(
        `INSERT INTO conversations(type, name, created_by)
     VALUES($1, $2, $3)
     RETURNING ${COLS}`,
        [type, name, createdBy]
    );
    return rows[0];
};

const findById = async (id) => {
    const { rows } = await pool.query(
        `SELECT ${COLS} FROM conversations WHERE id = $1`,
        [id]
    );
    return rows[0];
};

const renameGroup = async (id, name) => {
    const { rows } = await pool.query(
        `UPDATE conversations
     SET name = $2, updated_at = NOW()
     WHERE id = $1 AND type = 'group'
     RETURNING ${COLS}`,
        [id, name]
    );
    return rows[0];
};

const touchUpdated = async (id) => {
    await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [id]);
};

const addMembers = async (conversationId, userIds, role = "member") => {
    if (!userIds?.length) return [];
    const values = userIds
        .map((_, i) => `($1, $${i + 2}, $${userIds.length + 2})`)
        .join(", ");
    const params = [conversationId, ...userIds, role];
    const { rows } = await pool.query(
        `INSERT INTO conversation_members(conversation_id, user_id, role)
     VALUES ${values}
     ON CONFLICT (conversation_id, user_id) DO NOTHING
     RETURNING user_id`,
        params
    );
    return rows.map((r) => r.user_id);
};

const removeMember = async (conversationId, userId) => {
    const { rowCount } = await pool.query(
        `DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
    );
    return rowCount > 0;
};

const getMember = async (conversationId, userId) => {
    const { rows } = await pool.query(
        `SELECT conversation_id, user_id, role, joined_at, last_read_at, last_delivered_at
     FROM conversation_members
     WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
    );
    return rows[0];
};

const listMembers = async (conversationId) => {
    const { rows } = await pool.query(
        `SELECT cm.user_id, cm.role, cm.joined_at, cm.last_read_at, cm.last_delivered_at,
            u.name, u.email
     FROM conversation_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.conversation_id = $1
     ORDER BY u.name ASC`,
        [conversationId]
    );
    return rows;
};

const listMemberIds = async (conversationId) => {
    const { rows } = await pool.query(
        `SELECT user_id FROM conversation_members WHERE conversation_id = $1`,
        [conversationId]
    );
    return rows.map((r) => r.user_id);
};

const listIdsForUser = async (userId) => {
    const { rows } = await pool.query(
        `SELECT conversation_id FROM conversation_members WHERE user_id = $1`,
        [userId]
    );
    return rows.map((r) => r.conversation_id);
};

const listForUser = async (userId) => {
    const { rows } = await pool.query(
        `SELECT
       c.id, c.type, c.name, c.created_by, c.created_at, c.updated_at,
       last_msg.created_at AS last_message_at,
       last_msg.content    AS last_message_content,
       last_msg.sender_id  AS last_message_sender_id,
       COALESCE(unr.unread_count, 0)::int AS unread_count,
       members.member_ids,
       members.member_names,
       members.dm_partner_id
     FROM conversations c
     JOIN conversation_members cm_self ON cm_self.conversation_id = c.id AND cm_self.user_id = $1
     LEFT JOIN LATERAL (
       SELECT created_at, content, sender_id
       FROM messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC
       LIMIT 1
     ) last_msg ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM messages m
       WHERE m.conversation_id = c.id
         AND m.sender_id <> $1
         AND (cm_self.last_read_at IS NULL OR m.created_at > cm_self.last_read_at)
     ) unr ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         array_agg(u.id ORDER BY u.name) AS member_ids,
         array_agg(u.name ORDER BY u.name) AS member_names,
         (SELECT u2.id FROM conversation_members cm2
            JOIN users u2 ON u2.id = cm2.user_id
            WHERE cm2.conversation_id = c.id AND cm2.user_id <> $1
            LIMIT 1) AS dm_partner_id
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = c.id
     ) members ON TRUE
     ORDER BY last_msg.created_at DESC NULLS LAST, c.updated_at DESC`,
        [userId]
    );
    return rows;
};

const findDmBetween = async (userA, userB) => {
    const { rows } = await pool.query(
        `SELECT c.id
     FROM conversations c
     JOIN conversation_members a ON a.conversation_id = c.id AND a.user_id = $1
     JOIN conversation_members b ON b.conversation_id = c.id AND b.user_id = $2
     WHERE c.type = 'dm'
     LIMIT 1`,
        [userA, userB]
    );
    return rows[0]?.id || null;
};

const markRead = async (conversationId, userId) => {
    const { rows } = await pool.query(
        `UPDATE conversation_members
     SET last_read_at = NOW(),
         last_delivered_at = COALESCE(last_delivered_at, NOW())
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING last_read_at, last_delivered_at`,
        [conversationId, userId]
    );
    return rows[0] || null;
};

const markDelivered = async (conversationId, userId) => {
    const { rows } = await pool.query(
        `UPDATE conversation_members
     SET last_delivered_at = NOW()
     WHERE conversation_id = $1 AND user_id = $2
     RETURNING last_delivered_at`,
        [conversationId, userId]
    );
    return rows[0] || null;
};

const markAllDeliveredForUser = async (userId) => {
    const { rows } = await pool.query(
        `UPDATE conversation_members
     SET last_delivered_at = NOW()
     WHERE user_id = $1
     RETURNING conversation_id, last_delivered_at`,
        [userId]
    );
    return rows;
};

module.exports = {
    create,
    findById,
    renameGroup,
    touchUpdated,
    addMembers,
    removeMember,
    getMember,
    listMembers,
    listMemberIds,
    listIdsForUser,
    listForUser,
    findDmBetween,
    markRead,
    markDelivered,
    markAllDeliveredForUser,
};
