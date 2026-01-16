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

## Project Structure

```
chameo/
├── server/
│   └── src/
│       ├── index.ts              # Entry point
│       ├── app.ts                # Express app setup
│       ├── config/               # Configuration
│       │   ├── env.ts
│       │   ├── db.ts
│       │   └── solana.ts
│       ├── lib/                  # Shared libraries
│       │   ├── privacy-cash/     # Privacy Cash protocol
│       │   │   ├── client.ts     # High-level API
│       │   │   ├── crypto.ts     # UTXO encryption
│       │   │   ├── prover.ts     # ZK proof generation
│       │   │   └── relayer.ts    # Relayer API calls
│       │   ├── auth-providers/   # OAuth handlers
│       │   └── messaging/        # Email notifications
│       ├── modules/              # Feature modules
│       │   ├── auth/
│       │   ├── campaign/
│       │   ├── claim/
│       │   └── compliance/
│       └── shared/               # Shared utilities
│           ├── errors.ts
│           ├── logger.ts
│           ├── crypto.ts
│           ├── validation.ts
│           └── middleware/
│   └── circuit/                  # ZK circuit files
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (Atlas recommended)

### Installation

```bash
# Install dependencies
cd server
npm install

# Copy environment file
cp .env.example .env

# Configure environment variables (see below)

# Run development server
npm run dev
```

### Environment Variables

See `server/.env.example` for all configuration options.

Key variables:
- `MONGODB_URI` - MongoDB connection string (Atlas or local)
- `SOLANA_RPC_URL` - Solana RPC endpoint
- `JWT_SECRET` - JWT signing secret (required in production)
- `IDENTITY_SALT` - Identity hashing salt (required in production)
- `WALLET_ENCRYPTION_KEY` - Wallet encryption key (required in production)
- `RESEND_API_KEY` - Resend API key for emails
- `RESEND_FROM` - Email sender address
- `IDENTITY_SALT` - Identity hashing salt (required in production)

## API Endpoints

### Auth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create account |
| `/api/auth/login` | POST | Login |
| `/api/auth/me` | GET | Get current user |

### Campaigns

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaign` | POST | Create campaign |
| `/api/campaign` | GET | List user campaigns |
| `/api/campaign/:id` | GET | Get campaign info |
| `/api/campaign/:id/funding-address` | GET | Get funding wallet address |
| `/api/campaign/:id/check-funding` | POST | Check Privacy Cash balance |
| `/api/campaign/:id/recipients` | POST | Add recipients |
| `/api/campaign/:id/notify` | POST | Send claim notifications |

### Claims

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claim/verify/magic-link` | POST | Verify magic link |
| `/api/claim/verify/social/:provider/url` | GET | Get OAuth URL |
| `/api/claim/verify/social/:provider/callback` | POST | OAuth callback |
| `/api/claim/process` | POST | Process claim |
| `/api/claim/status/:campaignId/:identityHash` | GET | Check claim status |

## Security

### Wallet Key Storage

Campaign wallet private keys are encrypted with AES-256-CBC and stored in MongoDB. The encryption key is stored in the `WALLET_ENCRYPTION_KEY` environment variable. This provides:
- Encryption at rest
- Simple deployment (no external services)
- Secure key management via environment variables

### Identity Protection

- User identities stored as SHA-256 hashes with salt
- OTPs: 6 digits, 10 min expiry, max 5 attempts
- Magic links: 24h expiry, single use
- Verification tokens: 30 min expiry

### Privacy Cash Integration

- ZK proofs generated server-side using snarkjs
- Borsh serialization for extDataHash (matches SDK exactly)
- UTXO indices synced from relayer API
- Transaction confirmation polling

## Development

```bash
# Run with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT
