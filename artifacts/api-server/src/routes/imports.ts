import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, importJobsTable, importLogsTable, storeSettingsTable } from "@workspace/db";
import {
  GetImportJobParams,
  GetImportLogsParams,
  PauseImportJobParams,
  ResumeImportJobParams,
  RetryFailedRowsParams,
  DownloadErrorReportParams,
  StartCustomerImportBody,
  StartOrderImportBody,
  StartProductImportBody,
} from "@workspace/api-zod";

import { runImportJob, retryFailedRowsForJob } from "../lib/importRunner.js";
import { updateOrderStatus } from "../lib/bigcommerce.js";
import { logger } from "../lib/logger.js";

async function resolveCredentials(body: Record<string, unknown>): Promise<{ storeHash: string; accessToken: string } | null> {
  if (body.useSavedCredentials === "true" || body.useSavedCredentials === true) {
    const rows = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, "default")).limit(1);
    if (rows.length === 0) return null;
    return { storeHash: rows[0].storeHash, accessToken: rows[0].accessToken };
  }
  const storeHash = typeof body.storeHash === "string" ? body.storeHash : null;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : null;
  if (!storeHash || !accessToken) return null;
  return { storeHash, accessToken };
}

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function formatJob(job: typeof importJobsTable.$inferSelect) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successRows: job.successRows,
    failedRows: job.failedRows,
    delayMs: job.delayMs,
    autoCompleteStatusId: job.autoCompleteStatusId ?? null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
  };
}

function formatLog(log: typeof importLogsTable.$inferSelect) {
  return {
    id: log.id,
    jobId: log.jobId,
    rowNumber: log.rowNumber,
    status: log.status,
    message: log.message,
    payload: log.payload ?? null,
    entityId: log.entityId ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

// GET /imports - list all import jobs
router.get("/imports", async (_req, res): Promise<void> => {
  const jobs = await db.select().from(importJobsTable).orderBy(desc(importJobsTable.createdAt));
  res.json(jobs.map(formatJob));
});

// POST /imports/customers
router.post("/imports/customers", upload.single("file"), async (req, res): Promise<void> => {
  const creds = await resolveCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: "Store credentials are required. Provide storeHash & accessToken or save credentials in Settings." });
    return;
  }
  const parsed = StartCustomerImportBody.safeParse({
    ...req.body,
    storeHash: creds.storeHash,
    accessToken: creds.accessToken,
    delayMs: req.body.delayMs !== undefined ? Number(req.body.delayMs) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "CSV file is required" });
    return;
  }
  const jobId = randomUUID();
  const csvData = req.file.buffer.toString("base64");
  await db.insert(importJobsTable).values({
    id: jobId,
    type: "customers",
    status: "pending",
    totalRows: 0,
    processedRows: 0,
    successRows: 0,
    failedRows: 0,
    delayMs: parsed.data.delayMs,
    storeHash: creds.storeHash,
    accessToken: creds.accessToken,
    csvData,
  });
  runImportJob(jobId).catch((err) => logger.error({ err, jobId }, "Customer import job failed"));
  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, jobId));
  res.status(201).json(formatJob(job));
});

// POST /imports/products
router.post("/imports/products", upload.single("file"), async (req, res): Promise<void> => {
  const creds = await resolveCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: "Store credentials are required. Provide storeHash & accessToken or save credentials in Settings." });
    return;
  }
  const parsed = StartProductImportBody.safeParse({
    ...req.body,
    storeHash: creds.storeHash,
    accessToken: creds.accessToken,
    delayMs: req.body.delayMs !== undefined ? Number(req.body.delayMs) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "CSV file is required" });
    return;
  }
  const jobId = randomUUID();
  const csvData = req.file.buffer.toString("base64");
  await db.insert(importJobsTable).values({
    id: jobId,
    type: "products",
    status: "pending",
    totalRows: 0,
    processedRows: 0,
    successRows: 0,
    failedRows: 0,
    delayMs: parsed.data.delayMs,
    storeHash: creds.storeHash,
    accessToken: creds.accessToken,
    csvData,
  });
  runImportJob(jobId).catch((err) => logger.error({ err, jobId }, "Product import job failed"));
  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, jobId));
  res.status(201).json(formatJob(job));
});

// POST /imports/orders
router.post("/imports/orders", upload.single("file"), async (req, res): Promise<void> => {
  const creds = await resolveCredentials(req.body);
  if (!creds) {
    res.status(400).json({ error: "Store credentials are required. Provide storeHash & accessToken or save credentials in Settings." });
    return;
  }
  const parsed = StartOrderImportBody.safeParse({
    ...req.body,
    storeHash: creds.storeHash,
    accessToken: creds.accessToken,
    delayMs: req.body.delayMs !== undefined ? Number(req.body.delayMs) : undefined,
    autoCompleteStatusId: req.body.autoCompleteStatusId !== undefined && req.body.autoCompleteStatusId !== ""
      ? Number(req.body.autoCompleteStatusId)
      : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "CSV file is required" });
    return;
  }
  const autoCompleteStatusId = parsed.data.autoCompleteStatusId ?? null;
  const jobId = randomUUID();
  const csvData = req.file.buffer.toString("base64");
  await db.insert(importJobsTable).values({
    id: jobId,
    type: "orders",
    status: "pending",
    totalRows: 0,
    processedRows: 0,
    successRows: 0,
    failedRows: 0,
    delayMs: parsed.data.delayMs,
    autoCompleteStatusId,
    storeHash: parsed.data.storeHash,
    accessToken: parsed.data.accessToken,
    csvData,
  });
  runImportJob(jobId).catch((err) => logger.error({ err, jobId }, "Order import job failed"));
  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, jobId));
  res.status(201).json(formatJob(job));
});

