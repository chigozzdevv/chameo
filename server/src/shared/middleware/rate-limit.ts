import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};

export function rateLimit(options: { windowMs: number; max: number; keyGenerator?: (req: Request) => string }) {
  const { windowMs, max, keyGenerator = (req) => req.ip || "unknown" } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = { count: 1, resetAt: now + windowMs };
      return next();
    }

    store[key].count++;

    if (store[key].count > max) {
      return res.status(429).json({ error: "Too many requests, please try again later" });
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  }
}, 60000);
