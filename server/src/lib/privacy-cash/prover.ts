import path from "path";
import BN from "bn.js";
import { groth16 } from "snarkjs";
import { utils as ffUtils } from "ffjavascript";
import { PublicKey } from "@solana/web3.js";
import { env } from "@/config";
import type { ProofResult } from "./types";
import { FIELD_SIZE, TRANSACT_IX_DISCRIMINATOR } from "./constants";

const CIRCUIT_PATH = path.join(process.cwd(), "circuit", "transaction2");
const PROGRAM_ID = new PublicKey(env.privacyCash.programId);

export async function generateProof(input: Record<string, unknown>): Promise<ProofResult> {
  try {
    const { proof, publicSignals } = await (groth16 as any).fullProve(
      ffUtils.stringifyBigInts(input),
      `${CIRCUIT_PATH}.wasm`,
      `${CIRCUIT_PATH}.zkey`
    );

    // Convert proof elements to little-endian byte arrays for Solana
    const p = JSON.parse(JSON.stringify(proof));
    for (const k of ["pi_a", "pi_c"]) {
      for (const j in p[k]) {
        p[k][j] = Array.from(ffUtils.leInt2Buff(ffUtils.unstringifyBigInts(p[k][j]), 32)).reverse();
      }
    }
    for (const j in p.pi_b) {
      for (const z in p.pi_b[j]) {
        p.pi_b[j][z] = Array.from(ffUtils.leInt2Buff(ffUtils.unstringifyBigInts(p.pi_b[j][z]), 32));
      }
    }

    const signals = publicSignals.map((s: string) =>
      (Array.from(ffUtils.leInt2Buff(ffUtils.unstringifyBigInts(s), 32)) as number[]).reverse()
    );

    return {
      proofA: [p.pi_a[0], p.pi_a[1]].flat(),
      proofB: [p.pi_b[0].flat().reverse(), p.pi_b[1].flat().reverse()].flat(),
      proofC: [p.pi_c[0], p.pi_c[1]].flat(),
      root: signals[0],
      publicAmount: signals[1],
      extDataHash: signals[2],
      inputNullifiers: [signals[3], signals[4]],
      outputCommitments: [signals[5], signals[6]],
    };
  } catch (error: any) {
    throw new Error(`Proof generation failed: ${error.message}`);
  }
}

export function serializeProof(proof: ProofResult, extAmount: number, fee: number, enc1: Buffer, enc2: Buffer): Buffer {
  return Buffer.concat([
    TRANSACT_IX_DISCRIMINATOR,
    Buffer.from(proof.proofA),
    Buffer.from(proof.proofB),
    Buffer.from(proof.proofC),
    Buffer.from(proof.root),
    Buffer.from(proof.publicAmount),
    Buffer.from(proof.extDataHash),
    Buffer.from(proof.inputNullifiers[0]),
    Buffer.from(proof.inputNullifiers[1]),
    Buffer.from(proof.outputCommitments[0]),
    Buffer.from(proof.outputCommitments[1]),
    Buffer.from(new BN(extAmount).toTwos(64).toArray("le", 8)),
    Buffer.from(new BN(fee).toArray("le", 8)),
    Buffer.from(new BN(enc1.length).toArray("le", 4)),
    enc1,
    Buffer.from(new BN(enc2.length).toArray("le", 4)),
    enc2,
  ]);
}

export function calculatePublicAmount(extAmount: number, fee: number): BN {
  return new BN(extAmount).sub(new BN(fee)).add(FIELD_SIZE).mod(FIELD_SIZE);
}

export function findNullifierPDAs(nullifiers: number[][]) {
  const [n0] = PublicKey.findProgramAddressSync([Buffer.from("nullifier0"), Buffer.from(nullifiers[0])], PROGRAM_ID);
  const [n1] = PublicKey.findProgramAddressSync([Buffer.from("nullifier1"), Buffer.from(nullifiers[1])], PROGRAM_ID);
  const [n2] = PublicKey.findProgramAddressSync([Buffer.from("nullifier0"), Buffer.from(nullifiers[1])], PROGRAM_ID);
  const [n3] = PublicKey.findProgramAddressSync([Buffer.from("nullifier1"), Buffer.from(nullifiers[0])], PROGRAM_ID);
  return { n0, n1, n2, n3 };
}

export function getProgramPDAs() {
  const [tree] = PublicKey.findProgramAddressSync([Buffer.from("merkle_tree")], PROGRAM_ID);
  const [token] = PublicKey.findProgramAddressSync([Buffer.from("tree_token")], PROGRAM_ID);
  const [global] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  return { tree, token, global };
}
