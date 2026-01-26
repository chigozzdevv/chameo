import { Request, Response, NextFunction } from "express";
import { isValidEmail, BadRequestError } from "@/shared";
import { signup, login, requestPasswordReset, resetPassword, changePassword } from "./auth.service";

export async function handleSignup(req: Request, res: Response, next: NextFunction) {
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
}

export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new BadRequestError("Email and password required");

    const result = await login(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export function handleMe(req: Request, res: Response) {
  res.json({ success: true, user: req.user });
}

export async function handleForgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) throw new BadRequestError("Invalid email");

    await requestPasswordReset(email);
    res.json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    next(error);
  }
}

export async function handleResetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token) throw new BadRequestError("Reset token required");
    if (!password || password.length < 8) throw new BadRequestError("Password must be at least 8 characters");

    await resetPassword(token, password);
    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
}

export async function handleChangePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new BadRequestError("Current and new password required");
    if (newPassword.length < 8) throw new BadRequestError("Password must be at least 8 characters");

    await changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
}
