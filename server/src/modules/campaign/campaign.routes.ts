import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "@/modules/auth";
import {
  handleCreateCampaign,
  handleListCampaigns,
  handleGetCampaign,
  handleGetCampaignForEdit,
  handleGetFundingAddress,
  handleUpdateCampaign,
  handleDeleteCampaign,
  handleGetFundingConfig,
  handleCheckFunding,
  handleAddRecipients,
  handleReplaceRecipients,
  handleNotifyRecipients,
  handleCloseCampaign,
  handleSelectWinners,
  handleUploadImage,
  handleUpdateTheme,
  handleUpdateRefundAddress,
  handleCheckDispute,
} from "./campaign.controller";

const router = Router();
const upload = multer();

router.post("/", authMiddleware, handleCreateCampaign);
router.get("/", authMiddleware, handleListCampaigns);
router.get("/:id", handleGetCampaign);
router.get("/:id/edit", authMiddleware, handleGetCampaignForEdit);
router.get("/:id/funding-address", authMiddleware, handleGetFundingAddress);
router.post("/:id/update", authMiddleware, handleUpdateCampaign);
router.delete("/:id", authMiddleware, handleDeleteCampaign);
router.get("/:id/funding-config", authMiddleware, handleGetFundingConfig);
router.post("/:id/check-funding", authMiddleware, handleCheckFunding);
router.post("/:id/recipients", authMiddleware, handleAddRecipients);
router.post("/:id/recipients/replace", authMiddleware, handleReplaceRecipients);
router.post("/:id/notify", authMiddleware, handleNotifyRecipients);
router.post("/:id/close", authMiddleware, handleCloseCampaign);
router.post("/:id/select-winners", authMiddleware, handleSelectWinners);
router.post("/:id/upload-image", authMiddleware, upload.single("image"), handleUploadImage);
router.post("/:id/theme", authMiddleware, handleUpdateTheme);
router.post("/:id/refund-address", authMiddleware, handleUpdateRefundAddress);
router.post("/:id/check-dispute", handleCheckDispute);

export { router as campaignRoutes };
