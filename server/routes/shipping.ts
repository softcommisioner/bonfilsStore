import { Router } from 'express';
import { getStore } from '../db';
import { asyncHandler } from './helpers';

const router = Router();

router.get('/track/:trackingNumber', asyncHandler(async (req, res) => {
  const trackingNumber = String(req.params.trackingNumber || '').trim();
  if (!trackingNumber) {
    return res.status(400).json({ error: 'A tracking number is required.' });
  }
  const shipment = await getStore().findShippingOrderByTracking(trackingNumber);
  if (!shipment) {
    return res.status(404).json({ error: 'No shipment found for that tracking number.' });
  }
  res.json({ shipment });
}));

export default router;
