import { connectDb, disconnectDb, connection } from "../config";
import { getCampaignWalletKeys } from "../modules/campaign/wallet.service";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

async function main() {
  const campaignId = process.argv[2];
  const destination = process.argv[3];

  if (!campaignId || !destination) {
    console.error("Usage: tsx src/scripts/sweep-campaign-onchain.ts <campaignId> <destination>");
    process.exit(1);
  }

  await connectDb();
  try {
    const keys = await getCampaignWalletKeys(campaignId);
    const keypair = Keypair.fromSecretKey(Buffer.from(keys.secretKey, "base64"));
    const destinationPk = new PublicKey(destination);
    const balance = await connection.getBalance(keypair.publicKey);

    console.log(`Campaign wallet: ${keypair.publicKey.toBase58()}`);
    console.log(`Destination: ${destinationPk.toBase58()}`);
    console.log(`On-chain balance: ${balance} lamports`);

    if (balance <= 0) {
      console.log("No on-chain balance to sweep.");
      return;
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const feeMessage = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: destinationPk,
          lamports: 1,
        }),
      ],
    }).compileToV0Message();
    const feeResult = await connection.getFeeForMessage(feeMessage);
    const fee = feeResult?.value ?? 0;
    const lamportsToSend = balance - fee;

    if (lamportsToSend <= 0) {
      console.error(`Insufficient balance after fees. Balance ${balance}, fee ${fee}.`);
      return;
    }

    const message = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: destinationPk,
          lamports: lamportsToSend,
        }),
      ],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([keypair]);

    const signature = await connection.sendTransaction(tx);
    console.log(`Sweep submitted: ${signature}`);
    console.log(`Sent ${lamportsToSend} lamports (fee ${fee}).`);

    const confirmation = await Promise.race([
      connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed"),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);

    if (!confirmation) {
      console.log("Confirmation pending. Check the signature later.");
      return;
    }

    if ("value" in confirmation && confirmation.value?.err) {
      console.error("Transaction failed:", confirmation.value.err);
      return;
    }

    console.log("Sweep confirmed.");
  } finally {
    await disconnectDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
