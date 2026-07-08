# Starknet port notes

Branch: `starknet`. Two phases so far:

- **Phase 0 — wallet layer + address utilities** (committed): wallet/connection
  rewritten from viem/EIP-1193 to starknet.js v7 + get-starknet v4; felt-address
  utilities (`normalizeAddress`, `isAddressEqual`, `ZERO_ADDRESS`) replacing all
  EVM `toLowerCase()` compares; string (felt hex) chain ids.
- **Phase 6 — contract layer** (this change set): every contract call site
  ported to the frozen lssvm2-starknet Cairo ABIs; viem removed entirely.

## Phase 6 — what changed

### ABIs (`src/abi/*.ts`) — regenerated from Sierra artifacts

Extracted from `lssvm2-starknet/target/dev/*.contract_class.json` (`abi` field),
emitted as `Abi`-typed const arrays for starknet.js `Contract`/`CallData`:

- `Factory.ts` (`FactoryABI`) — `lssvm_factory_LSSVMPairFactory`
- `Pair721.ts` — `lssvm_pair_LSSVMPairERC721`
- `Pair1155.ts` — `lssvm_pair_LSSVMPairERC1155` (unused by the UI; completeness)
- `ListingBook.ts` — `lssvm_hooks_ListingBook`
- `ERC20.ts` / `ERC721.ts` / `ERC1155.ts` — OZ snake_case interfaces extracted
  from the workspace's OZ-based mock artifacts + hand-assembled standard
  metadata interfaces (`name`/`symbol`/`decimals` as ByteArray/u8,
  `token_uri`, `uri`). `ERC721` also carries a legacy camelCase `tokenURI`
  entry used only as a runtime fallback.
- **Deleted**: `Multicall.ts` (aggregation replaced by `Promise.all` over the
  RPC provider) and `Pair.ts` (sudoswap v1 pair — no v1 on Starknet; the
  `PairVersion` type remains but `detectPairVersion()` always resolves 'v2'
  after the `factory()` read).

Every encode/decode path was verified offline against `CallData` with the real
ABIs (hand-built calldata for `create_pair_erc721_eth/erc20`, both swaps,
`withdraw_erc721`, `approve`, `set_approval_for_all` match `CallData.compile`
exactly; quote/enum/ByteArray/array parsing verified).

### ABI-mapping decisions

- **u256 <-> bigint**: reads come back from starknet.js as `bigint` (no change
  to component signal types). Writes serialize via `u256Calldata` /
  `u256ArrayCalldata` (`src/app/services/starknet.util.ts`) — `[low, high]`
  limbs, arrays as `[len, ...pairs]`.
- **Addresses**: read results are felts (bigint) — always passed through
  `normalizeAddress()` to the canonical 66-char hex before hitting signals or
  compares.
- **Enums**: `PoolType`/`CurveError` decode as `CairoCustomEnum`; mapped to
  wire indexes via variant-order tables (`TOKEN=0/NFT=1/TRADE=2`; `OK=0...`).
  For writes, `pool_type` is sent as a single felt (0/1/2), matching the
  Cairo serialization of unit-variant enums.
- **Quotes**: `get_buy_nft_quote`/`get_sell_nft_quote` parse the `NFTQuote`
  struct FIELDS (`error`, `new_spot_price`, `new_delta`, `amount`,
  `protocol_fee`, `royalty_amount`) via `parseNftQuote()` — never tuple
  indexes. `error != 0` renders as "quote unavailable (curve error N)".
- **ListingBook**: `get721_listings(collection, 0, 0, 0)` — token 0 = any,
  `end == 0` = all; result felts normalized to hex pair addresses.

### Reads — RPC batching

All Multicall-contract aggregation is gone. Independent reads are
`starknet.js Contract.call` batched with `Promise.all` (browse listings +
per-pair ids/quotes, manage pair snapshot, home token/NFT metadata, pool page
field reads). Failure isolation per read is preserved (pool page
`Promise.allSettled`, per-pair try/catch in browse).

### Writes — single-transaction batching (`account.execute([...calls])`)

The Starknet UX win over EVM: approvals ride in the same transaction.

- **Buy** (`nft.service`): `[ethToken/erc20.approve(pair, price),
  pair.swap_token_for_specific_nfts(ids, price, wallet, false, 0)]` — the
  pair pulls its quote token (the configured ETH ERC20 for "ETH" pools) via
  `transfer_from`; approve is exact-amount.
- **Sell** (`nft.service`): `[nft.set_approval_for_all(pair, true)]` (only if
  missing) + `pair.swap_nfts_for_token(ids, minOut, wallet, false, 0)`.
- **Create pool** (`home`): missing NFT/ERC20 approvals +
  `factory.create_pair_erc721_eth` (or `create_pair_erc721_erc20` with the
  params struct flattened in member order) in one transaction. PoolType NFT=1.
