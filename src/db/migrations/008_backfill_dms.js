// Procedural backfill: convert existing 1-to-1 messages into DM conversations.
//
// For every distinct (a, b) pair found in messages.receiver_id + sender_id:
//   1. Create one conversations row of type='dm'
//   2. Insert both users into conversation_members
//      - Initialize last_read_at / last_delivered_at from the prior message-level
//        is_read/read_at and delivered_at columns (best effort: take the max
//        across all messages they received in that pair).
//   3. UPDATE messages SET conversation_id for every row in that pair.

module.exports = async (client) => {
  const { rows: pairs } = await client.query(`
    SELECT DISTINCT
      LEAST(sender_id, receiver_id)    AS user_a,
      GREATEST(sender_id, receiver_id) AS user_b
    FROM messages
    WHERE receiver_id IS NOT NULL AND conversation_id IS NULL
  `);

  console.log(`[008_backfill_dms] backfilling ${pairs.length} DM pair(s)`);

  for (const { user_a, user_b } of pairs) {
    const { rows: convRows } = await client.query(
      `INSERT INTO conversations(type, created_at, updated_at)
       VALUES('dm', NOW(), NOW())
       RETURNING id`
    );
    const convId = convRows[0].id;

    // Highest read/delivered timestamp each user has on messages they received in this pair.
    const watermarks = await client.query(
      `SELECT
         receiver_id AS user_id,
         MAX(read_at)      AS last_read_at,
         MAX(delivered_at) AS last_delivered_at
       FROM messages
       WHERE ((sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1))
       GROUP BY receiver_id`,
      [user_a, user_b]
    );
    const wmByUser = new Map(
      watermarks.rows.map((r) => [r.user_id, r])
    );

    for (const userId of [user_a, user_b]) {
      const wm = wmByUser.get(userId) || {};
      await client.query(
        `INSERT INTO conversation_members(
           conversation_id, user_id, role, last_read_at, last_delivered_at
         ) VALUES($1, $2, 'member', $3, $4)
         ON CONFLICT DO NOTHING`,
        [convId, userId, wm.last_read_at || null, wm.last_delivered_at || null]
      );
    }

    await client.query(
      `UPDATE messages
       SET conversation_id = $1
       WHERE ((sender_id = $2 AND receiver_id = $3)
           OR (sender_id = $3 AND receiver_id = $2))
         AND conversation_id IS NULL`,
      [convId, user_a, user_b]
    );
  }

  console.log(`[008_backfill_dms] done`);
};
