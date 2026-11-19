import { Router } from 'express';
import type { ChinaRequest, Order, ShippingOrder } from '../../src/types.js';
import { getStore } from '../db/index.js';
import { asyncHandler } from './helpers.js';

const router = Router();

const CHECKPOINTS = [
  { title: 'Shipment registered', location: 'Origin warehouse', description: 'The shipment was created and handed to the carrier.' },
  { title: 'Packed and ready', location: 'Origin warehouse', description: 'Goods were consolidated and prepared for export.' },
  { title: 'International transit', location: 'In transit', description: 'The shipment is on its way to the destination country.' },
  { title: 'Arrived in destination country', location: 'Destination', description: 'The shipment cleared local processing and is being prepared for delivery.' },
  { title: 'Delivered', location: 'Destination', description: 'The shipment was handed to the recipient.' },
] as const;

function stageForOrder(order: Order): { stage: ShippingOrder['currentStage']; status: ShippingOrder['status'] } {
  const item = order.items.find(entry => entry.status === 'shipped') || order.items[0];
  if (item?.status === 'delivered' || order.status === 'delivered') return { stage: 5, status: 'delivered' };
  if (item?.status === 'shipped') return { stage: 3, status: 'in_transit' };
  if (item?.status === 'processing' || order.status === 'processing') return { stage: 2, status: 'in_transit' };
  return { stage: 1, status: 'in_transit' };
}

function stageForChinaRequest(request: ChinaRequest): { stage: ShippingOrder['currentStage']; status: ShippingOrder['status'] } {
  switch (request.status) {
    case 'DELIVERED': return { stage: 5, status: 'delivered' };
    case 'ARRIVED': return { stage: 4, status: 'out_for_delivery' };
    case 'IN_TRANSIT': return { stage: 3, status: 'in_transit' };
    case 'SHIPPING': return { stage: 2, status: 'in_transit' };
    default: return { stage: 1, status: 'in_transit' };
  }
}

function buildCheckpoints(stage: number, createdAt: string, updatedAt: string): ShippingOrder['checkpoints'] {
  return CHECKPOINTS.map((checkpoint, index) => ({
    ...checkpoint,
    date: index === 0 ? createdAt : updatedAt,
    completed: index + 1 <= stage,
  }));
}

function shipmentFromOrder(order: Order, trackingNumber: string): ShippingOrder {
  const { stage, status } = stageForOrder(order);
  const item = order.items.find(entry => entry.trackingNumber === trackingNumber);
  return {
    id: `TRK-${order.id}`,
    trackingNumber,
    carrier: item?.sellerName || 'Bonfils Logistics',
    method: 'express',
    origin: item?.sellerName || 'Bonfils Partner Warehouse',
    destination: `${order.shippingAddress.city}, ${order.shippingAddress.country}`,
    recipientName: order.shippingAddress.fullName,
    recipientPhone: order.shippingAddress.phone,
    currentStage: stage,
    estimatedDelivery: order.updatedAt,
    status,
    checkpoints: buildCheckpoints(stage, order.createdAt, order.updatedAt),
  };
}

function shipmentFromChinaRequest(request: ChinaRequest, trackingNumber: string): ShippingOrder {
  const { stage, status } = stageForChinaRequest(request);
  return {
    id: `TRK-${request.id}`,
    trackingNumber,
    carrier: request.carrier || 'Bonfils International Freight',
    method: request.shippingMethod,
    origin: 'China Supplier',
    destination: `${request.city}, ${request.country}`,
    recipientName: request.customerName,
    recipientPhone: request.customerPhone,
    currentStage: stage,
    estimatedDelivery: request.updatedAt,
    status,
    checkpoints: buildCheckpoints(stage, request.createdAt, request.updatedAt),
  };
}

router.get('/track/:trackingNumber', asyncHandler(async (req, res) => {
  const trackingNumber = String(req.params.trackingNumber || '').trim();
  if (!trackingNumber) {
    return res.status(400).json({ error: 'A tracking number is required.' });
  }
  const needle = trackingNumber.toUpperCase();
  const store = getStore();

  // The legacy shipping_orders table is intentionally empty. Real tracking
  // numbers are persisted on order items and China sourcing requests, so
  // resolve them from those durable records instead of returning a 404.
  const stored = await store.findShippingOrderByTracking(needle);
  if (stored) {
    return res.json({ shipment: stored });
  }

  const orders = await store.listOrders({});
  for (const order of orders) {
    if (order.items.some(item => item.trackingNumber?.toUpperCase() === needle)) {
      return res.json({ shipment: shipmentFromOrder(order, trackingNumber) });
    }
  }

  const requests = await store.listChinaRequests({});
  const request = requests.find(entry => entry.trackingNumber?.toUpperCase() === needle);
  if (request) {
    return res.json({ shipment: shipmentFromChinaRequest(request, trackingNumber) });
  }

  return res.status(404).json({ error: 'No shipment found for that tracking number.' });
}));

export default router;
