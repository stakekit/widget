export const opportunities: any[] = [
  {
    id: "ethereum-eth-lido-staking",
    token: {
      network: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coinGeckoId: "ethereum",
      logoURI:
        "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/eth.png",
    },
    config: {
      type: "liquid-staking",
      rewardSchedule: "day",
      warmupPeriod: { days: 0 },
      cooldownPeriod: { days: 0 },
      rewardClaiming: "auto",
      fee: { enabled: true },
      revshare: { enabled: true },
    },
    apy: 0.044016396588880874,
    validators: [],
    metadata: {
      rewardTokens: [
        {
          network: "ethereum",
          name: "Lido Staked Ether",
          decimals: 18,
          address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
          symbol: "stETH",
          logoURI:
            "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/steth.png",
        },
      ],
      gasFeeToken: {
        network: "ethereum",
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
        coinGeckoId: "ethereum",
        logoURI:
          "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/eth.png",
      },

      description: "Stake ETH and earn stETH",
      logoURI:
        "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/steth.png",
      name: "Lido",
      provider: {
        id: "lido",
        name: "Lido",
        description: "",
        externalLink: "https://lido.fi/",
        logoURI: "",
      },
    },
    args: {
      enter: {
        addresses: { address: { required: true, network: "ethereum" } },
        args: { amount: { required: true, minimum: 0 } },
      },
    },
    status: { enter: false, exit: false },
  },
  {
    id: "avalanche-avax-liquid-staking",
    token: {
      name: "Avalanche C Chain",
      symbol: "AVAX",
      decimals: 18,
      network: "avalanche-c",
      coinGeckoId: "avalanche-2",
      logoURI:
        "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/avax.png",
    },
    validators: [],
    config: {
      type: "liquid-staking",
      rewardSchedule: "day",
      warmupPeriod: { days: 0 },
      cooldownPeriod: { days: 15 },
      withdrawPeriod: { days: 2 },
      rewardClaiming: "auto",
      supportsMultipleValidators: false,
      fee: { enabled: true },
      revshare: { enabled: true },
    },
    apy: 0.072,
    metadata: {
      gasFeeToken: {
        name: "Avalanche C Chain",
        symbol: "AVAX",
        decimals: 18,
        network: "avalanche-c",
        coinGeckoId: "avalanche-2",
        logoURI:
          "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/avax.png",
      },
      rewardTokens: [
        {
          name: "Staked AVAX",
          symbol: "sAVAX",
          decimals: 18,
          network: "avalanche-c",
          logoURI:
            "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/savax.png",
          address: "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
        },
      ],
      name: "Benqi",
      description: "test",
      logoURI: "",
      provider: {
        id: "benqi",
        name: "Benqi",
        description: "test",
        externalLink: "https://benqi.fi/",
        logoURI: "",
      },
    },
    args: {
      enter: {
        addresses: {
          address: { required: true, network: "avalanche-c" },
        },
        args: { amount: { required: true, minimum: 0 } },
      },
      exit: {
        addresses: {
          address: { required: true, network: "avalanche-c" },
        },
        args: { amount: { required: true, minimum: 0 } },
      },
    },
    status: { enter: true, exit: true },
  },
  {
    id: "ethereum-grt-native-staking",
    token: {
      name: "The Graph",
      symbol: "GRT",
      address: "0xc944E90C64B2c07662A292be6244BDf05Cda44a7",
      decimals: 18,
      network: "ethereum",
      coinGeckoId: "the-graph",
      logoURI:
        "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/grt.png",
    },
    validators: [],
    metadata: {
      name: "The Graph",
      description: "Stake GRT and earn GRT",
      logoURI: "",

      gasFeeToken: {
        network: "ethereum",
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
        coinGeckoId: "ethereum",
        logoURI:
          "https://raw.githubusercontent.com/steakwallet/assets/master/tokenicons/eth.png",
      },
    },
    config: {
      type: "staking",
      rewardSchedule: "day",
      warmupPeriod: { days: 0 },
      cooldownPeriod: { days: 28 },
      rewardClaiming: "auto",
      supportsMultipleValidators: false,
      fee: { enabled: true },
      revshare: { enabled: true },
    },
    apy: -0.005,
    args: {
      enter: {
        addresses: { address: { required: true, network: "ethereum" } },
        args: {
          amount: { required: true, minimum: 0 },
          validatorAddress: { required: true },
        },
      },
      exit: {
        addresses: { address: { required: true, network: "ethereum" } },
        args: {
          amount: { required: true, minimum: 0 },
          validatorAddress: { required: true },
        },
      },
    },
    status: { enter: true, exit: true },
  },
];