- **Withdraw** (`manage`): `pair.withdraw_erc721(nft, ids)`.
- Tx lifecycle unchanged (`transactionPending$` etc.); hashes are now plain
  strings; confirmation via `provider.waitForTransaction`.

### Chain/env config

- `src/app/services/deployments.ts` + a `provideAppInitializer` hook in
  `app.config.ts`: fetches `deployments/katana.json` (URL configurable via
  `DEPLOYMENTS_URL`) and applies `contracts.*` to the DEVNET registry entry
  plus `rpcUrl`/`chainId` to the Devnet chain config. The real file from
  `lssvm2-starknet/deployments/katana.json` is checked in at
  `public/deployments/katana.json` (all keys verified to parse:
  `contracts{factory,router,listingBook,ethToken,curves{linear,exponential,
  xyk,gda}}`, `chainId`, `rpcUrl` -> `http://localhost:5050`). Absent file =>
  placeholder (empty) devnet addresses; app still builds/runs, reads fail
  gracefully.
- The devnet (starknet-devnet v0.9.0) reports chain id **SN_SEPOLIA**, which
  collides with the public Sepolia entry — `configureDevnet()` therefore
  drops the public Sepolia chain entry while a deployments file is active, so
  the local RPC wins chain-id lookups. Remove the deployments file to get
  public Sepolia back.
- `address.ts`: legacy YOMINET/ETHEREUM registry entries removed (their EVM
  call sites are gone); `ETH_TOKEN` per-chain key added. Component fallbacks
  moved YOMINET->DEVNET / ETHEREUM->STARKNET.
- `wallet.service.ts`: phase-0 `getPublicClient()`/`getWalletClient()` null
  shims removed — everything uses `getProvider()`/`getAccount()`. Added
  `configureDevnet()` (deployments hook) and `ethTokenAddress()`.

### starknet.js v10 (RPC spec 0.10)

Bumped `starknet` 7.6.4 -> 10.0.2: the local starknet-devnet v0.9.0 speaks
RPC spec 0.10, which v7 does not support (v10 supports 0.9/0.10 only).
API changes absorbed:

- `new Contract(abi, address, provider)` -> `new Contract({ abi, address,
  providerOrAccount })` (all ~20 construction sites).
- `new WalletAccount(provider, walletProvider, address)` ->
  `new WalletAccount({ provider, walletProvider, address })` (v10 keeps the
  get-starknet v4-flavored class; get-starknet stays at v4.0.8).
- `RpcProvider`/`callContract`/`waitForTransaction`/`CallData`/`uint256`/
  `CairoCustomEnum`/`validateAndParseAddress` unchanged — the offline
  encode/decode verification suite passes identically under v10.
- Public RPC endpoints switched from Blast (`/rpc/v0_8`, now discontinued —
  probes return "Blast API is no longer available") to Cartridge:
  `https://api.cartridge.gg/x/starknet/mainnet` (spec 0.10.2) and
  `.../sepolia` (spec 0.9.0), both verified live-compatible with v10.

### Behavior notes

- "ETH" pools on Starknet price in the ETH ERC20, so `pair.token()` is never
  zero — the pool page displays them as ERC20 pools whose symbol is ETH.
- **Pools created with `asset_recipient = 0` route sale proceeds and sold
  NFTs to the pool OWNER, not the pool** (Solidity parity). The manage page's
  "withdrawable balance" view must treat a zero ERC20 balance on a listing
  pool as legitimate — proceeds accrue to the owner's account directly.
- `manage` metadata uses `token_uri` with a legacy `tokenURI` fallback;
  base64 `data:application/json` parsing unchanged.
- The kami page now keys off whichever chain has a `KAMI` address configured
  (none yet) instead of hard-coded Yominet.

### Templates touched (text/condition only)

- `home.component.html`: creation gate `currentChainId !== 'ETHEREUM'` ->
  `creationSupported` (factory configured on current chain) — forced by the
  removal of the ETHEREUM label.
- `pool.component.html`: sell help text updated (approval is batched into the
  swap transaction now).

## Removed dependencies

`viem` fully removed from `package.json` and `src/` (only explanatory comments
mention it). `formatUnits` is now local (`format.util.ts`).

## What remains (follow-up integration task)

- Manual validation against the live devnet (wallet connect, listing
  creation, browse/manage/pool reads, buy/sell/withdraw) — the deployments
  file is wired and statically verified, but everything past `CallData`
  encode/decode verification is untested against a node. Seed data is
  available in `katana.json` (`seeds.collections` / `seeds.pools`).
- `VeryFastRouter` is deployed but not used by this UI (no ABI file emitted).
- ERC1155 flows: ABI + factory entrypoints exist; no UI.
- Public-network (SN_MAIN/SN_SEPOLIA) contract addresses once deployed.
- Bundle is ~821 kB raw (budget *warning* only); consider lazy-loading
  starknet.js if it matters.
