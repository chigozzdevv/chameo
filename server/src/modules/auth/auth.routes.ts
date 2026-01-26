import { Router } from "express";
import { authMiddleware } from "./auth.middleware";
import {
  handleSignup,
  handleLogin,
  handleMe,
  handleForgotPassword,
  handleResetPassword,
  handleChangePassword,
} from "./auth.controller";

const router = Router();

router.post("/signup", handleSignup);
router.post("/login", handleLogin);
router.get("/me", authMiddleware, handleMe);
router.post("/forgot-password", handleForgotPassword);
router.post("/reset-password", handleResetPassword);
router.post("/change-password", authMiddleware, handleChangePassword);

export { router as authRoutes };
