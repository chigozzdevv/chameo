import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "@/config";
import { errorHandler, logger } from "@/shared";
import { authRoutes } from "@/modules/auth";
import { campaignRoutes } from "@/modules/campaign";
import { claimRoutes } from "@/modules/claim";
import { votingRoutes } from "@/modules/voting";
import { analyticsRoutes } from "@/modules/analytics";

export function createApp() {
  const app = express();

  app.use(helmet());
  const corsOrigins =
    env.cors.origin === "*"
      ? "*"
      : env.cors.origin.split(",").map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins === "*") {
          callback(null, true);
          return;
        }
        callback(null, corsOrigins.includes(origin));
      },
      credentials: env.cors.credentials,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(`${req.method} ${req.path} ${res.statusCode}`, { duration: Date.now() - start });
    });
    next();
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/campaign", campaignRoutes);
  app.use("/api/claim", claimRoutes);
  app.use("/api/voting", votingRoutes);
  app.use("/api/analytics", analyticsRoutes);

  app.get("/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use(errorHandler);
  app.use((_, res) => res.status(404).json({ error: "Not found" }));

  return app;
}
