import { Router } from 'express';
import { getStore } from '../db';
import { requireAuth } from '../middleware';
import { asyncHandler } from './helpers';

const router = Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const notifications = await getStore().listNotifications(req.user!.id);
  res.json({ notifications });
}));

router.patch('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const ok = await getStore().markNotificationRead(req.params.id, req.user!.id);
  if (!ok) {
    return res.status(404).json({ error: 'Notification not found.' });
  }
  res.json({ success: true });
}));

export default router;
