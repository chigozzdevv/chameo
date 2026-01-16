import { Router } from "express";
import claimController from "./claim.controller";
import requestController from "./request.controller";

const router = Router();

router.use("/", claimController);
router.use("/", requestController);

export { router as claimRoutes };
export * from "./claim.model";
export * from "./claim.service";
export * from "./notification.service";
export * from "./verification.service";
