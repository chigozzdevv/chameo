import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import BN from "bn.js";
import { WasmFactory } from "@lightprotocol/hasher.rs";
import { getMerkleProof } from "./merkle";

const CHUNK_SIZE = 16;
const SECRET_LENGTH = 32;
const CIPHERTEXT_FIELDS = 8;

let hasherPromise: ReturnType<typeof WasmFactory.getInstance> | null = null;
let proofQueue: Promise<void> = Promise.resolve();

async function getHasher() {
  if (!hasherPromise) {
    hasherPromise = WasmFactory.getInstance();
  }
  return hasherPromise;
}

function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith(path.sep + "server")) {
    return path.resolve(cwd, "..");
  }
  return cwd;
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

async function poseidonHash(fields: Buffer[]): Promise<Buffer> {
  const hasher = await getHasher();
  const output = hasher.poseidonHash(fields.map((field) => new BN(field)));
  return Buffer.from(output);
}

function bytesToToml(bytes: Buffer): string {
  return `[${Array.from(bytes).join(", ")}]`;
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed: ${stderr.trim()}`));
      }
    });
  });
}

async function enqueueProof<T>(task: () => Promise<T>): Promise<T> {
  // Serialize proof generation to avoid concurrent writes to shared Noir artifacts.
  const next = proofQueue.then(task, task);
  proofQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function ensureArtifacts(noirDir: string, targetDir: string): Promise<void> {
  const compiled = path.join(targetDir, "vote_eligibility.json");
  const ccs = path.join(targetDir, "vote_eligibility.ccs");
  const pk = path.join(targetDir, "vote_eligibility.pk");

  try {
    await fs.access(compiled);
  } catch {
    await runCommand("nargo", ["compile"], noirDir);
  }

  try {
    await fs.access(ccs);
    await fs.access(pk);
  } catch {
    await runCommand("sunspot", ["compile", compiled], noirDir);
    await runCommand("sunspot", ["setup", ccs], noirDir);
  }
}

async function generateProof(noirDir: string): Promise<{ proof: string; publicWitness: string }> {
  const targetDir = path.join(noirDir, "target");
  const proofPath = path.join(targetDir, "vote_eligibility.proof");
  const witnessPath = path.join(targetDir, "vote_eligibility.gz");
  const compiled = path.join(targetDir, "vote_eligibility.json");
  const ccs = path.join(targetDir, "vote_eligibility.ccs");
  const pk = path.join(targetDir, "vote_eligibility.pk");
  const pw = path.join(targetDir, "vote_eligibility.pw");

  await runCommand("nargo", ["execute"], noirDir);
  await runCommand("sunspot", ["prove", compiled, witnessPath, ccs, pk], noirDir);

  const proof = await fs.readFile(proofPath);
  const publicWitness = await fs.readFile(pw);
  return { proof: proof.toString("base64"), publicWitness: publicWitness.toString("base64") };
}

async function writeProverToml(
  noirDir: string,
  params: {
    leaf: Buffer;
    siblings: Buffer[];
    pathBits: number[];
    secret: Buffer;
    ciphertext: Buffer;
    merkleRoot: string;
    nullifier: string;
    commitment: string;
  }
): Promise<void> {
  const siblingsToml = params.siblings.map(bytesToToml).join(",\n  ");
  const contents = `leaf = ${bytesToToml(params.leaf)}

siblings = [
  ${siblingsToml}
]

path_bits = [${params.pathBits.join(", ")}]

secret = ${bytesToToml(params.secret)}

ciphertext = ${bytesToToml(params.ciphertext)}

merkle_root = "${params.merkleRoot}"
nullifier = "${params.nullifier}"
commitment = "${params.commitment}"
`;
  await fs.writeFile(path.join(noirDir, "Prover.toml"), contents);
}

export async function buildVoteProof(params: {
  leafHexes: string[];
  identityHash: string;
  ciphertextHex: string;
  merkleDepth: number;
}): Promise<{ proof: string; publicWitness: string; nullifier: string }> {
  const projectRoot = resolveProjectRoot();
  const noirDir = path.join(projectRoot, "zk", "noir", "vote_eligibility");
  const targetDir = path.join(noirDir, "target");

  const identity = Buffer.from(params.identityHash, "hex");
  if (identity.length !== SECRET_LENGTH) {
    throw new Error("identityHash must be 32 bytes");
  }
  const ciphertext = Buffer.from(params.ciphertextHex, "hex");
  if (!ciphertext.length) {
    throw new Error("ciphertext required");
  }

  const proofData = await getMerkleProof(params.leafHexes, params.identityHash, params.merkleDepth);
  const secret = identity;
  const secretChunks = chunkBytes(secret, CHUNK_SIZE, 2);
  // Nullifier is Poseidon(secret chunks); commitment is Poseidon(ciphertext chunks).
  const nullifierBuf = await poseidonHash(secretChunks);
  const ciphertextChunks = chunkBytes(ciphertext, CHUNK_SIZE, CIPHERTEXT_FIELDS);
  const commitmentBuf = await poseidonHash(ciphertextChunks);
  const merkleRootDec = new BN(proofData.root).toString(10);
  const nullifierDec = new BN(nullifierBuf).toString(10);
  const commitmentDec = new BN(commitmentBuf).toString(10);

  await ensureArtifacts(noirDir, targetDir);

  return enqueueProof(async () => {
    await writeProverToml(noirDir, {
      leaf: proofData.leaf,
      siblings: proofData.siblings,
      pathBits: proofData.pathBits,
      secret,
      ciphertext,
      merkleRoot: merkleRootDec,
      nullifier: nullifierDec,
      commitment: commitmentDec,
    });

    const { proof, publicWitness } = await generateProof(noirDir);
    return { proof, publicWitness, nullifier: nullifierBuf.toString("hex") };
  });
}
