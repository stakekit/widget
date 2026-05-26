import { faker } from "@faker-js/faker";
import type {
  YieldActionDto,
  YieldTransactionDto,
} from "../../src/domain/types/action";
import { EvmNetworks } from "../../src/domain/types/chains/networks";
import type { YieldBalanceDto } from "../../src/domain/types/positions";
import type { YieldRewardRateDto } from "../../src/domain/types/reward-rate";
import type { YieldValidatorDto } from "../../src/domain/types/validators";
import type { Yield } from "../../src/domain/types/yields";
import type { TokenDto as LegacyTokenDto } from "../../src/generated/api/legacy";
import type { NetworkDto as YieldApiNetworkDto } from "../../src/generated/api/yield";

type YieldApiYieldDto = Omit<Yield, "__fallback__">;
type LegacyYieldDto = Yield["__fallback__"];

const apyFaker = () => faker.number.float({ min: 0, max: 0.05 });

export const yieldRewardRateFixture = (
  overrides?: Partial<YieldRewardRateDto>
): YieldRewardRateDto => ({
  total: apyFaker(),
  rateType: "APY",
  components: [],
  ...overrides,
});

const yieldApiTokenFixture = (
  overrides?: Partial<YieldApiYieldDto["token"]>
): YieldApiYieldDto["token"] => ({
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  coinGeckoId: "ethereum",
  logoURI: "https://assets.stakek.it/tokens/eth.svg",
  ...overrides,
});

const miscNetworks = new Set<YieldApiNetworkDto["id"]>([
  "aptos",
  "cardano",
  "near",
  "solana",
  "solana-devnet",
  "stellar",
  "stellar-testnet",
  "sui",
  "tezos",
  "tron",
  "ton",
  "ton-testnet",
  "hyperliquid",
]);

const substrateNetworks = new Set<YieldApiNetworkDto["id"]>([
  "polkadot",
  "kusama",
  "westend",
  "bittensor",
]);

const getYieldApiNetworkCategory = (
  id: YieldApiNetworkDto["id"]
): YieldApiNetworkDto["category"] => {
  if (miscNetworks.has(id)) return "misc";
  if (substrateNetworks.has(id)) return "substrate";
  if (
    [
      "ethereum",
      "ethereum-goerli",
      "ethereum-holesky",
      "ethereum-sepolia",
      "ethereum-hoodi",
      "arbitrum",
      "base",
      "base-sepolia",
      "gnosis",
      "optimism",
      "polygon",
      "polygon-amoy",
      "starknet",
      "zksync",
      "linea",
      "unichain",
      "monad-testnet",
      "monad",
      "avalanche-c",
      "avalanche-c-atomic",
      "avalanche-p",
      "binance",
      "celo",
      "fantom",
      "harmony",
      "moonriver",
      "okc",
      "viction",
      "core",
      "sonic",
      "plasma",
      "katana",
      "hyperevm",
    ].includes(id)
  ) {
    return "evm";
  }

  return "cosmos";
};

export const yieldApiNetworkFixture = (
  overrides?: Partial<YieldApiNetworkDto>
): YieldApiNetworkDto => {
  const id = overrides?.id ?? "ethereum";

  return {
    id,
    name: id,
    category: getYieldApiNetworkCategory(id),
    logoURI: `https://assets.stakek.it/networks/${id}.svg`,
    ...overrides,
  };
};

type YieldRiskSummaryDto = NonNullable<YieldApiYieldDto["risk"]>;
type YieldRiskEntryDto = YieldRiskSummaryDto["ratings"][number];

const yieldRiskEntryFixture = (
  overrides?: Partial<YieldRiskEntryDto>
): YieldRiskEntryDto => ({
  rating: "A-",
  source: "credora",
  ...overrides,
});

export const yieldRiskSummaryFixture = (
  overrides?: Partial<YieldRiskSummaryDto>
): YieldRiskSummaryDto => ({
  ratings: [yieldRiskEntryFixture()],
  ...overrides,
});

export const yieldApiYieldFixture = (
  overrides?: Partial<YieldApiYieldDto>
): YieldApiYieldDto => {
  const token = overrides?.token ?? yieldApiTokenFixture();
  const tokens = overrides?.tokens ?? [token];

  return {
    id: "ethereum-eth-native-staking",
    network: token.network,
    inputTokens: overrides?.inputTokens ?? tokens,
    outputToken: overrides?.outputToken ?? token,
    token,
    tokens,
    rewardRate: yieldRewardRateFixture(overrides?.rewardRate),
    status: { enter: true, exit: true },
    metadata: {
      name: "Ethereum Staking",
      description: "Stake ETH",
      documentation: "https://docs.stakek.it",
      logoURI: token.logoURI ?? "",
      underMaintenance: false,
      deprecated: false,
      supportedStandards: [],
      supportsCampaigns: false,
    },
    mechanics: {
      type: "staking",
      requiresValidatorSelection: false,
      rewardSchedule: "day",
      rewardClaiming: "auto",
      gasFeeToken: token,
      arguments: {
        enter: {
          fields: [],
        },
        exit: {
          fields: [],
        },
      },
    },
    providerId: "stakekit",
    validators: [],
    ...overrides,
  } as YieldApiYieldDto;
};

