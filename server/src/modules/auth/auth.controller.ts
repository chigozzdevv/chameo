import { Router } from "express";
import { isValidEmail, BadRequestError } from "@/shared";
import { signup, login, requestPasswordReset, resetPassword, changePassword } from "./auth.service";
import { authMiddleware } from "./auth.middleware";

const router = Router();

router.post("/signup", async (req, res, next) => {
  try {
    const { email, password, orgName } = req.body;
    if (!email || !isValidEmail(email)) throw new BadRequestError("Invalid email");
    if (!password || password.length < 8) throw new BadRequestError("Password must be at least 8 characters");
    if (!orgName || orgName.length < 2) throw new BadRequestError("Organization name required");

    const result = await signup(email, password, orgName);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new BadRequestError("Email and password required");

    const result = await login(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) throw new BadRequestError("Invalid email");

    await requestPasswordReset(email);
    res.json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token) throw new BadRequestError("Reset token required");
    if (!password || password.length < 8) throw new BadRequestError("Password must be at least 8 characters");

    await resetPassword(token, password);
    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new BadRequestError("Current and new password required");
    if (newPassword.length < 8) throw new BadRequestError("Password must be at least 8 characters");

    await changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
