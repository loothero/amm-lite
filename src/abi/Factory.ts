// Sierra ABI extracted from lssvm2-starknet `target/dev/lssvm_factory_LSSVMPairFactory.contract_class.json`.
// Regenerate with the lssvm2-starknet port tooling whenever the Cairo contracts change.
// Do not edit by hand.
import type { Abi } from 'starknet';

export const FactoryABI: Abi = [
  {
    "type": "impl",
    "name": "LSSVMPairFactoryImpl",
    "interface_name": "lssvm_interfaces::factory::ILSSVMPairFactory"
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
    "type": "struct",
    "name": "lssvm_interfaces::factory::CreateERC721ERC20PairParams",
    "members": [
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "nft",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "bonding_curve",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "asset_recipient",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "pool_type",
        "type": "lssvm_interfaces::types::PoolType"
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
        "name": "property_checker",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "initial_nft_ids",
        "type": "core::array::Array::<core::integer::u256>"
      },
      {
        "name": "initial_token_balance",
        "type": "core::integer::u256"
      },
      {
        "name": "hook_address",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "referral_address",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "struct",
    "name": "lssvm_interfaces::factory::CreateERC1155ERC20PairParams",
    "members": [
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "nft",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "bonding_curve",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "asset_recipient",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "pool_type",
        "type": "lssvm_interfaces::types::PoolType"
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
        "name": "nft_id",
        "type": "core::integer::u256"
      },
      {
        "name": "initial_nft_balance",
        "type": "core::integer::u256"
      },
      {
        "name": "initial_token_balance",
        "type": "core::integer::u256"
      },
      {
        "name": "hook_address",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "referral_address",
        "type": "core::starknet::contract_address::ContractAddress"
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
    "type": "struct",
    "name": "lssvm_interfaces::factory::RouterStatus",
    "members": [
      {
        "name": "allowed",
        "type": "core::bool"
      },
      {
        "name": "was_ever_touched",
        "type": "core::bool"
      }
    ]
  },
  {
    "type": "enum",
    "name": "lssvm_interfaces::types::PairNFTType",
    "variants": [
      {
        "name": "ERC721",
        "type": "()"
      },
      {
        "name": "ERC1155",
        "type": "()"
      }
    ]
  },
  {
    "type": "interface",
    "name": "lssvm_interfaces::factory::ILSSVMPairFactory",
    "items": [
      {
        "type": "function",
        "name": "create_pair_erc721_eth",
        "inputs": [
          {
            "name": "nft",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "bonding_curve",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "asset_recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "pool_type",
            "type": "lssvm_interfaces::types::PoolType"
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
            "name": "property_checker",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "initial_nft_ids",
            "type": "core::array::Array::<core::integer::u256>"
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
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "create_pair_erc721_erc20",
        "inputs": [
          {
            "name": "params",
            "type": "lssvm_interfaces::factory::CreateERC721ERC20PairParams"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "create_pair_erc1155_eth",
        "inputs": [
          {
            "name": "nft",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "bonding_curve",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "asset_recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "pool_type",
            "type": "lssvm_interfaces::types::PoolType"
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
            "name": "nft_id",
            "type": "core::integer::u256"
          },
          {
            "name": "initial_nft_balance",
            "type": "core::integer::u256"
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
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "create_pair_erc1155_erc20",
        "inputs": [
          {
            "name": "params",
            "type": "lssvm_interfaces::factory::CreateERC1155ERC20PairParams"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "protocol_fee_multiplier",
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
        "name": "default_protocol_fee_recipient",
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
        "name": "get_protocol_fee_recipient",
        "inputs": [
          {
            "name": "referrer_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "protocol_fee_recipient_referral",
        "inputs": [
          {
            "name": "referrer_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "bonding_curve_allowed",
        "inputs": [
          {
            "name": "bonding_curve",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "call_allowed",
        "inputs": [
          {
            "name": "target",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "router_status",
        "inputs": [
          {
            "name": "router",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "lssvm_interfaces::factory::RouterStatus"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "is_valid_pair",
        "inputs": [
          {
            "name": "pair_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_pair_nft_type",
        "inputs": [
          {
            "name": "pair_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "lssvm_interfaces::types::PairNFTType"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "auth_allowed_for_token",
        "inputs": [
          {
            "name": "token_address",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "proposed_auth_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_settings_for_pair",
        "inputs": [
          {
            "name": "pair_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "(core::bool, core::integer::u64)"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "settings_for_collection",
        "inputs": [
          {
            "name": "collection",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "settings",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "settings_for_pair",
        "inputs": [
          {
            "name": "pair_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "toggle_settings_for_collection",
        "inputs": [
          {
            "name": "settings",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "collection_address",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "enable",
            "type": "core::bool"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "enable_settings_for_pair",
        "inputs": [
          {
            "name": "settings",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "pair_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "disable_settings_for_pair",
        "inputs": [
          {
            "name": "settings",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "pair_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "open_lock",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "close_lock",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "withdraw_erc20_protocol_fees",
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
        "name": "change_default_protocol_fee_recipient",
        "inputs": [
          {
            "name": "default_protocol_fee_recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "change_protocol_fee_multiplier",
        "inputs": [
          {
            "name": "protocol_fee_multiplier",
            "type": "core::integer::u128"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "add_protocol_fee_recipient_referral",
        "inputs": [
          {
            "name": "referrer_address",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "recipient_address",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_bonding_curve_allowed",
        "inputs": [
          {
            "name": "bonding_curve",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "is_allowed",
            "type": "core::bool"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_call_allowed",
        "inputs": [
          {
            "name": "target",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "is_allowed",
            "type": "core::bool"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_router_allowed",
        "inputs": [
          {
            "name": "router",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "is_allowed",
            "type": "core::bool"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "deposit_nfts",
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
            "name": "recipient",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "deposit_erc20",
        "inputs": [
          {
            "name": "token",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "recipient",
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
        "name": "deposit_erc1155",
        "inputs": [
          {
            "name": "nft",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "id",
            "type": "core::integer::u256"
          },
          {
            "name": "recipient",
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
        "name": "erc721_pair_class_hash",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::class_hash::ClassHash"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "erc1155_pair_class_hash",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::class_hash::ClassHash"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "eth_token",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "OwnableImpl",
    "interface_name": "openzeppelin_interfaces::access::ownable::IOwnable"
  },
  {
    "type": "interface",
    "name": "openzeppelin_interfaces::access::ownable::IOwnable",
    "items": [
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
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "renounce_ownership",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "constructor",
    "name": "constructor",
    "inputs": [
      {
        "name": "erc721_pair_class_hash",
        "type": "core::starknet::class_hash::ClassHash"
      },
      {
        "name": "erc1155_pair_class_hash",
        "type": "core::starknet::class_hash::ClassHash"
      },
      {
        "name": "eth_token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "protocol_fee_multiplier",
        "type": "core::integer::u128"
      },
      {
        "name": "default_protocol_fee_recipient",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "owner",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "royalty_engine",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
    "kind": "struct",
    "members": [
      {
        "name": "previous_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "new_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
    "kind": "struct",
    "members": [
      {
        "name": "previous_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "new_owner",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "OwnershipTransferred",
        "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
        "kind": "nested"
      },
      {
        "name": "OwnershipTransferStarted",
        "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::NewERC721Pair",
    "kind": "struct",
    "members": [
      {
        "name": "pool_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "initial_ids",
        "type": "core::array::Array::<core::integer::u256>",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::NewERC1155Pair",
    "kind": "struct",
    "members": [
      {
        "name": "pool_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "initial_balance",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::ERC20Deposit",
    "kind": "struct",
    "members": [
      {
        "name": "pool_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "amount",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::NFTDeposit",
    "kind": "struct",
    "members": [
      {
        "name": "pool_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "ids",
        "type": "core::array::Array::<core::integer::u256>",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::ERC1155Deposit",
    "kind": "struct",
    "members": [
      {
        "name": "pool_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "id",
        "type": "core::integer::u256",
        "kind": "key"
      },
      {
        "name": "amount",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::DefaultProtocolFeeRecipientUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "recipient_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::ProtocolFeeRecipientReferralAdded",
    "kind": "struct",
    "members": [
      {
        "name": "referrer_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "recipient_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::ProtocolFeeMultiplierUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "new_multiplier",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::BondingCurveStatusUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "bonding_curve",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "is_allowed",
        "type": "core::bool",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::CallTargetStatusUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "target",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "is_allowed",
        "type": "core::bool",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_interfaces::factory::events::RouterStatusUpdate",
    "kind": "struct",
    "members": [
      {
        "name": "router",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "is_allowed",
        "type": "core::bool",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_factory::factory::LSSVMPairFactory::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "OwnableEvent",
        "type": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
        "kind": "flat"
      },
      {
        "name": "NewERC721Pair",
        "type": "lssvm_interfaces::factory::events::NewERC721Pair",
        "kind": "nested"
      },
      {
        "name": "NewERC1155Pair",
        "type": "lssvm_interfaces::factory::events::NewERC1155Pair",
        "kind": "nested"
      },
      {
        "name": "ERC20Deposit",
        "type": "lssvm_interfaces::factory::events::ERC20Deposit",
        "kind": "nested"
      },
      {
        "name": "NFTDeposit",
        "type": "lssvm_interfaces::factory::events::NFTDeposit",
        "kind": "nested"
      },
      {
        "name": "ERC1155Deposit",
        "type": "lssvm_interfaces::factory::events::ERC1155Deposit",
        "kind": "nested"
      },
      {
        "name": "DefaultProtocolFeeRecipientUpdate",
        "type": "lssvm_interfaces::factory::events::DefaultProtocolFeeRecipientUpdate",
        "kind": "nested"
      },
      {
        "name": "ProtocolFeeRecipientReferralAdded",
        "type": "lssvm_interfaces::factory::events::ProtocolFeeRecipientReferralAdded",
        "kind": "nested"
      },
      {
        "name": "ProtocolFeeMultiplierUpdate",
        "type": "lssvm_interfaces::factory::events::ProtocolFeeMultiplierUpdate",
        "kind": "nested"
      },
      {
        "name": "BondingCurveStatusUpdate",
        "type": "lssvm_interfaces::factory::events::BondingCurveStatusUpdate",
        "kind": "nested"
      },
      {
        "name": "CallTargetStatusUpdate",
        "type": "lssvm_interfaces::factory::events::CallTargetStatusUpdate",
        "kind": "nested"
      },
      {
        "name": "RouterStatusUpdate",
        "type": "lssvm_interfaces::factory::events::RouterStatusUpdate",
        "kind": "nested"
      }
    ]
  }
];
