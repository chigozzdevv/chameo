import { env } from "@/config";
import type { TreeState, MerkleProof, RelayerConfig } from "./types";

const RELAYER_URL = env.privacyCash.relayerUrl;

export async function fetchTreeState(tokenName?: string): Promise<TreeState> {
  const url = tokenName ? `${RELAYER_URL}/merkle/root?token=${tokenName}` : `${RELAYER_URL}/merkle/root`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tree state: ${res.status}`);
  return res.json();
}

export async function fetchMerkleProof(commitment: string, tokenName?: string): Promise<MerkleProof> {
  const url = tokenName ? `${RELAYER_URL}/merkle/proof/${commitment}?token=${tokenName}` : `${RELAYER_URL}/merkle/proof/${commitment}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch merkle proof: ${res.status}`);
  return res.json();
}

export async function fetchRelayerConfig(): Promise<RelayerConfig> {
  const res = await fetch(`${RELAYER_URL}/config`);
  if (!res.ok) throw new Error(`Failed to fetch relayer config: ${res.status}`);
  return res.json();
}

export async function fetchEncryptedUtxos(
  start: number,
  end: number
): Promise<{ encrypted_outputs: string[]; hasMore: boolean; total: number }> {
  const res = await fetch(`${RELAYER_URL}/utxos/range?start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`Failed to fetch utxos: ${res.status}`);
  return res.json();
}

export async function fetchUtxoIndices(encryptedOutputs: string[]): Promise<number[]> {
  const res = await fetch(`${RELAYER_URL}/utxos/indices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_outputs: encryptedOutputs }),
  });
  if (!res.ok) throw new Error(`Failed to fetch utxo indices: ${res.status}`);
  const data = await res.json();
  return data.indices;
}

export async function checkUtxoExists(encryptedOutput: string): Promise<boolean> {
  const res = await fetch(`${RELAYER_URL}/utxos/check/${encryptedOutput}`);
  if (!res.ok) return false;
  const data = await res.json();
  return data.exists;
}

export async function submitWithdraw(params: Record<string, unknown>): Promise<{ signature: string }> {
  const res = await fetch(`${RELAYER_URL}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Withdraw failed: ${error}`);
  }
  return res.json();
}

export async function submitDeposit(signedTransaction: string, senderAddress: string): Promise<{ signature: string }> {
  const res = await fetch(`${RELAYER_URL}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTransaction, senderAddress }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Deposit failed: ${error}`);
  }
  return res.json();
}
