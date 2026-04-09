const { getAdmin } = require('../db');

function sb() { return getAdmin(); }

async function listNotifications(req, res) {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required.' });
  const { data, error } = await sb().from('notifications')
    .select('*').eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ notifications: data || [] });
}

async function markRead(req, res) {
  const { notificationId } = req.params;
  const { error } = await sb().from('notifications').update({ read: true }).eq('id', notificationId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
}

module.exports = { listNotifications, markRead };
