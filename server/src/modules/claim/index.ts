import { Router } from "express";
import claimController from "./claim.controller";
import requestController from "./request.controller";

const router = Router();

router.use("/", claimController);
router.use("/", requestController);

export default router;

export { createClaimIndexes } from "./claim.model";
export { sendBatchNotifications } from "./notification.service";
