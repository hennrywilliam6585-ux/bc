import { Router, type IRouter } from "express";
import healthRouter from "./health";
import credentialsRouter from "./credentials";
import importsRouter from "./imports";
import templatesRouter from "./templates";
import settingsRouter from "./settings";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(credentialsRouter);
router.use(importsRouter);
router.use(templatesRouter);
router.use(settingsRouter);
router.use(ordersRouter);

export default router;
