const crypto = require('crypto');
const { insert } = require('../store');

async function createNotification(userId, message) {
  const id = crypto.randomUUID();
  insert('notifications', {
    id,
    user_id: userId,
    message,
    read_status: 0,
    created_at: new Date().toISOString(),
  });
  return { id, userId, message };
}

module.exports = {
  createNotification,
};
