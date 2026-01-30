# chameo.cash

Video Demo: https://youtu.be/JZMt14qAP-w

chameo.cash is a privacy-first, compliance-gated payout platform on Solana. Teams can pay anyone by email or social handle (X, Telegram, Discord) using direct payouts or escrowed bounties/grants. Claimants verify eligibility and claim with their own wallet without revealing wallets to each other, while on-chain links stay broken.

Payouts route through Privacy Cash to break funding and claim linkability. Dispute votes and analytics are encrypted with Inco Lightning. Aztec Noir proofs (via a relayer) prove eligibility from hashed identities and enforce one-vote nullifiers during disputes.

## Stack

- Privacy Cash: unlinkable deposits/withdrawals for funding + payouts. Used in `server/src/lib/privacy-cash/` and `server/src/modules/campaign/wallet.service.ts`.
- Inco Lightning: encrypted on-chain analytics + dispute vote totals. On-chain CPI in `contracts/programs/chameo-privacy/src/{voting,analytics}.rs`; server client in `server/src/lib/inco/`.
- Aztec Noir + Sunspot: ZK eligibility (Merkle membership + nullifier + commitment). Circuit in `zk/noir/vote_eligibility/`; proof generation in `server/src/lib/zk/vote-prover.ts`; verifier invoked from `contracts/programs/chameo-privacy/src/voting.rs`.
- Range: compliance screening for claim wallets. Logic in `server/src/modules/compliance/compliance.service.ts`, enforced in `server/src/modules/claim/claim.service.ts`.
- Helius RPC: Solana RPC for mainnet/devnet in `server/src/config/solana.ts` via `SOLANA_RPC_URL` and `SOLANA_DEVNET_RPC_URL`.

## Privacy Model

<table>
  <thead>
    <tr>
      <th>What</th>
      <th>Visible On-Chain?</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Host wallet</td>
      <td>No</td>
      <td>Funds routed through Privacy Cash</td>
    </tr>
    <tr>
      <td>Campaign wallet</td>
      <td>Yes</td>
      <td>Receives from Privacy Cash, then deposits into the private pool</td>
    </tr>
    <tr>
      <td>Claimant wallet</td>
      <td>Yes</td>
      <td>Receives withdrawals from Privacy Cash</td>
    </tr>
    <tr>
      <td>Link: Host -> Campaign</td>
      <td>No</td>
      <td>Privacy Cash breaks linkability</td>
    </tr>
    <tr>
      <td>Link: Campaign -> Claimant</td>
      <td>No</td>
      <td>Privacy Cash breaks linkability</td>
    </tr>
    <tr>
      <td>Eligible identities</td>
      <td>No</td>
      <td>Stored as salted SHA-256 hashes</td>
    </tr>
    <tr>
      <td>Votes</td>
      <td>No</td>
      <td>Encrypted via Inco Lightning</td>
    </tr>
    <tr>
      <td>Voter wallet in ZK vote</td>
      <td>No</td>
      <td>Relayer pays and signs</td>
    </tr>
  </tbody>
</table>

## Architecture

- `server/` runs the API, Privacy Cash integration, ZK proof generation, and relayered voting.
- `contracts/` is the Anchor program for encrypted voting + analytics.
- `zk/` holds the Noir circuit and verifier artifacts.
- `client/` contains the UI for campaign creation, voting, and claims.

## Project Structure

```
chameo/
├── client/                         # Frontend helpers
├── contracts/                      # Anchor program (Inco)
│   └── programs/
│       └── chameo-privacy/
│           ├── src/
│           │   ├── voting.rs
│           │   └── analytics.rs
├── server/                         # API + Privacy Cash + ZK proof gen
│   └── src/
│       ├── config/
│       ├── lib/
│       │   ├── inco/
│       │   ├── privacy-cash/
│       │   └── zk/
│       ├── modules/
│       │   ├── analytics/
│       │   ├── auth/
│       │   ├── campaign/
│       │   ├── claim/
│       │   ├── compliance/
│       │   └── voting/
│       └── shared/
└── zk/
    └── noir/
        └── vote_eligibility/
```

## Flows

### Payout (Privacy Cash)
1. Host deposits into Privacy Cash.
2. Campaign wallet withdraws from Privacy Cash to receive funds.
3. Campaign wallet deposits into Privacy Cash to create the private payout pool.
4. Claims are screened by Range and withdraw from Privacy Cash to claimant wallets.

### Dispute Voting (Inco + Noir)
1. Server builds a Poseidon Merkle root of eligible identities.
2. Voter proves membership + nullifier + ciphertext commitment via Noir.
3. `cast_vote_zk` verifies the proof on-chain and updates encrypted vote totals.
4. Server decrypts totals with Inco attested decrypt for final outcome.

Note: dispute resolution requires >=50% turnout of eligible identities unless forced by the server.

### Analytics (Inco)
1. Server writes encrypted analytics counters on-chain.
2. Creator is granted decrypt access to read totals.

Note: On-chain analytics track `view`, `link-click`, `claim-attempt`, `claim-success`, `claim-failure`, and `vote` via `server/src/modules/analytics/analytics.service.ts`.

## Key Files

- Privacy Cash: `server/src/lib/privacy-cash/`, `server/src/modules/campaign/wallet.service.ts`
- Inco program: `contracts/programs/chameo-privacy/src/voting.rs`, `contracts/programs/chameo-privacy/src/analytics.rs`
- Inco server client: `server/src/lib/inco/client.ts`
- Range compliance: `server/src/modules/compliance/compliance.service.ts`, `server/src/modules/claim/claim.service.ts`
- ZK circuit: `zk/noir/vote_eligibility/src/main.nr`
- Merkle builder: `server/src/lib/zk/merkle.ts`
- ZK vote test: `contracts/tests/chameo.test.ts`

