import { connectDb, disconnectDb, connection } from "../config";
import { campaignsCollection } from "../modules/campaign/campaign.model";
import { getCampaignPrivateBalance, getCampaignWalletKeys, withdrawFromCampaign } from "../modules/campaign/wallet.service";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const CONFIRM_TIMEOUT_MS = 15_000;
const PRIVACY_TIMEOUT_MS = 20_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function sweepOnChain(keypair: Keypair, destination: PublicKey) {
  const balance = await connection.getBalance(keypair.publicKey);
  if (balance <= 0) {
    return { skipped: true, balance };
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const feeMessage = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: destination,
        lamports: 1,
      }),
    ],
  }).compileToV0Message();

  const feeResult = await connection.getFeeForMessage(feeMessage);
  const fee = feeResult?.value ?? 0;
  const lamportsToSend = balance - fee;

  if (lamportsToSend <= 0) {
    return { skipped: false, balance, error: `Insufficient balance after fee (${fee}).` };
  }

  const message = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: destination,
        lamports: lamportsToSend,
      }),
    ],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([keypair]);

  const signature = await connection.sendTransaction(tx);
  const confirmation = await Promise.race([
    connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed"),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), CONFIRM_TIMEOUT_MS)),
  ]);

  if (!confirmation) {
    return { skipped: false, balance, signature, warning: "Confirmation pending" };
  }
  if ("value" in confirmation && confirmation.value?.err) {
    return { skipped: false, balance, signature, error: JSON.stringify(confirmation.value.err) };
  }

  return { skipped: false, balance, signature, sent: lamportsToSend, fee };
}

async function sweepPrivacyCash(campaignId: string, destination: PublicKey) {
  const balance = await withTimeout(getCampaignPrivateBalance(campaignId), PRIVACY_TIMEOUT_MS, "Privacy balance");
  if (balance <= 0) {
    return { skipped: true, balance };
  }
  const result = await withTimeout(
    withdrawFromCampaign(campaignId, balance, destination.toBase58()),
    PRIVACY_TIMEOUT_MS,
    "Privacy withdraw"
  );
  return { skipped: false, balance, signature: result.signature, sent: result.amount };
}

async function main() {
  const destination = process.argv[2];
  const forceDelete = process.argv.includes("--force-delete");

  if (!destination) {
    console.error("Usage: tsx src/scripts/sweep-and-delete-campaigns.ts <destination> [--force-delete]");
    process.exit(1);
  }

  await connectDb();

  try {
    const destPk = new PublicKey(destination);
    const campaigns = await campaignsCollection()
      .find({}, { projection: { _id: 0, id: 1, name: 1, status: 1 } })
      .toArray();

    if (campaigns.length === 0) {
      console.log("No campaigns found.");
      return;
    }

    const failures: Array<{ id: string; reason: string }> = [];

    for (const campaign of campaigns) {
      console.log(`\nCampaign ${campaign.id} (${campaign.name || "unnamed"})`);

      let walletKeys;
      try {
        walletKeys = await getCampaignWalletKeys(campaign.id);
      } catch (error) {
        failures.push({ id: campaign.id, reason: `Wallet keys not found: ${String(error)}` });
        console.error("  Wallet keys not found.");
        continue;
      }

      const keypair = Keypair.fromSecretKey(Buffer.from(walletKeys.secretKey, "base64"));

      let privateOk = true;
      try {
        const result = await sweepPrivacyCash(campaign.id, destPk);
        if (result.skipped) {
          console.log(`  Privacy Cash balance: ${result.balance} (no sweep)`);
        } else {
          console.log(`  Privacy Cash sweep: ${result.signature} (sent ${result.sent})`);
        }
      } catch (error) {
        privateOk = false;
        failures.push({ id: campaign.id, reason: `Privacy Cash sweep failed: ${String(error)}` });
        console.error(`  Privacy Cash sweep failed: ${String(error)}`);
      }

      let onChainOk = true;
      try {
        const result = await sweepOnChain(keypair, destPk);
        if (result.skipped) {
          console.log(`  On-chain balance: ${result.balance} (no sweep)`);
        } else if (result.error) {
          onChainOk = false;
          failures.push({ id: campaign.id, reason: `On-chain sweep failed: ${result.error}` });
          console.error(`  On-chain sweep failed: ${result.error}`);
        } else {
          const warning = result.warning ? ` (${result.warning})` : "";
          console.log(`  On-chain sweep: ${result.signature} (sent ${result.sent}, fee ${result.fee})${warning}`);
        }
      } catch (error) {
        onChainOk = false;
        failures.push({ id: campaign.id, reason: `On-chain sweep failed: ${String(error)}` });
        console.error(`  On-chain sweep failed: ${String(error)}`);
      }

      if (!forceDelete && (!privateOk || !onChainOk)) {
        console.log("  Skipping delete due to sweep errors.");
        continue;
      }

      await campaignsCollection().deleteOne({ id: campaign.id });
      console.log("  Campaign deleted.");
    }

    if (failures.length > 0) {
      console.log("\nSweep completed with errors:");
      for (const failure of failures) {
        console.log(`- ${failure.id}: ${failure.reason}`);
      }
      if (!forceDelete) {
        console.log("\nSome campaigns were not deleted. Re-run with --force-delete to delete anyway.");
      }
    } else {
      console.log("\nAll campaigns swept and deleted.");
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
