import { Router, type IRouter } from "express";
import { startSession, getSessionStatus } from "../lib/session-manager.js";

const router: IRouter = Router();

router.post("/session/start", async (_req, res): Promise<void> => {
  await startSession();
  const status = await getSessionStatus();
  res.json(status);
});

router.get("/session/status", async (_req, res): Promise<void> => {
  const status = await getSessionStatus();
  res.json(status);
});

export default router;
