# ⚡ PulseLaunch — Bitcoin DeFi Launchpad

> **The Gateway for New Bitcoin DeFi Projects**  
> Built for the OP_NET Vibecoding Challenge · Deployed on OP_NET Testnet

---

## 🚀 Overview

PulseLaunch is a decentralized token launchpad built on **OP_NET** — the smart contract layer on Bitcoin. It enables new Bitcoin DeFi projects to raise funds, distribute tokens, and bootstrap their communities through fair, transparent, and fully on-chain launch pools.

### Key Features

- **Token Launchpad System** — Projects create fundraising pools with configurable hard/soft caps
- **Staking Tier System** — Bronze / Silver / Gold tiers with 1×, 1.5×, 2× allocation multipliers
- **Live Analytics Dashboard** — Real-time metrics with animated charts
- **CoinGecko Market Data** — Live crypto prices updated every 10 seconds
- **Global Activity Feed** — Real-time ticker of launchpad activity
- **Security Dashboard** — Non-custodial, Bitcoin-secured architecture
- **Mobile Responsive** — Full bottom navigation for mobile users

---

## 🏗️ Architecture

```
PulseLaunch/
├── index.html                    # Full frontend dashboard
├── contracts/
│   └── LaunchPool.ts            # OP_NET smart contracts
│       ├── LaunchPool           # Individual pool contract (OP-20)
│       ├── PulseStaking         # Staking contract with tier logic
│       └── LaunchpadFactory     # Factory for deploying pools
└── README.md
```

---

## 📝 Smart Contracts

### LaunchPool (OP-20)
Each launch pool is an individual OP-20 contract. Participants receive pool participation tokens that are redeemable for the project's tokens after successful finalization.

| Method | Description |
|--------|-------------|
| `participate()` | Join the pool by sending BTC. Mints participation tokens |
| `claimTokens()` | After successful finalization, claim allocated project tokens |
| `refund()` | If soft cap not reached, withdraw BTC contribution |
| `finalize()` | Anyone can call after `endBlock` to finalize the pool |
| `getTier(address)` | View staking tier of any address |
| `progressBps()` | Pool fill level in basis points (0–10000) |

### PulseStaking
| Method | Description |
|--------|-------------|
| `stake(amount)` | Stake PULSE tokens to activate tier benefits |
| `unstake(amount)` | Unstake PULSE (7-day cooldown in production) |
| `getTier(staker)` | Returns "BRONZE", "SILVER", "GOLD", or "NONE" |
| `getMultiplier(staker)` | Returns 100, 150, or 200 (divide by 100 for multiplier) |

### Staking Tiers

| Tier | Min Stake | Allocation Multiplier | Benefits |
|------|-----------|----------------------|---------|
| 🥉 Bronze | 100 PULSE | **1×** | Base access to all pools |
| 🥈 Silver | 1,000 PULSE | **1.5×** | Priority access, reduced fees |
| 🥇 Gold | 10,000 PULSE | **2×** | Guaranteed spots, zero fees, private deals |

---

## 🛠️ Deployment Instructions (OP_NET Testnet)

### Prerequisites

```bash
# Install Node.js 18+
node --version

# Install OP_NET CLI
npm install -g @btc-vision/opnet-cli

# Install AssemblyScript
npm install -g assemblyscript
```

### Configure Testnet

```bash
# Set network to testnet
opnet config set network testnet

# Import your wallet (or generate one)
opnet wallet import --private-key YOUR_PRIVATE_KEY
# OR
opnet wallet generate

# Get testnet BTC from faucet
# Visit: https://faucet.opnet.org
```

### Compile Contracts

```bash
# Install dependencies
npm init -y
npm install @btc-vision/btc-runtime assemblyscript as-bignum

# Compile AssemblyScript
asc contracts/LaunchPool.ts \
  --target release \
  --outFile contracts/LaunchPool.wasm \
  --optimize
```

### Deploy Contracts

```bash
# 1. Deploy PULSE token (OP-20)
opnet deploy ./contracts/PulseToken.ts \
  --name "PulseLaunch Token" \
  --symbol "PULSE" \
  --supply 100000000

# 2. Deploy Staking Contract
opnet deploy ./contracts/PulseStaking.ts

# 3. Deploy Launchpad Factory
opnet deploy ./contracts/LaunchpadFactory.ts

# 4. Create a Launch Pool via factory
opnet call FACTORY_ADDRESS createPool \
  --name "NovaBTC" \
  --symbol "NBTC" \
  --hardCap 1000 \
  --softCap 200 \
  --duration 7d \
  --price 0.000008

# 5. Verify contracts
opnet verify --address CONTRACT_ADDRESS
```

### Frontend Deployment

The frontend is a single `index.html` file with zero dependencies (Chart.js loaded from CDN).

```bash
# Option 1: Serve locally
npx serve .

# Option 2: Deploy to Vercel
npx vercel --prod

# Option 3: Deploy to GitHub Pages
# Push index.html to gh-pages branch
```

---

## 🔒 Security Model

| Property | Implementation |
|----------|---------------|
| **Non-Custodial** | Smart contracts hold funds, not the platform |
| **Bitcoin Security** | OP_NET inherits Bitcoin's PoW consensus |
| **Immutable Contracts** | No admin keys or upgrade proxies |
| **Transparent** | All code open-source and verifiable |
| **Audit Trail** | Every transaction verifiable on OP_NET explorer |

---

## 🌐 OP_NET Explorer

View all contracts and transactions:
- **Testnet**: https://explorer.opnet.org (testnet)
- **Mainnet**: https://explorer.opnet.org

---

## 🧪 Testing

```bash
# Claim test tokens (available in the UI)
# Click "⚡ Claim Test Tokens" button in the Launchpad tab

# Or via CLI:
opnet faucet --address YOUR_ADDRESS --token PULSE --amount 10000
opnet faucet --address YOUR_ADDRESS --token tBTC --amount 1
```

---

## 📊 Live Market Data

PulseLaunch integrates **CoinGecko API** for real-time market data:
- Updates every 10 seconds
- Displays BTC, ETH, SOL, LTC, DOGE prices
- 24h price change with directional indicators
- Market cap data for portfolio context

---

## 🏆 Built for OP_NET Vibecoding Challenge

> *Powering the next generation of Bitcoin DeFi projects.*

PulseLaunch demonstrates the full potential of OP_NET smart contracts:
- Complex DeFi logic on Bitcoin Layer 1
- Composable OP-20 token architecture
- Cross-contract interactions (staking → launchpad)
- Production-grade UX on top of Bitcoin infrastructure

---

## 📄 License

MIT License — Open source, verifiable, trustless.
