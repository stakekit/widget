import { Arbitrary, DateTime, Effect, Random, Schema } from "effect";

import {
  ActionTransaction,
  YieldAction,
} from "../../src/domain/earn/action-models";
import type { EarnBalance } from "../../src/domain/earn/balance";
import type { EarnProvider } from "../../src/domain/earn/provider";
import { EarnProvider as EarnProviderSchema } from "../../src/domain/earn/provider";
import type { YieldRewardRate } from "../../src/domain/earn/reward-rate";
import { EarnYield } from "../../src/domain/earn/yield-schema";
import { exactDecimal } from "../../src/domain/finance/exact";
import * as YieldApi from "../../src/generated/api/yield-schema";
import type {
  ValidatorDto,
  YieldDto as YieldApiYieldDto,
} from "../generated/yield-api-types";

type YieldApiProviderDto = typeof EarnProvider.Encoded;
// oxlint-disable-next-line effect/no-run-effect-in-test -- synchronous fixture helper for random APY values
const apyFaker = () => Effect.runSync(Random.nextBetween(0, 0.05));

const ethereumAddressArbitrary = Arbitrary.schema(
  Schema.String.check(Schema.isPattern(/^0x[a-f0-9]{40}$/))
);
const ethereumAddressFaker = () =>
  // oxlint-disable-next-line effect/no-run-effect-in-test -- synchronous fixture helper for generated addresses
  Effect.runSync(
    Arbitrary.sampleEffect(ethereumAddressArbitrary, { count: 1 })
  )[0]!;

const uuidArbitrary = Arbitrary.schema(Schema.String.check(Schema.isUUID(4)));
const uuidFaker = () =>
  // oxlint-disable-next-line effect/no-run-effect-in-test -- synchronous fixture helper for generated UUIDs
  Effect.runSync(Arbitrary.sampleEffect(uuidArbitrary, { count: 1 }))[0]!;

type ExactDecimalFixtureInput = Parameters<typeof exactDecimal>[0];
type YieldRewardComponent = YieldRewardRate["components"][number];
type YieldRewardComponentFixtureInput = Omit<
  YieldRewardComponent,
  "origin" | "rate"
> & {
  readonly origin?: YieldRewardComponent["origin"];
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
      origin: component.origin ?? "api",
      rate: exactDecimal(component.rate),
    })),
  };
};

const yieldRewardRateDtoFixture = (): YieldApiYieldDto["rewardRate"] => ({
  total: apyFaker(),
  rateType: "APY",
  components: [],
});

// The domain keeps reward sources open; wire fixtures must still carry a
// source the generated client knows.
const decodeWireYieldSource = Schema.decodeUnknownSync(
  YieldApi.RewardDto.fields.yieldSource
);

