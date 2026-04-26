// v1 LSSVMPair ABI (sudoswap v1 mainnet pairs).
// Differs from v2 (Pair721): getAllHeldIds (not getAllIds), quotes take only
// numNFTs and return no royaltyAmount, no hook/referral.
export const Pair = [
  {
    "inputs": [],
    "name": "token",
    "outputs": [
      { "internalType": "contract ERC20", "name": "_token", "type": "address" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "assetRecipient",
    "outputs": [
      { "internalType": "address payable", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "delta",
    "outputs": [{ "internalType": "uint128", "name": "", "type": "uint128" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "fee",
    "outputs": [{ "internalType": "uint96", "name": "", "type": "uint96" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "spotPrice",
    "outputs": [{ "internalType": "uint128", "name": "", "type": "uint128" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "numNFTs", "type": "uint256" },
      { "internalType": "uint256", "name": "maxExpectedTokenInput", "type": "uint256" },
      { "internalType": "address", "name": "nftRecipient", "type": "address" },
      { "internalType": "bool", "name": "isRouter", "type": "bool" },
      { "internalType": "address", "name": "routerCaller", "type": "address" }
    ],
    "name": "swapTokenForAnyNFTs",
    "outputs": [
      { "internalType": "uint256", "name": "inputAmount", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256[]", "name": "nftIds", "type": "uint256[]" },
      { "internalType": "uint256", "name": "maxExpectedTokenInput", "type": "uint256" },
      { "internalType": "address", "name": "nftRecipient", "type": "address" },
      { "internalType": "bool", "name": "isRouter", "type": "bool" },
      { "internalType": "address", "name": "routerCaller", "type": "address" }
    ],
    "name": "swapTokenForSpecificNFTs",
    "outputs": [
      { "internalType": "uint256", "name": "inputAmount", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256[]", "name": "nftIds", "type": "uint256[]" },
      { "internalType": "uint256", "name": "minExpectedTokenOutput", "type": "uint256" },
      { "internalType": "address payable", "name": "tokenRecipient", "type": "address" },
      { "internalType": "bool", "name": "isRouter", "type": "bool" },
      { "internalType": "address", "name": "routerCaller", "type": "address" }
    ],
    "name": "swapNFTsForToken",
    "outputs": [
      { "internalType": "uint256", "name": "outputAmount", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "numNFTs", "type": "uint256" }
    ],
    "name": "getBuyNFTQuote",
    "outputs": [
      { "internalType": "enum CurveErrorCodes.Error", "name": "error", "type": "uint8" },
      { "internalType": "uint256", "name": "newSpotPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "newDelta", "type": "uint256" },
      { "internalType": "uint256", "name": "inputAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "protocolFee", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "numNFTs", "type": "uint256" }
    ],
    "name": "getSellNFTQuote",
    "outputs": [
      { "internalType": "enum CurveErrorCodes.Error", "name": "error", "type": "uint8" },
      { "internalType": "uint256", "name": "newSpotPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "newDelta", "type": "uint256" },
      { "internalType": "uint256", "name": "outputAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "protocolFee", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllHeldIds",
    "outputs": [
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pairVariant",
    "outputs": [
      { "internalType": "enum ILSSVMPairFactoryLike.PairVariant", "name": "", "type": "uint8" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "factory",
    "outputs": [
      { "internalType": "contract ILSSVMPairFactoryLike", "name": "_factory", "type": "address" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "bondingCurve",
    "outputs": [
      { "internalType": "contract ICurve", "name": "_bondingCurve", "type": "address" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nft",
    "outputs": [
      { "internalType": "contract IERC721", "name": "_nft", "type": "address" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "poolType",
    "outputs": [
      { "internalType": "enum LSSVMPair.PoolType", "name": "_poolType", "type": "uint8" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAssetRecipient",
    "outputs": [
      { "internalType": "address payable", "name": "_assetRecipient", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
