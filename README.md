# Quai ERC1155 Testnet dApp

Open ERC1155 test contract for Quai Network Orchard Testnet. Anyone can mint, transfer, and burn tokens for testing purposes.

## Features

- **Open minting** — No role required; anyone can mint
- **ERC1155** — Multi-token standard with batch operations, URI, royalties
- **Quai Network** — Deployed on Orchard Testnet (Cyprus zone)
- **Pelagus Wallet** — Connect via [Pelagus Wallet](https://pelaguswallet.io/)
- **Web UI** — Mint, transfer, burn, view token info, and manage URI/royalty (admin)

## Project Structure

```
quai-erc1155-dapp/
├── contracts/          # Solidity (QuaiTestERC1155)
├── scripts/            # Deploy, mint, transfer, etc.
├── frontend/           # Vite + React dApp
├── deployments/        # Deployment artifacts
└── test/               # Hardhat tests
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Pelagus Wallet](https://pelaguswallet.io/) (Chrome/Firefox)
- Testnet QUAI from [Orchard Faucet](https://orchard.faucet.quai.network)

### Install

```bash
npm install
cd frontend && npm install && cd ..
```

### Run Frontend

```bash
npm run dev
```

Open http://localhost:5173 and connect Pelagus. Ensure Pelagus is set to **Quai Orchard Testnet**.

### Build Frontend

```bash
npm run build
```

Output in `frontend/dist/`.

### Deploy to Vercel

The project includes `vercel.json` for monorepo deployment. Connect the repo to Vercel; it will build the frontend automatically. Optional env vars in Vercel: `VITE_ERC1155_CONTRACT`, `VITE_RPC_URL`.

## Smart Contract

### Compile & Test

```bash
npm run compile
npm run test
```

### Deploy

```bash
# Orchard Testnet (requires CYPRUS1_PK in .env)
npm run deploy:cyprus1
```

## Environment

Create `.env` from `.env.example`:

| Variable | Description |
|----------|-------------|
| `RPC_URL` | Orchard Testnet RPC (e.g. `https://rpc.orchard.quai.network`) |
| `CHAIN_ID` | 15000 for Orchard Testnet |
| `CYPRUS1_PK` | Private key for deployer (Cyprus1 zone) |
| `ERC1155_CONTRACT` | Deployed contract address (set after deploy) |

Optional frontend overrides (in `frontend/.env` or root):

| Variable | Description |
|----------|-------------|
| `VITE_ERC1155_CONTRACT` | Contract address override |
| `VITE_RPC_URL` | RPC URL override |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run build` | Build frontend for production |
| `npm run compile` | Compile contracts |
| `npm run test` | Run contract tests |
| `npm run test:gas` | Run tests with gas report |
| `npm run deploy:cyprus1` | Deploy to Orchard Testnet Cyprus1 |
| `npm run mint` | Mint tokens (CLI: `TOKEN_ID=1 AMOUNT=100`) |
| `npm run transfer` | Transfer (CLI: `TOKEN_ID=1 AMOUNT=10 TRANSFER_TO=0x...`) |
| `npm run check-balance` | Check balance (CLI: `CHECK_ADDRESS=0x...`) |
| `npm run set-uri` | Set token URI (admin) |
| `npm run grant-role` | Grant role to address |
| `npm run clean` | Clean Hardhat artifacts |

## Deployment

Contract on Orchard Testnet:

- **Address**: `0x005ce6Bae8AFA47328b5c711b19e40afD881cE38`
- **Explorer**: [Orchard Quaiscan](https://orchard.quaiscan.io)

## Contract Capabilities

- **Mint / MintBatch** — Open to all
- **Burn / BurnBatch** — Holder or approved operator
- **Transfer** — `safeTransferFrom` / `safeBatchTransferFrom`
- **URI** — Per-token and base URI (URI_SETTER_ROLE)
- **Royalty** — ERC2981 (DEFAULT_ADMIN_ROLE)
- **Pause** — PAUSER_ROLE

## License

MIT
