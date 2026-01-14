import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config, validateConfig } from "@/config";
import { connectDb, disconnectDb } from "@/shared";
import { campaignRoutes } from "@/features/campaign";
import { claimRoutes } from "@/features/claim";
async function main() {
  validateConfig();
  await connectDb();
  const app = express();
  app.use(helmet());
  app.use(cors({
    origin: config.cors.origin === "*" ? true : config.cors.origin.split(","),
    credentials: config.cors.credentials,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
  app.use("/api/campaign", campaignRoutes);
  app.use("/api/claim", claimRoutes);
  app.get("/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });
  app.use((_, res) => res.status(404).json({ error: "Not found" }));
  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });
  const shutdown = async () => {
    console.log("Shutting down...");
    await disconnectDb();
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
