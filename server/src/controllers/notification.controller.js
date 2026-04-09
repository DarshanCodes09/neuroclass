const { find, update } = require('../store');

async function listNotifications(req, res) {
  try {
    const { userId } = req.params;
    const rows = find('notifications', (n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50)
      .map((n) => ({
        id: n.id,
        userId: n.user_id,
        message: n.message,
        readStatus: n.read_status,
        createdAt: n.created_at,
      }));
    const unreadCount = rows.filter((row) => Number(row.readStatus) === 0).length;
    return res.json({ notifications: rows, unreadCount });
  } catch (error) {
    console.error('listNotifications error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
}

async function markRead(req, res) {
  try {
    const { notificationId } = req.params;
    update('notifications', (n) => n.id === notificationId, (n) => ({ ...n, read_status: 1 }));
    return res.json({ ok: true });
  } catch (error) {
    console.error('markRead error:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
}

module.exports = {
  listNotifications,
  markRead,
};
