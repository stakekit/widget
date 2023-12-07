const chain = {
  $schema: "../chain.schema.json",
  chain_name: "dydx",
  status: "live",
  website: "https://dydx.exchange/",
  network_type: "mainnet",
  pretty_name: "dYdX Protocol",
  chain_id: "dydx-mainnet-1",
  bech32_prefix: "dydx",
  daemon_name: "dydxprotocold",
  node_home: "$HOME/.dydxprotocol",
  key_algos: ["secp256k1"],
  slip44: 118,
  fees: {
    fee_tokens: [
      {
        denom: "adydx",
        fixed_min_gas_price: 12500000000,
        low_gas_price: 12500000000,
        average_gas_price: 12500000000,
        high_gas_price: 20000000000,
      },
      {
        denom:
          "ibc/8E27BA2D5493AF5636760E354E46004562C46AB7EC0CC4C1CA14E9E20E2545B5",
        fixed_min_gas_price: 0.025,
        low_gas_price: 0.025,
        average_gas_price: 0.025,
        high_gas_price: 0.03,
      },
    ],
  },
  staking: {
    staking_tokens: [
      {
        denom: "adydx",
      },
    ],
  },
  codebase: {
    git_repo: "https://github.com/dydxprotocol/v4-chain/",
    recommended_version: "v1.0.1",
    compatible_versions: ["v1.0.0", "v1.0.1"],
    cosmos_sdk_version: "v0.47.4",
    cosmwasm_enabled: false,
    genesis: {
      genesis_url:
        "https://raw.githubusercontent.com/dydxopsdao/networks/main/dydx-mainnet-1/genesis.json",
    },
    versions: [
      {
        name: "v1",
        recommended_version: "v1.0.1",
        compatible_versions: ["v1.0.0", "v1.0.1"],
        cosmos_sdk_version: "v0.47.4",
      },
    ],
  },
  logo_URIs: {
    png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.png",
    svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.svg",
  },
  description:
    "Our goal is to build open source code that can power a first class product and trading experience.",
  peers: {
    seeds: [
      {
        id: "20e1000e88125698264454a884812746c2eb4807",
        address: "seeds.lavenderfive.com:23856",
        provider: "Lavender.Five Nodes 🐝",
      },
      {
        id: "ebc272824924ea1a27ea3183dd0b9ba713494f83",
        address: "dydx-mainnet-seed.autostake.com:27366",
        provider: "AutoStake 🛡️ Slash Protected",
      },
      {
        id: "65b740ee326c9260c30af1f044e9cda63c73f7c1",
        address: "seeds.kingnodes.net:23856",
        provider: "Kingnodes",
      },
      {
        id: "4c30c8a95e26b07b249813b677caab28bf0c54eb",
        address: "rpc.dydx.nodestake.top:666",
        provider: "NodeStake",
      },
      {
        id: "400f3d9e30b69e78a7fb891f60d76fa3c73f0ecc",
        address: "dydx.rpc.kjnodes.com:17059",
        provider: "kjnodes",
      },
      {
        id: "8542cd7e6bf9d260fef543bc49e59be5a3fa9074",
        address: "seed.publicnode.com:26656",
        provider: "Allnodes ⚡️ Nodes & Staking",
      },
      {
        id: "e726816f42831689eab9378d5d577f1d06d25716",
        address: "seeds.kingnodes.net:23856",
        provider: "Kingnodes",
      },
      {
        id: "4f20c3e303c9515051b6276aeb89c0b88ee79f8f",
        address: "seed.dydx.cros-nest.com:26656",
        provider: "Crosnest",
      },
    ],
    persistent_peers: [
      {
        id: "ebc272824924ea1a27ea3183dd0b9ba713494f83",
        address: "dydx-mainnet-peer.autostake.com:27366",
        provider: "AutoStake 🛡️ Slash Protected",
      },
    ],
  },
  apis: {
    rpc: [
      {
        address: "https://dydx-rpc.lavenderfive.com:443",
        provider: "Lavender.Five Nodes 🐝",
      },
      {
        address: "https://dydx-mainnet-rpc.autostake.com:443",
        provider: "AutoStake 🛡️ Slash Protected",
      },
      {
        address: "https://rpc-dydx.ecostake.com:443",
        provider: "ecostake",
      },
      {
        address: "https://rpc.dydx.nodestake.top:443",
        provider: "NodeStake",
      },
      {
        address: "https://rpc-dydx.cosmos-spaces.cloud",
        provider: "Cosmos Spaces",
      },
      {
        address: "https://dydx.rpc.kjnodes.com:443",
        provider: "kjnodes",
      },
      {
        address: "https://dydx-rpc.publicnode.com:443",
        provider: "Allnodes ⚡️ Nodes & Staking",
      },
      {
        address: "https://dydx-rpc.kingnodes.com:443",
        provider: "Kingnodes",
      },
      {
        address: "https://rpc-dydx.cros-nest.com:443",
        provider: "Crosnest",
      },
      {
        address: "https://dydx-rpc.enigma-validator.com",
        provider: "Enigma",
      },
    ],
    rest: [
      {
        address: "https://dydx-api.lavenderfive.com:443",
        provider: "Lavender.Five Nodes 🐝",
      },
      {
        address: "https://dydx-mainnet-lcd.autostake.com:443",
        provider: "AutoStake 🛡️ Slash Protected",
      },
      {
        address: "https://rest-dydx.ecostake.com:443",
        provider: "ecostake",
      },
      {
        address: "https://api-dydx.cosmos-spaces.cloud",
        provider: "Cosmos Spaces",
      },
      {
        address: "https://api.dydx.nodestake.top:443",
        provider: "NodeStake",
      },
      {
        address: "https://dydx.api.kjnodes.com:443",
        provider: "kjnodes",
      },
      {
        address: "https://dydx-rest.publicnode.com",
        provider: "Allnodes ⚡️ Nodes & Staking",
      },
      {
        address: "https://dydx-rest.kingnodes.com:443",
        provider: "Kingnodes",
      },
      {
        address: "https://rest-dydx.cros-nest.com:443",
        provider: "Crosnest",
      },
      {
        address: "https://dydx-lcd.enigma-validator.com",
        provider: "Enigma",
      },
    ],
    grpc: [
      {
        address: "https://dydx-grpc.lavenderfive.com",
        provider: "Lavender.Five Nodes 🐝",
      },
      {
        address: "dydx-mainnet-grpc.autostake.com:443",
        provider: "AutoStake 🛡️ Slash Protected",
      },
      {
        address: "https://grpc.dydx.nodestake.top",
        provider: "NodeStake",
      },
      {
        address: "dydx.grpc.kjnodes.com:443",
        provider: "kjnodes",
      },
      {
        address: "grpc-dydx.cosmos-spaces.cloud:4990",
        provider: "Cosmos Spaces",
      },
      {
        address: "dydx-grpc.publicnode.com:443",
        provider: "Allnodes ⚡️ Nodes & Staking",
      },
      {
        address: "https://dydx-grpc.kingnodes.com:443",
        provider: "Kingnodes",
      },
    ],
  },
  explorers: [
    {
      kind: "mintscan",
      url: "https://www.mintscan.io/dydx",
      tx_page: "https://www.mintscan.io/dydx/txs/${txHash}",
      account_page: "https://www.mintscan.io/dydx/account/${accountAddress}",
    },
    {
      kind: "NodeStake",
      url: "https://explorer.nodestake.top/dydx/",
      tx_page: "https://explorer.nodestake.top/dydx/txs/${txHash}",
      account_page:
        "https://explorer.nodestake.top/dydx/account/${accountAddress}",
    },
    {
      kind: "TC Network",
      url: "https://explorer.tcnetwork.io/dydx",
      tx_page: "https://explorer.tcnetwork.io/dydx/transaction/${txHash}",
      account_page:
        "https://explorer.tcnetwork.io/dydx/account/${accountAddress}",
    },
  ],
  images: [
    {
      png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.png",
      svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.svg",
    },
  ],
};

