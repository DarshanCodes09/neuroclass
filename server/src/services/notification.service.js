const { getAdmin } = require('../db');

async function createNotification(userId, message, type = 'info') {
  try {
    const sb = getAdmin();
    await sb.from('notifications').insert({ user_id: userId, title: message, body: message, type });
  } catch (err) {
    console.warn('[notification] Failed to create notification:', err.message);
  }
}

module.exports = { createNotification };