export const yieldApiValidatorFixture = (
  overrides?: Partial<YieldValidatorDto>
): YieldValidatorDto => ({
  address: faker.finance.ethereumAddress(),
  commission: 0,
  logoURI: "https://assets.stakek.it/validators/default.png",
  name: "StakeKit Validator",
  preferred: false,
  rewardRate: yieldRewardRateFixture({ rateType: "APR" }),
  status: "active",
  ...overrides,
});

export const yieldBalanceFixture = (
  overrides?: Partial<YieldBalanceDto>
): YieldBalanceDto => {
  const token = overrides?.token ?? yieldApiYieldFixture().token;

  return {
    address: faker.finance.ethereumAddress(),
    type: "active",
    amount: "1",
    amountRaw: "1000000000000000000",
    pendingActions: [],
    token,
    isEarning: true,
    ...overrides,
  } as YieldBalanceDto;
};

export const legacyYieldFixture = (
  overrides?: Partial<LegacyYieldDto>
): LegacyYieldDto => {
  const token: LegacyTokenDto = {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    network: EvmNetworks.Ethereum,
    coinGeckoId: "ethereum",
    logoURI: "https://assets.stakek.it/tokens/eth.svg",
  };

  return {
    id: "ethereum-eth-native-staking",
    token,
    tokens: [token],
    rewardRate: apyFaker(),
    rewardType: "apy",
    apy: apyFaker(),
    args: {
      enter: {
        args: {
          providerId: { required: false, options: [] },
        },
      },
    },
    feeConfigurations: [],
    metadata: {
      commission: [],
      description: "Stake ETH",
      documentation: "https://docs.stakek.it",
      fee: {
        depositFee: false,
        enabled: false,
        managementFee: false,
        performanceFee: false,
      },
      gasFeeToken: token,
      logoURI: "https://assets.stakek.it/yields/ethereum.svg",
      minimumStake: 0,
      name: "Ethereum Staking",
      provider: {
        id: "stakekit",
        name: "StakeKit",
        description: "",
        externalLink: "https://stakek.it",
        logoURI: "https://assets.stakek.it/providers/stakekit.svg",
      },
      revshare: { enabled: false },
      rewardClaiming: "auto",
      rewardSchedule: "day",
      rewardTokens: [],
      token,
      tokens: [token],
      tvl: [{ level: "network", value: "1000000000000000000" }],
      type: "staking",
      warmupPeriod: { days: 0 },
      isIntegrationAggregator: false,
    },
    status: { enter: true, exit: true },
    validators: [],
    isAvailable: true,
    ...overrides,
  } as LegacyYieldDto;
};

export const yieldApiValidatorsFixture = (
  validators?: Partial<YieldValidatorDto>[]
): YieldValidatorDto[] =>
  (validators?.length ? validators : [{}]).map((validator) =>
    yieldApiValidatorFixture(validator)
  );

export const yieldApiTransactionFixture = (
  overrides?: Partial<YieldTransactionDto>
): YieldTransactionDto =>
  ({
    id: faker.string.uuid(),
    title: "Stake",
    network: "ethereum",
    status: "CREATED",
    type: "STAKE",
    hash: null,
    createdAt: new Date(0).toISOString(),
    broadcastedAt: null,
    signedTransaction: null,
    unsignedTransaction: null,
    stepIndex: 0,
    annotatedTransaction: null,
    structuredTransaction: null,
    explorerUrl: null,
    isMessage: false,
    ...overrides,
  }) as YieldTransactionDto;

export const yieldApiActionFixture = (
  overrides?: Partial<YieldActionDto>
): YieldActionDto => {
  const type = overrides?.type ?? "STAKE";
  const intent =
    overrides?.intent ??
    (type === "STAKE" ? "enter" : type === "UNSTAKE" ? "exit" : "manage");

  return {
    id: faker.string.uuid(),
    intent,
    type,
    yieldId: "ethereum-eth-native-staking",
    address: faker.finance.ethereumAddress(),
    amount: null,
    amountRaw: null,
    amountUsd: null,
    transactions: [
      yieldApiTransactionFixture({ type: type as YieldTransactionDto["type"] }),
    ],
    executionPattern: "synchronous",
    rawArguments: null,
    createdAt: new Date(0).toISOString(),
    completedAt: null,
    status: "CREATED",
    ...overrides,
  } as YieldActionDto;
};