// GET /imports/stats/summary
router.get("/imports/stats/summary", async (_req, res): Promise<void> => {
  const jobs = await db.select().from(importJobsTable);
  const totalJobs = jobs.length;
  const totalRows = jobs.reduce((a, j) => a + j.totalRows, 0);
  const totalSuccess = jobs.reduce((a, j) => a + j.successRows, 0);
  const totalFailed = jobs.reduce((a, j) => a + j.failedRows, 0);
  const jobsByType = {
    customers: jobs.filter((j) => j.type === "customers").length,
    products: jobs.filter((j) => j.type === "products").length,
    orders: jobs.filter((j) => j.type === "orders").length,
  };
  const totalOrdersImported = jobs.filter((j) => j.type === "orders").reduce((a, j) => a + j.successRows, 0);
  const totalCustomersImported = jobs.filter((j) => j.type === "customers").reduce((a, j) => a + j.successRows, 0);
  res.json({ totalJobs, totalRows, totalSuccess, totalFailed, jobsByType, totalOrdersImported, totalCustomersImported });
});

// GET /imports/:jobId
router.get("/imports/:jobId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const params = GetImportJobParams.safeParse({ jobId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, params.data.jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(formatJob(job));
});

// GET /imports/:jobId/logs
router.get("/imports/:jobId/logs", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const params = GetImportLogsParams.safeParse({ jobId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db
    .select()
    .from(importLogsTable)
    .where(eq(importLogsTable.jobId, params.data.jobId))
    .orderBy(importLogsTable.rowNumber);
  res.json({ logs: logs.map(formatLog), total: logs.length });
});

// POST /imports/:jobId/pause
router.post("/imports/:jobId/pause", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const params = PauseImportJobParams.safeParse({ jobId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, params.data.jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  await db.update(importJobsTable).set({ status: "paused" }).where(eq(importJobsTable.id, params.data.jobId));
  const [updated] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, params.data.jobId));
  res.json(formatJob(updated));
});

// POST /imports/:jobId/resume
router.post("/imports/:jobId/resume", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const params = ResumeImportJobParams.safeParse({ jobId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, params.data.jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  await db.update(importJobsTable).set({ status: "running" }).where(eq(importJobsTable.id, params.data.jobId));
  const [updated] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, params.data.jobId));
  res.json(formatJob(updated));
});

// POST /imports/:jobId/retry-failed
router.post("/imports/:jobId/retry-failed", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const params = RetryFailedRowsParams.safeParse({ jobId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const newJobId = await retryFailedRowsForJob(params.data.jobId);
    const [newJob] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, newJobId));
    res.json(formatJob(newJob));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Retry failed" });
  }
});

// GET /imports/:jobId/error-report
// POST /imports/:jobId/update-order-statuses
router.post("/imports/:jobId/update-order-statuses", async (req, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const { statusId } = req.body as { statusId?: number };

  if (!statusId || typeof statusId !== "number") {
    res.status(400).json({ error: "statusId (number) is required" });
    return;
  }

  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.type !== "orders") {
    res.status(400).json({ error: "This action is only available for order import jobs" });
    return;
  }

  const successLogs = await db
    .select()
    .from(importLogsTable)
    .where(eq(importLogsTable.jobId, jobId));

  const orderLogs = successLogs.filter((l) => l.status === "success" && l.entityId);

  let updated = 0;
  let failed = 0;

  for (const log of orderLogs) {
    const result = await updateOrderStatus(
      { storeHash: job.storeHash, accessToken: job.accessToken },
      log.entityId!,
      statusId
    );
    if (result.success) {
      updated++;
    } else {
      failed++;
      logger.warn({ orderId: log.entityId, error: result.error }, "Failed to update order status");
    }
  }

  res.json({ updated, failed, total: orderLogs.length });
});

router.get("/imports/:jobId/error-report", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const params = DownloadErrorReportParams.safeParse({ jobId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db
    .select()
    .from(importLogsTable)
    .where(eq(importLogsTable.jobId, params.data.jobId));

  const errorLogs = logs.filter((l) => l.status === "error");
  const csvLines = [
    "row_number,status,message,payload",
    ...errorLogs.map((l) => `${l.rowNumber},${l.status},"${l.message.replace(/"/g, '""')}","${(l.payload ?? "").replace(/"/g, '""')}"`),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=error-report-${params.data.jobId}.csv`);
  res.send(csvLines.join("\n"));
});

export default router;
