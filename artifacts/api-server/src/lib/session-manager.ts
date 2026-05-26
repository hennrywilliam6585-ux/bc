import { db, appConfigTable, importJobsTable, importLogsTable, storeSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_KEY = "session_started_at";
const SESSION_DURATION_MS = 18 * 60 * 60 * 1000; // 18 hours
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

let checkTimer: ReturnType<typeof setInterval> | null = null;

export async function getSessionStartedAt(): Promise<Date | null> {
  const rows = await db
    .select()
    .from(appConfigTable)
    .where(eq(appConfigTable.key, SESSION_KEY))
    .limit(1);
  if (rows.length === 0) return null;
  const d = new Date(rows[0].value);
  return isNaN(d.getTime()) ? null : d;
}

export async function startSession(): Promise<Date> {
  const existing = await getSessionStartedAt();
  if (existing) return existing;

  const now = new Date();
  await db
    .insert(appConfigTable)
    .values({ key: SESSION_KEY, value: now.toISOString(), updatedAt: now })
    .onConflictDoNothing();
  logger.info({ startedAt: now.toISOString() }, "18-hour session timer started");
  return now;
}

export async function wipeAllData(): Promise<void> {
  logger.info("18-hour session expired — wiping all data");
  await db.delete(importLogsTable);
  await db.delete(importJobsTable);
  await db.delete(storeSettingsTable);
  await db.delete(appConfigTable).where(eq(appConfigTable.key, SESSION_KEY));
  logger.info("All data wiped. App reset to fresh state.");
}

export async function getSessionStatus(): Promise<{
  active: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  msRemaining: number | null;
}> {
  const startedAt = await getSessionStartedAt();
  if (!startedAt) {
    return { active: false, startedAt: null, expiresAt: null, msRemaining: null };
  }
  const expiresAt = new Date(startedAt.getTime() + SESSION_DURATION_MS);
  const msRemaining = expiresAt.getTime() - Date.now();
  return {
    active: true,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    msRemaining: Math.max(0, msRemaining),
  };
}

async function checkAndWipeIfExpired(): Promise<void> {
  try {
    const startedAt = await getSessionStartedAt();
    if (!startedAt) return;
    const age = Date.now() - startedAt.getTime();
    if (age >= SESSION_DURATION_MS) {
      await wipeAllData();
    }
  } catch (err) {
    logger.error({ err }, "Error during session expiry check");
  }
}

export function initSessionManager(): void {
  if (checkTimer) return;
  checkAndWipeIfExpired();
  checkTimer = setInterval(checkAndWipeIfExpired, CHECK_INTERVAL_MS);
  logger.info("Session manager started (18-hour auto-wipe active)");
}
