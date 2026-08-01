# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A lightweight Angular 19 frontend for sudoswap-style NFT AMM pools: create listings, browse collections, and buy/sell NFTs against bonding-curve pair contracts.

**This is the `starknet` branch of a fork.** It targets **Starknet**, not Ethereum. The contracts it talks to are [lssvm2-starknet](https://github.com/loothero/lssvm2-starknet), a Cairo port of sudoAMM v2 — that repo is the source of truth for the ABIs and protocol semantics here. Upstream `sudoswap/amm-lite` is EVM (viem, `window.ethereum`, Yominet/Ethereum); **none of that survives on this branch.** If you find a doc or comment describing viem, Multicall, `eth_accounts` or chain id `0x18623A6A54F3F`, it is stale.

Deployed at https://amm-lite-production.up.railway.app (Sepolia addresses compiled in). Redeploy with `deploy/railway.sh`.

## Licensing — read NOTICE.md

AGPL-3.0 (`LICENSE`), but with a caveat that is not boilerplate: upstream
`sudoswap/amm-lite` has **no licence at all**, so applying AGPL here covers this fork's own
contributions and cannot grant rights over the inherited base. `NOTICE.md` explains what that
means and what to do before distributing or hosting publicly. AGPL §13 (network use) applies to
the hosted deployment.

## Commands

```bash
npm start        # dev server at http://localhost:4200
npm run build    # production build to dist/amm-lite
npm run watch    # rebuild on change, development config
npm test         # Karma/Jasmine
```

Both `bun.lock` and `package-lock.json` are checked in; either package manager works. There is no lint target.

### Running tests headless

`karma.conf.js` defines a `ChromeHeadlessNoSandbox` launcher, because the stock launchers cannot start in a container (Chromium's sandbox needs unprivileged user namespaces).

```bash
export CHROME_BIN=~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell
export LD_LIBRARY_PATH=/tmp/arcade-playwright-sysroot/usr/lib/x86_64-linux-gnu
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox
```

Prefer Playwright's `chrome-headless-shell`: the full `chrome` builds in the same cache still want libcups/libcairo/libpango, which that sysroot does not carry.

Note that `tsconfig.spec.json` compiles **every** spec as one unit, so a single spec that fails to type-check breaks the whole run — `--include` does not isolate it.

## Architecture

Angular 19 standalone components (no NgModules), signals for component state, `inject()` for DI. Routing uses hash location (`withHashLocation()` in `app.config.ts`), so URLs look like `/#/pool/sepolia/0x...`. TypeScript strict mode and `strictTemplates` are on.

Routes (`src/app/app.routes.ts`) follow `:label/:address`, where `:label` is a chain slug (`starknet`/`mainnet`, `sepolia`, `devnet`/`katana` — mapped via `CHAIN_ID_BY_LABEL`):

- `/` — home: create a listing, look up a pool by address
- `/browse/:label/:address` — listings for an NFT collection (via the ListingBook contract)
- `/manage/:label/:address` — NFTs in a pool with metadata and buy actions
- `/pool/:label/:address` — single pair pool: inventory, quotes, buy/sell
- `/kami/:id` — resolves `owner_of(id)` and redirects to `/manage` for the owning pool

### Blockchain layer

**starknet.js v10** plus **`@starknet-io/get-starknet` v4** for wallet discovery. There is no viem, no wagmi, no ethers, and no `window.ethereum`.

- `src/app/services/wallet.service.ts` — connection state as signals (`walletAddress`, `isConnected`, `balance`, `currentChainIdNum`, a string despite the name), silent auto-reconnect, `getProvider()` (reads, falls back to a public RPC with no wallet) and `getAccount()` (writes).
- `src/app/services/nft.service.ts` — `buyNFT` (`swap_token_for_specific_nfts`) and `sellNFTs` (`swap_nfts_for_token`), with the ERC721 `set_approval_for_all` flow before selling. Transaction lifecycle over RxJS subjects. `detectPairVersion` reads the pair's `factory()` and matches it against configured factory addresses.
- `src/app/services/address.ts` — per-chain contract registry. `CONTRACT_ADDRESSES` keyed by `CHAIN_ID` label; `CHAIN_ID_BY_NUMBER` / `CHAIN_ID_BY_LABEL` map felt chain ids and URL slugs to those labels. Chain ids are **strings**, not numbers — Starknet chain ids overflow JS `number`.
- `src/app/services/deployments.ts` — populates the DEVNET entry at runtime from `public/deployments/*.json`. Devnet deploys are **not** address-deterministic across restarts, so re-copy the deployments file from the contracts repo for devnet work.
- `src/app/services/starknet.util.ts` — Cairo enum decoding (`decodePoolType`, `decodeCurveError`), u256 calldata helpers, `NFTQuote` parsing.
- `src/app/services/gda-safety.ts` — the GDA TRADE-pool guard; see below.
- `src/abi/` — starknet.js `Abi` arrays: `Pair721`, `Pair1155`, `Factory`, `ListingBook`, `ERC20`, `ERC721`, `ERC1155`.

Batching is `account.execute([...calls])` — Starknet accounts batch natively, so the custom Multicall contract upstream used is gone. Page components do their own reads; there is no shared store.

### ABIs are generated — do not hand-edit

`src/abi/{Factory,ListingBook,Pair721,Pair1155}.ts` are generated from lssvm2-starknet's Sierra artifacts. That repo has a CI gate that fails when its ABI surface changes, and regenerating here is the debt that gate signals:

```bash
node scripts/check-abi-drift.mjs --amm-lite      /path/to/amm-lite   # check
node scripts/check-abi-drift.mjs --emit-amm-lite /path/to/amm-lite   # regenerate
```

(run from the lssvm2-starknet checkout). These have desynced silently before.

### The GDA guard

`src/app/services/gda-safety.ts` blocks creating — and warns on — GDA pools of type TRADE whose trade fee is too low. Such a pool has no bid/ask spread and can be drained by round-trip arbitrage; a fee of roughly `(α−1)/(2α)` neutralises it.

The threshold is **not** guesswork: it comes from bisection measurements pinned in lssvm2-starknet's test suite (`gda_fee_offset_*`), and `gda-safety.spec.ts` asserts the recommendation is never below any measured point. The closed form under-estimates as α grows, which is the dangerous direction, so the implementation inflates it ×1.35. **If those measurements change, this file must change with them** — see `docs/gda-trade-pools.md` in the contracts repo.

### Styling

Tailwind CSS 4 via PostCSS (`@import "tailwindcss"` in `src/styles.css`), plus `--sudo-*` CSS custom properties for the dark palette. Components mix Tailwind utilities with small per-component CSS files.
