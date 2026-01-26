import BN from "bn.js";
import { WasmFactory } from "@lightprotocol/hasher.rs";

const ZERO = Buffer.alloc(32, 0);
const CHUNK_SIZE = 16;

let hasherPromise: ReturnType<typeof WasmFactory.getInstance> | null = null;

async function getHasher() {
  if (!hasherPromise) {
    hasherPromise = WasmFactory.getInstance();
  }
  return hasherPromise;
}

function ensureDepth(depth: number): number {
  if (!Number.isInteger(depth) || depth < 1 || depth > 30) {
    throw new Error("Invalid merkle depth");
  }
  return depth;
}

function normalizeIdentity(hex: string, label: string): Buffer {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error(`${label} must be hex`);
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(`${label} must be 32 bytes`);
  }
  return buf;
}

function chunkBytes(bytes: Buffer, chunkSize: number, totalChunks: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, bytes.length);
    const chunk = Buffer.alloc(chunkSize);
    if (start < bytes.length) {
      bytes.copy(chunk, 0, start, end);
    }
    chunks.push(chunk);
  }
  return chunks;
}

async function poseidonHashFields(fields: BN[]): Promise<Buffer> {
  const hasher = await getHasher();
  const output = hasher.poseidonHash(fields);
  return Buffer.from(output);
}

async function hashPair(left: Buffer, right: Buffer): Promise<Buffer> {
  return poseidonHashFields([new BN(left), new BN(right)]);
}

async function hashIdentityLeaf(identity: Buffer): Promise<Buffer> {
  // Identity leaves are Poseidon hashes of two 16-byte chunks.
  const chunks = chunkBytes(identity, CHUNK_SIZE, 2);
  return poseidonHashFields(chunks.map((chunk) => new BN(chunk)));
}

async function buildLayers(leaves: Buffer[], depth: number): Promise<Buffer[][]> {
  const maxLeaves = 2 ** depth;
  if (leaves.length > maxLeaves) {
    throw new Error("Too many leaves for merkle depth");
  }
  // Pad to a full tree so Merkle roots are deterministic across clients.
  const padded = leaves.slice();
  while (padded.length < maxLeaves) {
    padded.push(ZERO);
  }

  const layers: Buffer[][] = [padded];
  for (let level = 0; level < depth; level += 1) {
    const current = layers[level];
    const next: Buffer[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(await hashPair(current[i], current[i + 1]));
    }
    layers.push(next);
  }
  return layers;
}

export async function buildMerkleRoot(leafHexes: string[], depth: number): Promise<Buffer> {
  const normalizedDepth = ensureDepth(depth);
  const leaves = await Promise.all(leafHexes.map(async (leaf, index) => hashIdentityLeaf(normalizeIdentity(leaf, `leaf ${index}`))));
  const layers = await buildLayers(leaves, normalizedDepth);
  return layers[layers.length - 1][0];
}

export async function getMerkleProof(
  leafHexes: string[],
  targetLeafHex: string,
  depth: number
): Promise<{
  root: Buffer;
  leaf: Buffer;
  siblings: Buffer[];
  pathBits: number[];
  index: number;
}> {
  const normalizedDepth = ensureDepth(depth);
  const normalizedLeaves = leafHexes.map((leaf, index) => normalizeIdentity(leaf, `leaf ${index}`));
  const targetLeaf = normalizeIdentity(targetLeafHex, "targetLeaf");
  const targetIndex = normalizedLeaves.findIndex((leaf) => leaf.equals(targetLeaf));
  if (targetIndex === -1) {
    throw new Error("Leaf not found");
  }

  const leaves = await Promise.all(normalizedLeaves.map((leaf) => hashIdentityLeaf(leaf)));
  const layers = await buildLayers(leaves, normalizedDepth);
  let index = targetIndex;
  const siblings: Buffer[] = [];
  const pathBits: number[] = [];

  for (let level = 0; level < normalizedDepth; level += 1) {
    const layer = layers[level];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    siblings.push(layer[siblingIndex]);
    // pathBits uses 1 for right nodes, 0 for left nodes.
    pathBits.push(isRight ? 1 : 0);
    index = Math.floor(index / 2);
  }

  return {
    root: layers[layers.length - 1][0],
    leaf: targetLeaf,
    siblings,
    pathBits,
    index: targetIndex,
  };
}
