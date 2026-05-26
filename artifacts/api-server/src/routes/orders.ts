import { Router, type IRouter } from "express";
import { db, storeSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { updateOrderStatus } from "../lib/bigcommerce.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const SETTINGS_ID = "default";

const BC_STATUS_LABELS: Record<number, string> = {
  1: "Pending",
  2: "Awaiting Payment",
  3: "Awaiting Fulfillment",
  4: "Shipped",
  5: "Partially Shipped",
  7: "Cancelled",
  9: "Awaiting Pickup",
  10: "Completed",
  11: "Awaiting Shipment",
};

// POST /orders/status
// Update one or more BigCommerce order statuses using saved store credentials
router.post("/orders/status", async (req, res): Promise<void> => {
  const { orderIds, statusId } = req.body as { orderIds?: unknown; statusId?: unknown };

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    res.status(400).json({ error: "orderIds must be a non-empty array of integers" });
    return;
  }

  const parsedStatus = typeof statusId === "number" ? statusId : parseInt(String(statusId), 10);
  if (isNaN(parsedStatus)) {
    res.status(400).json({ error: "statusId must be a valid integer" });
    return;
  }

  if (!BC_STATUS_LABELS[parsedStatus]) {
    res.status(400).json({
      error: `Unknown statusId ${parsedStatus}. Valid values: ${Object.entries(BC_STATUS_LABELS).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    });
    return;
  }

  const parsedIds = (orderIds as unknown[]).map((id) => {
    const n = typeof id === "number" ? id : parseInt(String(id), 10);
    return isNaN(n) ? null : n;
  });

  if (parsedIds.some((id) => id === null)) {
    res.status(400).json({ error: "All orderIds must be valid integers" });
    return;
  }

  const rows = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, SETTINGS_ID))
    .limit(1);

  if (rows.length === 0) {
    res.status(422).json({ error: "Store not configured. Go to Settings and save your store credentials first." });
    return;
  }

  const { storeHash, accessToken } = rows[0];
  const creds = { storeHash, accessToken };

  const results: Array<{ orderId: number; success: boolean; error?: string | null }> = [];

  for (const orderId of parsedIds as number[]) {
    const result = await updateOrderStatus(creds, String(orderId), parsedStatus);
    results.push({
      orderId,
      success: result.success,
      error: result.success ? null : (result.error ?? "Unknown error"),
    });
    if (!result.success) {
      req.log.warn({ orderId, error: result.error }, "Order status update failed");
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  logger.info(
    { statusId: parsedStatus, statusLabel: BC_STATUS_LABELS[parsedStatus], total: parsedIds.length, successCount, failedCount },
    "Bulk order status update completed"
  );

  res.json({ results, successCount, failedCount });
});

export default router;
