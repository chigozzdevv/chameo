import { env, validateEnv, connectDb, disconnectDb } from "@/config";
import { vault } from "@/lib/vault";
import { logger } from "@/shared";
import { createUserIndexes } from "@/modules/auth";
import { createCampaignIndexes } from "@/modules/campaign";
import { createClaimIndexes } from "@/modules/claim";
import { createVoteIndexes } from "@/modules/voting";
import { createAnalyticsIndexes } from "@/modules/analytics";
import { createApp } from "./app";

async function main() {
  validateEnv();

  const vaultHealthy = await vault.healthCheck();
  if (!vaultHealthy) {
    logger.warn("Vault is not available - wallet operations will fail");
  }

  await connectDb();
  await createUserIndexes();
  await createCampaignIndexes();
  await createClaimIndexes();
  await createVoteIndexes();
  await createAnalyticsIndexes();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`, { env: env.nodeEnv });
  });

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
