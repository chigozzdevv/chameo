import { Router } from "express";
import { isValidEmail, BadRequestError } from "@/shared";
import { signup, login } from "./auth.service";
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

export default router;
