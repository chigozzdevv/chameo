import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";
import { logger } from "../logger";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    if (!err.isOperational) {
      logger.error("Non-operational error", { error: err.message, stack: err.stack });
    }
    return;
  }

  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
}
