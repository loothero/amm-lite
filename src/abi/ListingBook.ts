// Sierra ABI extracted from lssvm2-starknet `target/dev/lssvm_hooks_ListingBook.contract_class.json`.
// Regenerate with the lssvm2-starknet port tooling whenever the Cairo contracts change.
// Do not edit by hand.
import type { Abi } from 'starknet';

export const ListingBook: Abi = [
  {
    "type": "impl",
    "name": "ListingBookImpl",
    "interface_name": "lssvm_interfaces::listing_book::IListingBook"
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
    "type": "interface",
    "name": "lssvm_interfaces::listing_book::IListingBook",
    "items": [
      {
        "type": "function",
        "name": "get721_listings",
        "inputs": [
          {
            "name": "collection",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "token",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "start",
            "type": "core::integer::u256"
          },
          {
            "name": "end",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::array::Array::<core::starknet::contract_address::ContractAddress>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get721_bids",
        "inputs": [
          {
            "name": "collection",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "token",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "start",
            "type": "core::integer::u256"
          },
          {
            "name": "end",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::array::Array::<core::starknet::contract_address::ContractAddress>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get1155_listings",
        "inputs": [
          {
            "name": "collection",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "token",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "nft_id",
            "type": "core::integer::u256"
          },
          {
            "name": "start",
            "type": "core::integer::u256"
          },
          {
            "name": "end",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::array::Array::<core::starknet::contract_address::ContractAddress>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get1155_bids",
        "inputs": [
          {
            "name": "collection",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "token",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "nft_id",
            "type": "core::integer::u256"
          },
          {
            "name": "start",
            "type": "core::integer::u256"
          },
          {
            "name": "end",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::array::Array::<core::starknet::contract_address::ContractAddress>"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "PairHooksImpl",
    "interface_name": "lssvm_interfaces::hooks::IPairHooks"
  },
  {
    "type": "interface",
    "name": "lssvm_interfaces::hooks::IPairHooks",
    "items": [
      {
        "type": "function",
        "name": "after_new_pair",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "after_swap_nft_in_pair",
        "inputs": [
          {
            "name": "tokens_out",
            "type": "core::integer::u256"
          },
          {
            "name": "tokens_out_protocol_fee",
            "type": "core::integer::u256"
          },
          {
            "name": "tokens_out_royalty",
            "type": "core::integer::u256"
          },
          {
            "name": "nfts_in",
            "type": "core::array::Array::<core::integer::u256>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "after_swap_nft_out_pair",
        "inputs": [
          {
            "name": "tokens_in",
            "type": "core::integer::u256"
          },
          {
            "name": "tokens_in_protocol_fee",
            "type": "core::integer::u256"
          },
          {
            "name": "tokens_in_royalty",
            "type": "core::integer::u256"
          },
          {
            "name": "nfts_out",
            "type": "core::array::Array::<core::integer::u256>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "after_delta_update",
        "inputs": [
          {
            "name": "old_delta",
            "type": "core::integer::u128"
          },
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
        "name": "after_spot_price_update",
        "inputs": [
          {
            "name": "old_spot_price",
            "type": "core::integer::u128"
          },
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
        "name": "after_fee_update",
        "inputs": [
          {
            "name": "old_fee",
            "type": "core::integer::u128"
          },
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
        "name": "after_nft_withdrawal",
        "inputs": [
          {
            "name": "nfts_out",
            "type": "core::array::Array::<core::integer::u256>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "after_token_withdrawal",
        "inputs": [
          {
            "name": "tokens_out",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "sync_for_pair",
        "inputs": [
          {
            "name": "pair_address",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "tokens_in",
            "type": "core::integer::u256"
          },
          {
            "name": "nfts_in",
            "type": "core::array::Array::<core::integer::u256>"
          }
        ],
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
        "name": "factory",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "event",
    "name": "lssvm_hooks::listing_book::ListingBook::Event",
    "kind": "enum",
    "variants": []
  }
];