export const encodeYieldRewardRateFixture = (
  rewardRate:
    | YieldRewardRateFixtureInput
    | NonNullable<ValidatorDto["rewardRate"]>
): NonNullable<ValidatorDto["rewardRate"]> => {
  return {
    rateType: rewardRate.rateType ?? "APY",
    total: exactDecimal(rewardRate.total ?? apyFaker()).toNumber(),
    components: (rewardRate.components ?? []).map(
      ({ rate, rateType, token, yieldSource }) => ({
        rate: exactDecimal(rate).toNumber(),
        rateType,
        token,
        yieldSource: decodeWireYieldSource(yieldSource),
      })
    ),
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
    logoURI: "https://assets.stakek.it/app/composition/providers/stakekit.svg",
    website: "https://stakek.it",
    tvlUsd: null,
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

/** A live campaign on the default yield, as `GET /v1/yields/{id}/campaigns` sends it. */
export const yieldApiCampaignDtoFixture = (
  overrides?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => ({
  id: "8f4f5c3a-1d2b-4c3e-9f00-2a7b6c5d4e01",
  name: "Kamino × Utila USDC Boost",
  createdAt: "2026-11-01T09:00:00.000Z",
  updatedAt: "2026-11-01T09:00:00.000Z",
  yieldId: "ethereum-eth-native-staking",
  status: "active",
  rewardMode: "compound",
  rewardRate: {
    total: 0.042,
    rateType: "APR",
    components: [],
  },
  totalBudget: "150000",
  distributedBudget: "1200",
  remainingBudget: "148800",
  configuredHourlyEmission: null,
  apyCeiling: 0.1,
  qualificationConfig: {
    type: "min_token_amount",
    threshold: "10",
    maxIncentivizedTvlToken: "50000",
  },
  startTime: "2026-11-16T12:00:00.000Z",
  endTime: "2027-05-15T12:00:00.000Z",
  lastProcessedHour: null,
  nextPayoutDueAt: "2026-11-17T12:00:00.000Z",
  payoutFrequency: "daily",
  rewardToken: yieldApiTokenFixture({
    name: "Allez USDC vault shares",
    symbol: "kAllezUSDC",
    decimals: 6,
  }),
  ...overrides,
});

/** A wallet's rewards in the default campaign, as `GET /v1/campaigns/rewards` sends them. */
export const yieldApiCampaignRewardsDtoFixture = (
  overrides?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => ({
  campaignId: "8f4f5c3a-1d2b-4c3e-9f00-2a7b6c5d4e01",
  yieldId: "ethereum-eth-native-staking",
  status: "active",
  rewardMode: "compound",
  rewardToken: yieldApiTokenFixture({
    name: "Allez USDC vault shares",
    symbol: "kAllezUSDC",
    decimals: 6,
  }),
  totals: { earned: "77.1", paid: "74.68", unpaid: "2.42" },
  inputTokenTotals: { earned: "80.39", paid: "77.87", unpaid: "2.52" },
  accruedThrough: "2026-12-14T08:00:00.000Z",
  nextPayoutDueAt: "2026-12-14T12:00:00.000Z",
  qualification: {
    status: "qualified",
    qualifyingBalance: "25000",
    incentivizedBalance: "25000",
  },
  ...overrides,
});

/** One payout, as `GET /v1/campaigns/{campaignId}/payouts` sends it. */
export const yieldApiCampaignPayoutDtoFixture = (
  overrides?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => ({
  paidAt: "2026-12-13T12:04:00.000Z",
  amount: "2.9197",
  inputTokenAmount: "3.04",
  txHash: "5h3cK7Lm9QxR2uV8yWzA1bC4dE6fG8hJ0kL2mN4pQ6rS8tU0vW2xY4zA6bC8dE0f",
  status: "paid",
  ...overrides,
});

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
  network: "ethereum",
  status: "CREATED",
  type: "STAKE",
  hash: null,
  createdAt: "2100-01-01T00:00:00.000Z",
  broadcastedAt: null,
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
    | "events"
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
  /** Encoded, as the API sends them. */
  readonly events?: ReadonlyArray<{
    readonly id: string;
    readonly occurredAt: string;
    readonly transactionHash: string | null;
    readonly type: string;
  }>;
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

  const action = Schema.decodeSync(YieldAction)({
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
    type,
  });

  // Overridden transactions are already decoded.
  return transactions ? { ...action, transactions } : action;
};

const getYieldActionIntent = (type: YieldAction["type"]) => {
  if (type === "STAKE") return "enter" as const;
  if (type === "UNSTAKE") return "exit" as const;
  return "manage" as const;
};

// Zama confidential vault on Sepolia with a two-leg router.
const router = "0x9999999999999999999999999999999999999999";
const otherDepositBatcher = "0x1111111111111111111111111111111111111111";
const depositBatcher = "0x4444444444444444444444444444444444444444";
const otherRedeemBatcher = "0x2222222222222222222222222222222222222222";
const redeemBatcher = "0x5555555555555555555555555555555555555555";

const usdc = {
  address: "0x6666666666666666666666666666666666666666",
  decimals: 6,
  name: "USD Coin",
  network: "ethereum-sepolia",
  symbol: "USDC",
} as const;
const cUsdc = {
  address: "0x7777777777777777777777777777777777777777",
  decimals: 6,
  name: "Confidential USDC",
  network: "ethereum-sepolia",
  symbol: "cUSDC",
} as const;
const cShare = {
  address: "0x8888888888888888888888888888888888888888",
  decimals: 6,
  name: "Confidential Share",
  network: "ethereum-sepolia",
  symbol: "csteakcUSDC",
} as const;
// Like the API's, a Sepolia vault's gas token is the chain's native ETH.
const sepoliaEth = {
  decimals: 18,
  name: "Ethereum",
  network: "ethereum-sepolia",
  symbol: "ETH",
} as const;

const legsField = (options: ReadonlyArray<string>) => ({
  isArray: true,
  label: "Encrypted Leg Amounts",
  name: "encryptedLegAmounts" as const,
  options: [...options],
  required: true,
  type: "string" as const,
});

export const confidentialYieldFixture = (
  overrides?: Partial<YieldApiYieldDto>
) =>
  yieldApiYieldFixture({
    executionContracts: {
      enter: [cUsdc.address, router, depositBatcher],
      exit: [router, cShare.address, redeemBatcher],
    },
    id: "ethereum-sepolia-usdc-zama-confidential-vault",
    inputTokens: [cUsdc],
    mechanics: {
      ...yieldApiYieldDtoFixture().mechanics,
      arguments: {
        enter: {
          fields: [
            {
              label: "Encrypted Amount",
              name: "encryptedAmount",
              options: [cUsdc.address],
              required: true,
              type: "string",
            },
            legsField([otherDepositBatcher, depositBatcher]),
          ],
        },
        exit: {
          fields: [
            legsField([otherRedeemBatcher, redeemBatcher]),
            {
              label: "Encrypted Amount",
              name: "encryptedAmount",
              options: [cShare.address],
              required: false,
              type: "string",
            },
          ],
        },
      },
      gasFeeToken: sepoliaEth,
    },
    network: "ethereum-sepolia",
    outputToken: cShare,
    token: usdc,
    tokens: [usdc],
    ...overrides,
  });

export const confidentialFixture = {
  cShare,
  cUsdc,
  depositBatcher,
  redeemBatcher,
  router,
  usdc,
} as const;
