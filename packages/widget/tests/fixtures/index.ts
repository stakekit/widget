import { DateTime, Effect, Random, Schema } from "effect";
import { Arbitrary } from "effect/unstable/arbitrary";
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
import { exactDecimal } from "../../src/domain/finance/exact";
import type {
  TokenDto as LegacyTokenDto,
  YieldDto as LegacyYieldDto,
} from "../generated/legacy-api-types";
import type { YieldDto as YieldApiYieldDto } from "../generated/yield-api-types";

type ValidatorDto = typeof EarnValidator.Encoded;
type YieldApiProviderDto = typeof EarnProvider.Encoded;
// ast-grep-ignore: no-run-effect-in-test -- synchronous fixture helper for random APY values
const apyFaker = () => Effect.runSync(Random.nextBetween(0, 0.05));

const ethereumAddressArbitrary = Arbitrary.schema(
  Schema.String.check(Schema.isPattern(/^0x[a-f0-9]{40}$/))
);
const ethereumAddressFaker = () =>
  // ast-grep-ignore: no-run-effect-in-test -- synchronous fixture helper for generated addresses
  Effect.runSync(
    Arbitrary.sampleEffect(ethereumAddressArbitrary, { count: 1 })
  )[0]!;

const uuidArbitrary = Arbitrary.schema(Schema.String.check(Schema.isUUID(4)));
const uuidFaker = () =>
  // ast-grep-ignore: no-run-effect-in-test -- synchronous fixture helper for generated UUIDs
  Effect.runSync(Arbitrary.sampleEffect(uuidArbitrary, { count: 1 }))[0]!;

type ExactDecimalFixtureInput = Parameters<typeof exactDecimal>[0];
type YieldRewardComponent = YieldRewardRate["components"][number];
type YieldRewardComponentFixtureInput = Omit<YieldRewardComponent, "rate"> & {
  readonly rate: ExactDecimalFixtureInput;
};
type YieldRewardRateFixtureInput = Omit<
  Partial<YieldRewardRate>,
  "components" | "total"
> & {
  readonly components?: ReadonlyArray<YieldRewardComponentFixtureInput>;
  readonly total?: ExactDecimalFixtureInput;
};

export const yieldRewardRateFixture = (
  overrides?: YieldRewardRateFixtureInput
): YieldRewardRate => {
  const { components = [], total = apyFaker(), ...rest } = overrides ?? {};

  return {
    rateType: "APY",
    ...rest,
    total: exactDecimal(total),
    components: components.map((component) => ({
      ...component,
      rate: exactDecimal(component.rate),
    })),
  };
};

const yieldRewardRateDtoFixture = (): YieldApiYieldDto["rewardRate"] => ({
  total: apyFaker(),
  rateType: "APY",
  components: [],
});

export const encodeYieldRewardRateFixture = (
  rewardRate:
    | YieldRewardRateFixtureInput
    | NonNullable<YieldApiYieldDto["rewardRate"]>
    | NonNullable<ValidatorDto["rewardRate"]>
): NonNullable<ValidatorDto["rewardRate"]> => {
  return {
    rateType: rewardRate.rateType ?? "APY",
    total: exactDecimal(rewardRate.total ?? apyFaker()).toNumber(),
    components: (rewardRate.components ?? []).map((component) => ({
      ...component,
      rate: exactDecimal(component.rate).toNumber(),
    })),
  };
};

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
  Schema.decodeSync(EarnProviderSchema)({
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
    rewardRate: overrides?.rewardRate ?? yieldRewardRateDtoFixture(),
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
  overrides?: Omit<Partial<YieldApiYieldDto>, "rewardRate"> & {
    readonly rewardRate?:
      | YieldRewardRateFixtureInput
      | NonNullable<YieldApiYieldDto["rewardRate"]>;
  }
): EarnYield => {
  const { rewardRate, ...rest } = overrides ?? {};
  const wire = yieldApiYieldDtoFixture(rest);

  return Schema.decodeSync(EarnYield)(
    rewardRate
      ? { ...wire, rewardRate: encodeYieldRewardRateFixture(rewardRate) }
      : wire
  );
};

export const yieldApiValidatorFixture = (
  overrides?: Omit<Partial<ValidatorDto>, "rewardRate"> & {
    readonly rewardRate?:
      | YieldRewardRateFixtureInput
      | NonNullable<ValidatorDto["rewardRate"]>;
  }
): ValidatorDto => {
  const { rewardRate, ...rest } = overrides ?? {};

  return {
    address: ethereumAddressFaker(),
    commission: 0,
    logoURI: "https://assets.stakek.it/validators/default.png",
    name: "StakeKit Validator",
    preferred: false,
    rewardRate: encodeYieldRewardRateFixture(rewardRate ?? { rateType: "APR" }),
    status: "active",
    ...rest,
  };
};

export const yieldBalanceFixture = (
  overrides?: Partial<typeof EarnBalance.Encoded>
): typeof EarnBalance.Encoded => {
  const token = overrides?.token ?? yieldApiYieldFixture().token;

  return {
    address: ethereumAddressFaker(),
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
    network: "ethereum",
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
  id: uuidFaker(),
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

type TransactionFixtureOverrides = Partial<Omit<ActionTransaction, "id">> & {
  readonly id?: string;
};

export const yieldApiTransactionFixture = (
  overrides?: TransactionFixtureOverrides
): ActionTransaction => {
  const transaction = Schema.decodeSync(ActionTransaction)(
    yieldApiTransactionDtoFixture()
  );

  return {
    ...transaction,
    ...overrides,
  } as ActionTransaction;
};

export const yieldApiActionDtoFixture = (
  overrides?: Partial<typeof YieldAction.Encoded>
): typeof YieldAction.Encoded => {
  const type = overrides?.type ?? "STAKE";
  const intent = overrides?.intent ?? getYieldActionIntent(type);

  return {
    id: uuidFaker(),
    intent,
    type,
    yieldId: "ethereum-eth-native-staking",
    address: ethereumAddressFaker(),
    amount: null,
    amountRaw: null,
    amountUsd: null,
    transactions: [
      yieldApiTransactionDtoFixture({
        type: type as ActionTransaction["type"],
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
    YieldAction,
    | "address"
    | "amount"
    | "amountRaw"
    | "amountUsd"
    | "completedAt"
    | "createdAt"
    | "id"
    | "rawArguments"
    | "transactions"
    | "yieldId"
  >
> & {
  readonly address?: string;
  readonly amount?: typeof YieldAction.Encoded.amount;
  readonly amountRaw?: typeof YieldAction.Encoded.amountRaw;
  readonly amountUsd?: typeof YieldAction.Encoded.amountUsd;
  readonly completedAt?: DateTime.Utc | null;
  readonly createdAt?: DateTime.Utc;
  readonly id?: string;
  readonly rawArguments?: typeof YieldAction.Encoded.rawArguments;
  readonly transactions?: ReadonlyArray<ActionTransaction>;
  readonly yieldId?: string;
};

export const yieldApiActionFixture = (
  overrides?: ActionFixtureOverrides
): YieldAction => {
  const type = overrides?.type ?? "STAKE";
  const intent = overrides?.intent ?? getYieldActionIntent(type);
  const { completedAt, createdAt, transactions, ...rest } = overrides ?? {};

  return Schema.decodeSync(YieldAction)({
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

const getYieldActionIntent = (type: YieldAction["type"]) => {
  if (type === "STAKE") return "enter" as const;
  if (type === "UNSTAKE") return "exit" as const;
  return "manage" as const;
};