## Code Snippets

Privacy Cash wallet usage (`server/src/modules/campaign/wallet.service.ts`):
```ts
export async function depositToCampaign(campaignId: string, amount: number): Promise<{ signature: string }> {
  const keys = await getCampaignWalletKeys(campaignId);
  return deposit(keys, amount);
}

export async function withdrawFromCampaign(
  campaignId: string,
  amount: number,
  recipient: string
): Promise<{ signature: string; amount: number }> {
  const keys = await getCampaignWalletKeys(campaignId);
  return withdraw(keys, amount, recipient);
}
```

Range compliance gate (`server/src/modules/claim/claim.service.ts`):
```ts
const compliance = await checkWalletCompliance(walletAddress);
if (!compliance.isCompliant) {
  await claimsCollection().deleteOne({ campaignId, identityHash });
  throw new BadRequestError(compliance.blockedReason || "Wallet failed compliance check");
}
```

Inco ZK vote verification (`contracts/programs/chameo-privacy/src/voting.rs`):
```rust
require!(proof.len() == ZK_PROOF_LEN, ErrorCode::InvalidProofLength);
require!(public_witness.len() == ZK_PUBLIC_WITNESS_LEN, ErrorCode::InvalidPublicWitnessLength);

let commitment_bytes = poseidon_hash_bytes(&encrypted_vote)?;
require!(commitment_bytes.as_ref() == witness_commitment, ErrorCode::CommitmentMismatch);

let verify_ix = Instruction {
    program_id: ctx.accounts.zk_verifier_program.key(),
    accounts: vec![],
    data: verifier_data,
};
invoke(&verify_ix, &[])?;
```

Noir eligibility circuit (`zk/noir/vote_eligibility/src/main.nr`):
```rust
let leaf_fields = pack_bytes_16::<32, LEAF_FIELDS>(leaf);
let mut current = poseidon::bn254::hash_2(leaf_fields);
// Merkle path
current = hash_pair(left, right);

let secret_fields = pack_bytes_16::<SECRET_LEN, SECRET_FIELDS>(secret);
let nullifier_field = poseidon::bn254::hash_2(secret_fields);
assert(nullifier_field == nullifier);
```

Poseidon Merkle root builder (`server/src/lib/zk/merkle.ts`):
```ts
async function hashPair(left: Buffer, right: Buffer): Promise<Buffer> {
  return poseidonHashFields([new BN(left), new BN(right)]);
}

export async function buildMerkleRoot(leafHexes: string[], depth: number): Promise<Buffer> {
  const leaves = await Promise.all(leafHexes.map((leaf) => hashIdentityLeaf(normalizeIdentity(leaf, "leaf"))));
  const layers = await buildLayers(leaves, depth);
  return layers[layers.length - 1][0];
}
```

ZK vote anonymity check (`contracts/tests/chameo.test.ts`):
```ts
const rawKeys = message.getAccountKeys
  ? message.getAccountKeys().staticAccountKeys
  : message.accountKeys;
const accountKeys = rawKeys.map((key: PublicKey | string) => (typeof key === "string" ? key : key.toBase58()));
assert.ok(!accountKeys.includes(voterA.publicKey.toBase58()));
```

## Configuration

See `server/.env.example` for full list.

### Required for end-to-end flows
- `WALLET_ENCRYPTION_KEY`: 32-byte hex key used to encrypt campaign wallet keys (required even in dev).
- `RANGE_API_KEY`: compliance screening is enforced on every claim.
- `INCO_SERVER_PRIVATE_KEY`: base64 secret key for the relayer (Inco voting + analytics).

### Program IDs (Solana)
- Chameo Privacy (Anchor) program ID (`INCO_PROGRAM_ID`):
  - Devnet: `FsoGyYnvQDu5zXHmWHiyCxi7nWMr7RYxB1zGgz8ciJVM`
- ZK verifier program (`ZK_VERIFIER_PROGRAM_ID`): `5uFcw2nQiT2Tf7Q1zx8swugXE9rWvBQ7a3btea7qUy2d`
  - Update this after `sunspot deploy` using the pubkey from `zk/noir/vote_eligibility/target/vote_eligibility-keypair.json`.
- Inco Lightning program ID (fixed in code + on-chain): `5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj`
- Privacy Cash program ID (`PRIVACY_CASH_PROGRAM_ID`): `9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD`

### ZK params
- `ZK_MERKLE_DEPTH`, `ZK_CIPHERTEXT_LENGTH`, `ZK_PROOF_LENGTH`, `ZK_PUBLIC_WITNESS_LENGTH` must match the Noir constants in `zk/noir/vote_eligibility/src/main.nr`.

## Development

### Server
```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### Client
```bash
cd client
npm install
# If the API is not on the same origin, set NEXT_PUBLIC_API_BASE_URL in client/.env.local.
npm run dev
```

## Docker (server)

Builds the production server image and compiles Noir artifacts. The Next.js client runs separately.

```bash
docker build -t chameo-server .
docker run --rm -p 8080:8080 --env-file server/.env chameo-server
```

## Tests

```bash
cd contracts
npm test
```

The ZK vote test generates a Noir witness, creates a Sunspot proof, and calls `cast_vote_zk` against the deployed verifier program.

## License

MIT
