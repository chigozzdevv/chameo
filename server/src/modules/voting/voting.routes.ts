import { Router } from "express";
import { authMiddleware } from "@/modules/auth";
import {
  handleGetInfo,
  handleGetResults,
  handleResolve,
  handleGetZkConfig,
  handleGetZkInputs,
  handleZkProve,
  handleZkCast,
} from "./voting.controller";

const router = Router();

router.get("/:campaignId/info", handleGetInfo);
router.get("/:campaignId/results", handleGetResults);
router.post("/:campaignId/resolve", authMiddleware, handleResolve);
router.get("/:campaignId/zk-config", handleGetZkConfig);
router.post("/:campaignId/zk-inputs", handleGetZkInputs);
router.post("/:campaignId/zk-prove", handleZkProve);
router.post("/:campaignId/zk-cast", handleZkCast);

export { router as votingRoutes };
