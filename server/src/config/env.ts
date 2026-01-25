import "dotenv/config";

export const env = {
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGODB_DB_NAME || "chameo",
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    devnetRpcUrl: process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
  },
  inco: {
    programId: process.env.INCO_PROGRAM_ID || "GvoS27ShvsjMoWumJnHnuLbCZpHSS8k36uJFzuctvQtU",
    serverPrivateKey: process.env.INCO_SERVER_PRIVATE_KEY || "",
  },
  zk: {
    verifierProgramId: process.env.ZK_VERIFIER_PROGRAM_ID || "",
    merkleDepth: parseInt(process.env.ZK_MERKLE_DEPTH || "16", 10),
    ciphertextLength: parseInt(process.env.ZK_CIPHERTEXT_LENGTH || "114", 10),
    proofLength: parseInt(process.env.ZK_PROOF_LENGTH || "388", 10),
    publicWitnessLength: parseInt(process.env.ZK_PUBLIC_WITNESS_LENGTH || "108", 10),
  },
  privacyCash: {
    programId: process.env.PRIVACY_CASH_PROGRAM_ID || "9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD",
    relayerUrl: process.env.PRIVACY_CASH_RELAYER_URL || "https://api3.privacycash.org",
    feeRecipient: process.env.PRIVACY_CASH_FEE_RECIPIENT || "AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM",
    altAddress: process.env.PRIVACY_CASH_ALT_ADDRESS || "HEN49U2ySJ85Vc78qprSW9y6mFDhs1NczRxyppNHjofe",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "chameo-dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  identity: {
    salt: process.env.IDENTITY_SALT || "chameo-dev-salt",
  },
  wallet: {
    encryptionKey: process.env.WALLET_ENCRYPTION_KEY || "",
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.RESEND_FROM || "Chameo <onboarding@resend.dev>",
    fromClaims:
      process.env.RESEND_FROM_CLAIMS ||
      process.env.RESEND_FROM ||
      "Chameo <onboarding@resend.dev>",
    fromAuth:
      process.env.RESEND_FROM_AUTH ||
      process.env.RESEND_FROM ||
      "Chameo <onboarding@resend.dev>",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    folder: process.env.CLOUDINARY_FOLDER || "chameo/campaigns",
  },
  range: {
    apiKey: process.env.RANGE_API_KEY || "",
  },
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      redirectUri: process.env.TWITTER_REDIRECT_URI || "",
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      redirectUri: process.env.DISCORD_REDIRECT_URI || "",
    },
    telegram: {
      botId: process.env.TELEGRAM_BOT_ID || "",
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  voting: {
    disputeWindowSeconds: parseInt(process.env.DISPUTE_WINDOW_SECONDS || "172800", 10),
    schedulerIntervalMs: parseInt(process.env.DISPUTE_SCHEDULER_INTERVAL_MS || "60000", 10),
  },
  funding: {
    sweepIntervalMs: parseInt(process.env.FUNDING_SWEEP_INTERVAL_MS || "10000", 10),
    sweepCooldownMs: parseInt(process.env.FUNDING_SWEEP_COOLDOWN_MS || "60000", 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: process.env.CORS_CREDENTIALS === "true",
  },
};

export function validateEnv(): void {
  if (env.nodeEnv === "production") {
    if (env.identity.salt === "chameo-dev-salt") throw new Error("IDENTITY_SALT required in production");
    if (env.jwt.secret === "chameo-dev-secret") throw new Error("JWT_SECRET required in production");
    if (!env.wallet.encryptionKey) throw new Error("WALLET_ENCRYPTION_KEY required in production");
  }
}