const asset = {
  $schema: "../assetlist.schema.json",
  chain_name: "dydx",
  assets: [
    {
      description: "The native staking token of dYdX Protocol.",
      denom_units: [
        {
          denom: "adydx",
          exponent: 0,
        },
        {
          denom: "dydx",
          exponent: 18,
        },
      ],
      base: "adydx",
      name: "dYdX",
      display: "dydx",
      symbol: "DYDX",
      logo_URIs: {
        png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.png",
        svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.svg",
      },
      coingecko_id: "dydx",
      images: [
        {
          png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.png",
          svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx.svg",
        },
        {
          svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/dydx/images/dydx-circle.svg",
          theme: {
            circle: true,
          },
        },
      ],
    },
    {
      description: "Noble USDC on dYdX Protocol.",
      denom_units: [
        {
          denom:
            "ibc/8E27BA2D5493AF5636760E354E46004562C46AB7EC0CC4C1CA14E9E20E2545B5",
          exponent: 0,
        },
        {
          denom: "usdc",
          exponent: 6,
        },
      ],
      type_asset: "ics20",
      base: "ibc/8E27BA2D5493AF5636760E354E46004562C46AB7EC0CC4C1CA14E9E20E2545B5",
      name: "Noble USDC",
      display: "usdc",
      symbol: "USDC",
      traces: [
        {
          type: "ibc",
          counterparty: {
            chain_name: "noble",
            base_denom: "uusdc",
            channel_id: "channel-33",
          },
          chain: {
            channel_id: "channel-0",
            path: "transfer/channel-0/uusdc",
          },
        },
      ],
      images: [
        {
          image_sync: {
            chain_name: "noble",
            base_denom: "uusdc",
          },
          png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.png",
          svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.svg",
        },
      ],
      logo_URIs: {
        png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.png",
        svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/USDCoin.svg",
      },
    },
  ],
};

module.exports = {
  chain,
  asset,
};
