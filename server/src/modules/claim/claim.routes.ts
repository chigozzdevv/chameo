import { Router } from "express";
import {
  handleVerifyMagicLink,
  handleSocialUrl,
  handleSocialCallback,
  handleSocialCallbackByState,
  handleProcessClaim,
  handleClaimStatus,
} from "./claim.controller";
import { handleRequestClaim } from "./request.controller";

const router = Router();

router.post("/verify/magic-link", handleVerifyMagicLink);
router.get("/verify/social/:provider/url", handleSocialUrl);
router.post("/verify/social/:provider/callback", handleSocialCallback);
router.post("/verify/social/callback", handleSocialCallbackByState);
router.post("/process", handleProcessClaim);
router.get("/status/:campaignId/:identityHash", handleClaimStatus);
router.post("/request/:campaignId", handleRequestClaim);

export { router as claimRoutes };
