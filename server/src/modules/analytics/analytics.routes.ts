import { Router } from "express";
import { authMiddleware } from "@/modules/auth";
import {
  handleGetAnalytics,
  handleGetEvents,
  handleGetHandles,
  handleGrantAccess,
} from "./analytics.controller";

const router = Router();

router.get("/:campaignId", authMiddleware, handleGetAnalytics);
router.get("/:campaignId/events", authMiddleware, handleGetEvents);
router.get("/:campaignId/handles", authMiddleware, handleGetHandles);
router.post("/:campaignId/grant-access", authMiddleware, handleGrantAccess);

export { router as analyticsRoutes };
