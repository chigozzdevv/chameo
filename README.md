# chameo.cash

Privacy-first payout infrastructure on Solana.

## Overview

chameo.cash enables organizations, DAOs, and platforms to distribute funds without revealing host or claimant wallet relationships. Built with Privacy Cash for unlinkable transfers.

## Privacy Model

| What | Visible On-Chain? |
|------|-------------------|
| Host wallet | ❌ No - funds via Privacy Cash |
| Campaign wallet | ✅ Yes - receives from Privacy Cash |
| Claimant wallet | ✅ Yes - receives from Privacy Cash |
| Link: Host → Campaign | ❌ No - Privacy Cash breaks the link |
| Link: Campaign → Claimant | ❌ No - Privacy Cash breaks the link |
| Eligible identities | ❌ No - stored as hashes |

## How It Works

```
┌──────────┐                          ┌─────────────┐
│   HOST   │ ───(1) deposit─────────► │   PRIVACY   │
│  WALLET  │                          │    CASH     │
│          │ ◄──(2) withdraw to───────│    POOL     │
└──────────┘     campaign wallet      │             │
                      │               │             │
                      ▼               │             │
              ┌─────────────┐         │             │
              │  CAMPAIGN   │         │             │
              │   WALLET    │──(3) deposit to PC───►│
              │ (per camp)  │                       │
              └─────────────┘         │             │
                                      │             │
              ┌─────────────┐         │             │
              │   SERVER    │◄──(4) withdraw───────┤
              │             │     to claimant      │
              └─────────────┘         │             │
                                      └──────┬──────┘
                                             │
                                             ▼
                                      ┌──────────┐
                                      │ CLAIMANT │
                                      │  WALLET  │
                                      └──────────┘
```

## Project Structure

```
chameo/
├── sdk/                          # TypeScript SDK
│   └── src/
│       ├── types.ts
│       ├── chameo.ts
│       └── range.ts
└── server/                       # Backend API
    └── src/
        ├── index.ts              # Entry point
        ├── config.ts             # Configuration
        ├── types.d.ts            # Type declarations
        ├── db/
        │   ├── index.ts
        │   └── db.service.ts     # MongoDB connection
        ├── zk/
        │   ├── index.ts
        │   ├── zk.constants.ts
        │   ├── zk.types.ts
        │   ├── zk.crypto.ts      # UTXO encryption/decryption
        │   ├── zk.prover.ts      # ZK proof generation
        │   └── zk.utils.ts       # PDAs, ext data hash
        ├── privacy-cash/
        │   ├── index.ts
        │   └── privacy-cash.service.ts
        ├── campaign/
        │   ├── index.ts
        │   ├── campaign.types.ts
        │   ├── campaign.service.ts
        │   └── campaign.routes.ts
        ├── claim/
        │   ├── index.ts
        │   ├── claim.types.ts
        │   ├── claim.verification.ts
        │   ├── claim.notification.ts
        │   ├── claim.service.ts
        │   ├── claim.routes.ts
        │   └── handlers/
        │       ├── index.ts
        │       ├── handler.types.ts
        │       ├── github.handler.ts
        │       ├── twitter.handler.ts
        │       └── discord.handler.ts
        └── common/
            ├── index.ts
            ├── solana.service.ts
            ├── crypto.service.ts
            ├── compliance.service.ts
            └── messaging.service.ts
    └── circuit/                  # ZK circuit files
        ├── transaction2.wasm
        └── transaction2.zkey
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB

### Installation

```bash
npm install
```

### Environment Variables

Create `.env` in `server/`:

```env
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=chameo

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Identity hashing salt (REQUIRED in production)
IDENTITY_SALT=your-secure-random-salt

# Email notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=noreply@chameo.cash

# SMS notifications (optional)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Compliance checks (optional)
RANGE_API_KEY=your_range_api_key

# OAuth (for social verification)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_REDIRECT_URI=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
```

### Run Server

```bash
cd server
npm run dev
```

## API Endpoints

### Campaigns

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaign` | POST | Create campaign |
| `/api/campaign/:id` | GET | Get campaign info |
| `/api/campaign/:id/funding-address` | GET | Get funding wallet address |
| `/api/campaign/:id/check-funding` | POST | Check Privacy Cash balance |
| `/api/campaign/:id/notify` | POST | Send claim notifications |

### Claims

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claim/verify/email` | POST | Send email OTP |
| `/api/claim/verify/phone` | POST | Send phone OTP |
| `/api/claim/verify/otp` | POST | Verify OTP |
| `/api/claim/verify/magic-link` | POST | Verify magic link |
| `/api/claim/verify/social/:provider/url` | GET | Get OAuth URL |
| `/api/claim/verify/social/:provider/callback` | POST | OAuth callback |
| `/api/claim/process` | POST | Process claim |

## SDK Usage

```typescript
import { createChameoClient } from "@chameo/sdk";

const client = createChameoClient("https://api.chameo.cash");

// 1. Host creates campaign
const campaign = await client.createCampaign({
  hostIdentifier: "host@example.com",
  authMethod: "email",
  payoutAmount: 100000000,
  maxClaims: 100,
  expiresAt: Math.floor(Date.now() / 1000) + 86400 * 7,
  recipients: ["alice@example.com", "bob@example.com"],
  requireCompliance: false,
});

// 2. Host funds via Privacy Cash (external)
// 3. Check funding
const funding = await client.checkFunding(campaign.campaignId);

// 4. Notify recipients
await client.notifyRecipients(campaign.campaignId, [...], "email", "https://claim.chameo.cash");

// 5. Claimant verifies and claims
await client.sendEmailOtp("alice@example.com", campaign.campaignId);
const verification = await client.verifyOtp({ ... });
const claim = await client.processClaim(campaign.campaignId, verification.identityHash, verification.token, "WALLET");
```

## Security

- Host/claimant identities stored as SHA-256 hashes
- OTPs: 6 digits, 10 min expiry, max 5 attempts
- Magic links: 24h expiry, single use
- Privacy Cash breaks ALL wallet linkability
- ZK proofs generated server-side
- Optional Range API compliance checks

## License

MIT
