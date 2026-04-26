// Define the chain ID type
export const CHAIN_ID = {
  YOMINET: 'YOMINET',
  ETHEREUM: 'ETHEREUM'
} as const;

// Create a type from the values of CHAIN_ID
export type ChainIdType = typeof CHAIN_ID[keyof typeof CHAIN_ID];

// Define the contract addresses interface
interface ContractAddressesType {
  PAIR_FACTORY_V2_HOOKS?: string;
  PAIR_FACTORY_V2?: string;
  PAIR_FACTORY?: string;
  LINEAR_CURVE_V2?: string;
  EXPONENTIAL_CURVE_V2?: string;
  XYK_CURVE_V2?: string;
  GDA_CURVE_V2?: string;
  VERY_FAST_ROUTER_V2?: string;
  MULTICALL?: string;
  LISTING_BOOK?: string;
  KAMI?: string;
}

// Define the contract addresses record type
export type ContractAddressesRecord = Record<ChainIdType, ContractAddressesType>;

// Export the contract addresses with proper typing
export const CONTRACT_ADDRESSES: ContractAddressesRecord = {
  [CHAIN_ID.YOMINET]: {
    PAIR_FACTORY_V2_HOOKS: '0x470C73Ed96D0b6DB8F152827510bffE2a69BA538',
    LINEAR_CURVE_V2: '0x3F33C248CEB275cbBB93adB138A32C76d9060D99',
    EXPONENTIAL_CURVE_V2: '0x6c4BBEC8E3544D4A58B3E2487CfA4097Ded19eDc',
    XYK_CURVE_V2: '0x38BA53D83dE7234A04E6F0ec5Fb779681e3940cf',
    GDA_CURVE_V2: '0x53f0E31E2B8084ce4dD5991EcF157B181fc38bC1',
    VERY_FAST_ROUTER_V2: '0x1A72CB0Ab23aaF24472855EF30b5714A1a87046B',
    MULTICALL: '0x14521bbB801ac766568d7CE82cFB2968b98B4Ca3',
    LISTING_BOOK: '0x048000C86B685e6eB69f6FcB0B1a5e7E5C80b130',
    KAMI: '0x5d4376b62fa8ac16dfabe6a9861e11c33a48c677'
  },
  [CHAIN_ID.ETHEREUM]: {
    // Used to detect pair variant when looking up a pool by address.
    PAIR_FACTORY_V2: '0xA020d57aB0448Ef74115c112D18a9C231CC86000',
    PAIR_FACTORY: '0xb16c1342E617A5B6E4b631EB114483FDB289c0A4'
  }
};

// Numeric chain ID -> CHAIN_ID label.
export const CHAIN_ID_BY_NUMBER: Record<number, ChainIdType> = {
  [parseInt('0x18623A6A54F3F', 16)]: CHAIN_ID.YOMINET,
  1: CHAIN_ID.ETHEREUM,
};

// URL slug (lowercased label segment) -> CHAIN_ID.
export const CHAIN_ID_BY_LABEL: Record<string, ChainIdType> = {
  yominet: CHAIN_ID.YOMINET,
  ethereum: CHAIN_ID.ETHEREUM,
  eth: CHAIN_ID.ETHEREUM,
  mainnet: CHAIN_ID.ETHEREUM,
};
