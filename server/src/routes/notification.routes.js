const express = require('express');
const { listNotifications, markRead } = require('../controllers/notification.controller');

const router = express.Router();

router.get('/:userId', listNotifications);
router.post('/:notificationId/read', markRead);

module.exports = router;
