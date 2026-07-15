import { faker } from "@faker-js/faker";
import { Schema } from "effect";
import {
  ActionTransaction,
  YieldAction,
} from "../../src/domain/schema/action-models";
import type {
  EarnBalance,
  EarnProvider,
  EarnValidator,
} from "../../src/domain/schema/earn-models";
import {
  EarnProvider as EarnProviderSchema,
  EarnYield,
} from "../../src/domain/schema/earn-models";
import { EvmNetworks } from "../../src/domain/types/chains/networks";
import type { YieldRewardRateDto } from "../../src/domain/types/reward-rate";
import type {
  TokenDto as LegacyTokenDto,
  YieldDto as LegacyYieldDto,
} from "../generated/legacy-api-types";

type ValidatorDto = typeof EarnValidator.Encoded;
type YieldApiProviderDto = typeof EarnProvider.Encoded;
type YieldApiYieldDto = typeof EarnYield.Encoded;

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

export const yieldApiProviderFixture = (
  overrides?: Partial<YieldApiProviderDto>
): EarnProvider =>
  Schema.decodeUnknownSync(EarnProviderSchema)({
    id: "stakekit",
    name: "StakeKit",
    description: "",
    logoURI: "https://assets.stakek.it/app/composition/providers/stakekit.svg",
    website: "https://stakek.it",
    tvlUsd: null,
    type: "protocol",
    ...overrides,
  });

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
): typeof EarnYield.Type => {
  const token = overrides?.token ?? yieldApiTokenFixture();
  const tokens = overrides?.tokens ?? [token];

  return Schema.decodeUnknownSync(EarnYield)({
    id: "ethereum-eth-native-staking",
    network: token.network,
    inputTokens: overrides?.inputTokens ?? tokens,
    outputToken: overrides?.outputToken ?? token,
    token,
    tokens,
    rewardRate: overrides?.rewardRate ?? yieldRewardRateFixture(),
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
      requirements: {
        kycRequired: false,
      },
      arguments: {
        enter: {
          fields: [],
        },
        exit: {
          fields: [],
        },
      },
    },
    prime: false,
    providerId: "stakekit",
    validators: [],
    ...overrides,
  });
};

export const yieldApiValidatorFixture = (
  overrides?: Partial<ValidatorDto>
): ValidatorDto => ({
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
  overrides?: Partial<typeof EarnBalance.Encoded>
): typeof EarnBalance.Encoded => {
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
  } as typeof EarnBalance.Encoded;
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
        logoURI:
          "https://assets.stakek.it/app/composition/providers/stakekit.svg",
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
  validators?: Partial<ValidatorDto>[]
): ValidatorDto[] =>
  (validators?.length ? validators : [{}]).map((validator) =>
    yieldApiValidatorFixture(validator)
  );

export const yieldApiTransactionFixture = (
  overrides?: Partial<typeof ActionTransaction.Encoded>
): typeof ActionTransaction.Type =>
  Schema.decodeUnknownSync(ActionTransaction)({
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
  });

export const yieldApiActionFixture = (
  overrides?: Partial<typeof YieldAction.Encoded>
): typeof YieldAction.Type => {
  const type = overrides?.type ?? "STAKE";
  const intent =
    overrides?.intent ??
    (type === "STAKE" ? "enter" : type === "UNSTAKE" ? "exit" : "manage");

  return Schema.decodeUnknownSync(YieldAction)({
    id: faker.string.uuid(),
    intent,
    type,
    yieldId: "ethereum-eth-native-staking",
    address: faker.finance.ethereumAddress(),
    amount: null,
    amountRaw: null,
    amountUsd: null,
    transactions: [
      yieldApiTransactionFixture({
        type: type as (typeof ActionTransaction.Type)["type"],
      }),
    ],
    executionPattern: "synchronous",
    rawArguments: null,
    createdAt: new Date(0).toISOString(),
    completedAt: null,
    status: "CREATED",
    ...overrides,
  });
};
