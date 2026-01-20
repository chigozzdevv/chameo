import { env, validateEnv, connectDb, disconnectDb } from "@/config";
import { logger } from "@/shared";
import { createUserIndexes } from "@/modules/auth";
import { createCampaignIndexes, startFundingScheduler } from "@/modules/campaign";
import { createClaimIndexes } from "@/modules/claim";
import { createAnalyticsIndexes } from "@/modules/analytics";
import { startDisputeScheduler } from "@/modules/voting";
import { createApp } from "./app";

async function main() {
  validateEnv();

  await connectDb();
  await createUserIndexes();
  await createCampaignIndexes();
  await createClaimIndexes();
  await createAnalyticsIndexes();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`, { env: env.nodeEnv });
  });
  startDisputeScheduler();
  startFundingScheduler();

  const shutdown = async () => {
    logger.info("Shutting down...");
    await disconnectDb();
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.error("Failed to start server", { error: err.message });
  process.exit(1);
});
