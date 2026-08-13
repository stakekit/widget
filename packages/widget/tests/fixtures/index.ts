import { faker } from "@faker-js/faker";
import { DateTime, Schema } from "effect";
import { ActionTransaction, YieldAction } from "../../src/domain/action/models";
import type {
  EarnBalance,
  EarnProvider,
  EarnValidator,
} from "../../src/domain/earn/models";
import {
  EarnProvider as EarnProviderSchema,
  EarnYield,
} from "../../src/domain/earn/models";
import type { YieldRewardRate } from "../../src/domain/earn/reward-rate";
import { EvmNetworks } from "../../src/domain/network/networks";
import type {
  TokenDto as LegacyTokenDto,
  YieldDto as LegacyYieldDto,
} from "../generated/legacy-api-types";
import type { YieldDto as YieldApiYieldDto } from "../generated/yield-api-types";

type ValidatorDto = typeof EarnValidator.Encoded;
type YieldApiProviderDto = typeof EarnProvider.Encoded;
const apyFaker = () => faker.number.float({ min: 0, max: 0.05 });

export const yieldRewardRateFixture = (
  overrides?: Partial<YieldRewardRate>
): YieldRewardRate => ({
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

export const yieldApiYieldDtoFixture = (
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
    ...overrides,
  };
};

export const yieldApiYieldFixture = (
  overrides?: Partial<YieldApiYieldDto>
): typeof EarnYield.Type =>
  Schema.decodeUnknownSync(EarnYield)(yieldApiYieldDtoFixture(overrides));

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

export const yieldApiTransactionDtoFixture = (
  overrides?: Partial<typeof ActionTransaction.Encoded>
): typeof ActionTransaction.Encoded => ({
  id: faker.string.uuid(),
  title: "Stake",
  network: "ethereum",
  status: "CREATED",
  type: "STAKE",
  hash: null,
  createdAt: "2100-01-01T00:00:00.000Z",
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

type TransactionFixtureOverrides = Partial<
  Omit<typeof ActionTransaction.Type, "id">
> & {
  readonly id?: string;
};

export const yieldApiTransactionFixture = (
  overrides?: TransactionFixtureOverrides
): typeof ActionTransaction.Type => {
  const transaction = Schema.decodeUnknownSync(ActionTransaction)(
    yieldApiTransactionDtoFixture()
  );

  return {
    ...transaction,
    ...overrides,
  } as typeof ActionTransaction.Type;
};

export const yieldApiActionDtoFixture = (
  overrides?: Partial<typeof YieldAction.Encoded>
): typeof YieldAction.Encoded => {
  const type = overrides?.type ?? "STAKE";
  const intent = overrides?.intent ?? getYieldActionIntent(type);

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
      yieldApiTransactionDtoFixture({
        type: type as (typeof ActionTransaction.Type)["type"],
      }),
    ],
    executionPattern: "synchronous",
    rawArguments: null,
    createdAt: "2100-01-01T00:00:00.000Z",
    completedAt: null,
    status: "CREATED",
    ...overrides,
  };
};

type ActionFixtureOverrides = Partial<
  Omit<
    typeof YieldAction.Type,
    | "address"
    | "completedAt"
    | "createdAt"
    | "id"
    | "rawArguments"
    | "transactions"
    | "yieldId"
  >
> & {
  readonly address?: string;
  readonly completedAt?: DateTime.Utc | null;
  readonly createdAt?: DateTime.Utc;
  readonly id?: string;
  readonly rawArguments?: typeof YieldAction.Encoded.rawArguments;
  readonly transactions?: ReadonlyArray<typeof ActionTransaction.Type>;
  readonly yieldId?: string;
};

export const yieldApiActionFixture = (
  overrides?: ActionFixtureOverrides
): typeof YieldAction.Type => {
  const type = overrides?.type ?? "STAKE";
  const intent = overrides?.intent ?? getYieldActionIntent(type);
  const { completedAt, createdAt, transactions, ...rest } = overrides ?? {};

  return Schema.decodeUnknownSync(YieldAction)({
    ...yieldApiActionDtoFixture(),
    ...rest,
    ...(completedAt === undefined
      ? {}
      : {
          completedAt:
            completedAt === null ? null : DateTime.formatIso(completedAt),
        }),
    ...(createdAt === undefined
      ? {}
      : { createdAt: DateTime.formatIso(createdAt) }),
    intent,
    ...(transactions
      ? {
          transactions: transactions.map((transaction) =>
            Schema.encodeSync(ActionTransaction)(transaction)
          ),
        }
      : {}),
    type,
  });
};

const getYieldActionIntent = (type: (typeof YieldAction.Type)["type"]) => {
  if (type === "STAKE") return "enter" as const;
  if (type === "UNSTAKE") return "exit" as const;
  return "manage" as const;
};
