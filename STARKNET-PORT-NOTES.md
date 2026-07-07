# Starknet port notes — wallet layer + address utilities (phase: ABI-independent groundwork)

Branch: `starknet`. Scope of this slice: wallet/connection layer and address/chain
utilities only. Contract call sites, ABIs, and multicall batching are intentionally
still EVM/viem and will be ported in a later phase ("phase 6") once the
`lssvm2-starknet` Cairo contracts exist. Grep for `TODO(starknet-port` to find every
deliberate leftover.

## What changed

### `src/app/services/wallet.service.ts` — rewritten (viem/EIP-1193 -> starknet.js + get-starknet)

- Connect/disconnect via the get-starknet modal (`@starknet-io/get-starknet` v4
  `connect()` / `disconnect()`). The modal replaces the old "install MetaMask"
  alert: it lists installed Starknet wallets and shows install links when none
  are present. User-rejected connects (`USER_REFUSED_OP`) and a dismissed modal
  both resolve `connectWallet()` to `false`, as before.
- Silent auto-reconnect preserved: `connect({ modalMode: 'neverAsk' })` +
  `wallet_requestAccounts` with `silent_mode: true` (replaces `eth_accounts`).
  `disconnectWallet()` calls get-starknet `disconnect({ clearLastWallet: true })`
  so the app doesn't silently reconnect after an explicit disconnect.
- Wallet events: `accountsChanged` / `networkChanged` on the
  `StarknetWindowObject` (replaces the EIP-1193 listeners). An empty
  `accountsChanged` resets state but keeps listeners attached (wallet lock /
  unlock), matching the old behavior.
- `switchChain()` now uses `wallet_switchStarknetChain` with a
  `wallet_addStarknetChain` + retry fallback (parity with the old
  `wallet_switchEthereumChain` / error-4902 / `wallet_addEthereumChain` flow).
- `fetchBalance()`: Starknet has no native balance — "ETH" is itself an ERC20
  (the fee token, same address on SN_MAIN / SN_SEPOLIA / katana). Reads
  `balance_of(wallet)` (falls back to legacy `balanceOf`) via
  `RpcProvider.callContract` and formats the u256 to a decimal string, same
  shape the components already `parseFloat`.
- New Starknet-native accessors for the later phase:
  - `getProvider(): RpcProvider | null` — reads (replacement for the viem
    public client).
  - `getAccount(): WalletAccount | null` — wallet-signed writes via
    `account.execute(calls)` (replacement for the viem wallet client).
- Supported chains are now `SN_MAIN` ("Starknet"), `SN_SEPOLIA` ("Sepolia"),
  and a local katana devnet entry (`KATANA` chain id, `http://localhost:5050`).

### Public API — kept, with typed-but-not-named deltas

All signal/method names consumed by components are unchanged: `walletAddress`,
`isConnected`, `balance`, `currentChainIdNum`, `supportedChains`,
`connectWallet`, `disconnectWallet`, `switchChain`, `getConnectedWallet`,
`getCurrentChain`, `getPublicClient`, `getWalletClient`, `fetchBalance`.

Unavoidable type changes (Starknet chain ids are felts that overflow JS
numbers, e.g. SN_SEPOLIA = `0x534e5f5345504f4c4941`):

| Member | Before | After |
|---|---|---|
| `currentChainIdNum` | `signal<number \| null>` | `signal<string \| null>` (normalized chain-id hex; name kept deliberately) |
| `ChainConfig.id` / `Chain.id` | `number` | `string` |
| `switchChain(id)` | `number` | `string` |
| `getCurrentChain()` | viem `Chain` | local `Chain` interface, same shape (`id`/`name`/`nativeCurrency`/`rpcUrls.default.http`) but string `id` |
| `getPublicClient()` / `getWalletClient()` | viem `PublicClient \| null` / `WalletClient \| null` | legacy stubs, always `null`, typed `any` (see below) |

### `src/app/services/address.ts` — converted

