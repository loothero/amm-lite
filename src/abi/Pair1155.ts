// Sierra ABI extracted from lssvm2-starknet `target/dev/lssvm_pair_LSSVMPairERC1155.contract_class.json`.
// Regenerate with the lssvm2-starknet port tooling whenever the Cairo contracts change.
// Do not edit by hand.
import type { Abi } from 'starknet';

export const Pair1155: Abi = [
  {
    "type": "impl",
    "name": "PairVariantImpl",
    "interface_name": "lssvm_pair::pair_core::IPairVariant"
  },
  {
    "type": "struct",
    "name": "core::integer::u256",
    "members": [
      {
        "name": "low",
        "type": "core::integer::u128"
      },
      {
        "name": "high",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::bool",
    "variants": [
      {
        "name": "False",
        "type": "()"
      },
      {
        "name": "True",
        "type": "()"
      }
    ]
  },
  {
    "type": "interface",
    "name": "lssvm_pair::pair_core::IPairVariant",
    "items": [
      {
        "type": "function",
        "name": "swap_token_for_specific_nfts",
        "inputs": [
          {
            "name": "nft_ids",
            "type": "core::array::Array::<core::integer::u256>"
          },
          {
            "name": "max_expected_token_input",
            "type": "core::integer::u256"
          },
          {
            "name": "nft_recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "is_router",
            "type": "core::bool"
          },
          {
            "name": "router_caller",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u256"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "swap_nfts_for_token",
        "inputs": [
          {
            "name": "nft_ids",
            "type": "core::array::Array::<core::integer::u256>"
          },
          {
            "name": "min_expected_token_output",
            "type": "core::integer::u256"
          },
          {
            "name": "token_recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "is_router",
            "type": "core::bool"
          },
          {
            "name": "router_caller",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u256"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "withdraw_erc721",
        "inputs": [
          {
            "name": "nft",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "nft_ids",
            "type": "core::array::Array::<core::integer::u256>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "withdraw_erc1155",
        "inputs": [
          {
            "name": "nft",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "ids",
            "type": "core::array::Array::<core::integer::u256>"
          },
          {
            "name": "amounts",
            "type": "core::array::Array::<core::integer::u256>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "PairERC1155Impl",
    "interface_name": "lssvm_interfaces::pair::ILSSVMPairERC1155"
  },
  {
    "type": "interface",
    "name": "lssvm_interfaces::pair::ILSSVMPairERC1155",
    "items": [
      {
        "type": "function",
        "name": "nft_id",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u256"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "PairCoreImpl",
    "interface_name": "lssvm_pair::pair_core::IPairCore"
  },
  {
    "type": "enum",
    "name": "lssvm_interfaces::types::CurveError",
    "variants": [
      {
        "name": "OK",
        "type": "()"
      },
      {
        "name": "INVALID_NUMITEMS",
        "type": "()"
      },
      {
        "name": "SPOT_PRICE_OVERFLOW",
        "type": "()"
      },
      {
        "name": "DELTA_OVERFLOW",
        "type": "()"
      },
      {
        "name": "SPOT_PRICE_UNDERFLOW",
        "type": "()"
      },
      {
        "name": "AUCTION_ENDED",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "lssvm_interfaces::types::NFTQuote",
    "members": [
      {
        "name": "error",
        "type": "lssvm_interfaces::types::CurveError"
      },
      {
        "name": "new_spot_price",
        "type": "core::integer::u128"
      },
      {
        "name": "new_delta",
        "type": "core::integer::u128"
      },
      {
        "name": "amount",
        "type": "core::integer::u256"
      },
      {
        "name": "protocol_fee",
        "type": "core::integer::u256"
      },
      {
        "name": "royalty_amount",
        "type": "core::integer::u256"
      }
    ]
  },
  {
    "type": "enum",
    "name": "lssvm_interfaces::types::PoolType",
    "variants": [
      {
        "name": "TOKEN",
        "type": "()"
      },
      {
        "name": "NFT",
        "type": "()"
      },
      {
        "name": "TRADE",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "core::array::Span::<core::felt252>",
    "members": [
      {
        "name": "snapshot",
        "type": "@core::array::Array::<core::felt252>"
      }
    ]
  },
  {
    "type": "interface",
    "name": "lssvm_pair::pair_core::IPairCore",
    "items": [
      {
        "type": "function",
        "name": "initialize",
        "inputs": [
          {
            "name": "owner",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "asset_recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "delta",
            "type": "core::integer::u128"
          },
          {
            "name": "fee",
            "type": "core::integer::u128"
          },
          {
            "name": "spot_price",
            "type": "core::integer::u128"
          },
          {
            "name": "hook_address",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "referral_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "get_buy_nft_quote",
        "inputs": [
          {
            "name": "asset_id",
            "type": "core::integer::u256"
          },
          {
            "name": "num_nfts",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "lssvm_interfaces::types::NFTQuote"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_sell_nft_quote",
        "inputs": [
          {
            "name": "asset_id",
            "type": "core::integer::u256"
          },
          {
            "name": "num_nfts",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "lssvm_interfaces::types::NFTQuote"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "calculate_royalties_view",
        "inputs": [
          {
            "name": "asset_id",
            "type": "core::integer::u256"
          },
          {
            "name": "sale_amount",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "(core::array::Array::<core::starknet::contract_address::ContractAddress>, core::array::Array::<core::integer::u256>, core::integer::u256)"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "factory",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "bonding_curve",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "nft",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "pool_type",
        "inputs": [],
        "outputs": [
          {
            "type": "lssvm_interfaces::types::PoolType"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "token",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "spot_price",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u128"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "delta",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u128"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "fee",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u128"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "hook",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "referral_address",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_asset_recipient",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_fee_recipient",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "transfer_ownership",
        "inputs": [
          {
            "name": "new_owner",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "data",
            "type": "core::array::Span::<core::felt252>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "change_spot_price",
        "inputs": [
          {
            "name": "new_spot_price",
            "type": "core::integer::u128"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "change_delta",
        "inputs": [
          {
            "name": "new_delta",
            "type": "core::integer::u128"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "change_fee",
        "inputs": [
          {
            "name": "new_fee",
            "type": "core::integer::u128"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "change_asset_recipient",
        "inputs": [
          {
            "name": "new_recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "change_referral_address",
        "inputs": [
          {
            "name": "new_referral",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "withdraw_erc20",
        "inputs": [
          {
            "name": "token",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "amount",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "call",
        "inputs": [
          {
            "name": "target",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "selector",
            "type": "core::felt252"
          },
          {
            "name": "calldata",
            "type": "core::array::Span::<core::felt252>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "SRC5Impl",
    "interface_name": "openzeppelin_interfaces::introspection::ISRC5"
  },
  {
    "type": "interface",
    "name": "openzeppelin_interfaces::introspection::ISRC5",
    "items": [
      {
        "type": "function",
        "name": "supports_interface",
        "inputs": [
          {
            "name": "interface_id",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "ERC721ReceiverImpl",
    "interface_name": "openzeppelin_interfaces::token::erc721::IERC721Receiver"
  },
  {
    "type": "interface",
    "name": "openzeppelin_interfaces::token::erc721::IERC721Receiver",
    "items": [
      {
        "type": "function",
        "name": "on_erc721_received",
        "inputs": [
          {
            "name": "operator",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "from",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "token_id",
            "type": "core::integer::u256"
          },
          {
            "name": "data",
            "type": "core::array::Span::<core::felt252>"
          }
        ],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "ERC1155ReceiverImpl",
    "interface_name": "openzeppelin_interfaces::token::erc1155::IERC1155Receiver"
  },
  {
    "type": "struct",
    "name": "core::array::Span::<core::integer::u256>",
    "members": [
      {
        "name": "snapshot",
        "type": "@core::array::Array::<core::integer::u256>"
      }
    ]
  },
  {
    "type": "interface",
    "name": "openzeppelin_interfaces::token::erc1155::IERC1155Receiver",
    "items": [
      {
        "type": "function",
        "name": "on_erc1155_received",
        "inputs": [
          {
            "name": "operator",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "from",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "token_id",
            "type": "core::integer::u256"
          },
          {
            "name": "value",
            "type": "core::integer::u256"
          },
          {
            "name": "data",
            "type": "core::array::Span::<core::felt252>"
          }
        ],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "on_erc1155_batch_received",
        "inputs": [
          {
            "name": "operator",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "from",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "token_ids",
            "type": "core::array::Span::<core::integer::u256>"
          },
          {
            "name": "values",
            "type": "core::array::Span::<core::integer::u256>"
          },
          {
            "name": "data",
            "type": "core::array::Span::<core::felt252>"
          }
        ],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "constructor",
    "name": "constructor",
    "inputs": [
      {
        "name": "royalty_engine",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "bonding_curve",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "nft",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "pool_type",
        "type": "lssvm_interfaces::types::PoolType"
      },
      {
        "name": "nft_id",
        "type": "core::integer::u256"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::SpotPriceUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "new_spot_price",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::DeltaUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "new_delta",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::FeeUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "new_fee",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::AssetRecipientChange",
    "kind": "struct",
    "members": [
      {
        "name": "a",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::TokenWithdrawal",
    "kind": "struct",
    "members": [
      {
        "name": "amount",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::OwnershipTransferred",
    "kind": "struct",
    "members": [
      {
        "name": "new_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "previous_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_pair::pair_core::PairCoreComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "SpotPriceUpdate",
        "type": "lssvm_interfaces::pair::events::SpotPriceUpdate",
        "kind": "nested"
      },
      {
        "name": "DeltaUpdate",
        "type": "lssvm_interfaces::pair::events::DeltaUpdate",
        "kind": "nested"
      },
      {
        "name": "FeeUpdate",
        "type": "lssvm_interfaces::pair::events::FeeUpdate",
        "kind": "nested"
      },
      {
        "name": "AssetRecipientChange",
        "type": "lssvm_interfaces::pair::events::AssetRecipientChange",
        "kind": "nested"
      },
      {
        "name": "TokenWithdrawal",
        "type": "lssvm_interfaces::pair::events::TokenWithdrawal",
        "kind": "nested"
      },
      {
        "name": "OwnershipTransferred",
        "type": "lssvm_interfaces::pair::events::OwnershipTransferred",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_introspection::src5::SRC5Component::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "openzeppelin_token::erc721::erc721_receiver::ERC721ReceiverComponent::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "openzeppelin_token::erc1155::erc1155_receiver::ERC1155ReceiverComponent::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::erc1155::SwapNFTInPair",
    "kind": "struct",
    "members": [
      {
        "name": "amount_out",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "num_nfts",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::erc1155::SwapNFTOutPair",
    "kind": "struct",
    "members": [
      {
        "name": "amount_in",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "num_nfts",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::pair::events::erc1155::NFTWithdrawal",
    "kind": "struct",
    "members": [
      {
        "name": "num_nfts",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_pair::pair_erc1155::LSSVMPairERC1155::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "PairCoreEvent",
        "type": "lssvm_pair::pair_core::PairCoreComponent::Event",
        "kind": "flat"
      },
      {
        "name": "SRC5Event",
        "type": "openzeppelin_introspection::src5::SRC5Component::Event",
        "kind": "flat"
      },
      {
        "name": "ERC721ReceiverEvent",
        "type": "openzeppelin_token::erc721::erc721_receiver::ERC721ReceiverComponent::Event",
        "kind": "flat"
      },
      {
        "name": "ERC1155ReceiverEvent",
        "type": "openzeppelin_token::erc1155::erc1155_receiver::ERC1155ReceiverComponent::Event",
        "kind": "flat"
      },
      {
        "name": "SwapNFTInPair",
        "type": "lssvm_interfaces::pair::events::erc1155::SwapNFTInPair",
        "kind": "nested"
      },
      {
        "name": "SwapNFTOutPair",
        "type": "lssvm_interfaces::pair::events::erc1155::SwapNFTOutPair",
        "kind": "nested"
      },
      {
        "name": "NFTWithdrawal",
        "type": "lssvm_interfaces::pair::events::erc1155::NFTWithdrawal",
        "kind": "nested"
      }
    ]
  }
];