- `ZERO_ADDRESS` — canonical 66-char felt zero address.
- `normalizeAddress()` — pad-to-66-char lowercase canonical felt form (wraps
  starknet.js `validateAndParseAddress`).
- `isAddressEqual()` — normalized-felt equality; replaces every
  `a.toLowerCase() === b.toLowerCase()` EVM compare.
- `normalizeChainId()` + `STARKNET_CHAIN_ID` (SN_MAIN / SN_SEPOLIA /
  SN_DEVNET='KATANA') + `ETH_ERC20_ADDRESS`.
- `CHAIN_ID_BY_NUMBER` is now keyed by normalized chain-id hex **strings**
  (name kept so unported components that index into it don't change; rename to
  `CHAIN_ID_BY_CHAIN_ID` in phase 6).
- `CHAIN_ID` gained `STARKNET` / `SEPOLIA` / `DEVNET` labels (with empty
  `CONTRACT_ADDRESSES` entries to fill once contracts deploy). The legacy
  `YOMINET` / `ETHEREUM` labels, addresses, and slugs are kept **only** so the
  unported EVM call sites compile; the `mainnet` URL slug now maps to
  `STARKNET` (was `ETHEREUM`).

### Address compares fixed (no `toLowerCase()` address comparison remains in `src/`)

- `src/app/services/nft.service.ts` — factory-address matching in
  `detectPairVersion()` -> `isAddressEqual`.
- `src/app/manage/manage.component.ts` — pool-owner check -> `isAddressEqual`.
- `src/app/pool/pool.component.ts` — token-vs-zero-address check ->
  `isAddressEqual` + shared `ZERO_ADDRESS` (local 20-byte constant removed).

Remaining `toLowerCase()` hits are URL-slug/label lowering (route `:label`
segments, `networkLabel()`, the `wallet_addStarknetChain` `id` field) — not
address comparisons.

## Components touched, and why

Only forced, compile-level touches — no logic ported:

- `app.component.ts`, `home.component.ts` — `switchChain(id: number)` param
  annotation -> `string` (chain ids are felt hex strings now).
- `manage.component.ts`, `pool.component.ts` — the address-compare fixes above.

## Shims (compile-level only, all marked `TODO(starknet-port, phase 6)`)

- `WalletService.getPublicClient()` / `getWalletClient()` always return `null`,
  typed `any` (`LegacyEvmPublicClient` / `LegacyEvmWalletClient`). Every EVM
  contract call site already null-checks the client, so those paths compile
  unchanged and no-op at runtime.
- Legacy EVM entries in `address.ts` (`YOMINET` / `ETHEREUM` labels, addresses,
  slugs).

## Intentionally still EVM (ABI-dependent, later phase)

- `src/abi/*` — viem-format ABI arrays (regenerate from Cairo ABIs).
- `src/app/services/nft.service.ts` — buy/sell/approval flows
  (`writeContract`, `waitForTransactionReceipt`, EVM `ZERO_ADDRESS` call args).
- `src/app/home/home.component.ts`, `browse.component.ts`,
  `manage.component.ts`, `pool.component.ts`, `kami.component.ts` — direct
  `readContract` / `writeContract` / manual `Multicall` +
  `encodeFunctionData` / `decodeFunctionResult` batching.
- `src/app/services/format.util.ts` — imports viem `formatUnits` (harmless).
- The `viem` dependency stays in `package.json` until the above are ported,
  then remove it.

## Dependencies

Added: `starknet` 7.6.4, `@starknet-io/get-starknet` 4.0.8,
`@starknet-io/get-starknet-core` 4.0.8. Only `package-lock.json` was updated
(`bun.lock` not regenerated).

`npm run build` is green; the initial bundle grew to ~928 kB raw
(~230 kB transfer) from starknet.js, which exceeds the 500 kB budget
*warning* (the error budget is 100 MB, so builds still pass). Revisit bundle
size when the viem call sites are removed in phase 6.
