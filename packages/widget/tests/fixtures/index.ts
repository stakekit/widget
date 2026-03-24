import { faker } from "@faker-js/faker";
import {
  getActionControllerEnterResponseMock,
  getActionControllerPendingResponseMock,
  getTransactionControllerConstructResponseMock,
  getYieldV2ControllerGetYieldByIdResponseMock,
} from "@stakekit/api-hooks/msw";
import { Just } from "purify-ts";
import type {
  YieldActionArgumentsDto,
  YieldActionDto,
  YieldDto as YieldApiYieldDto,
  YieldBalanceDto,
  YieldRewardRateDto,
  YieldTransactionDto,
} from "../../src/providers/yield-api-client-provider/types";

type LegacyActionDto = ReturnType<typeof getActionControllerEnterResponseMock>;
type LegacyTransactionDto = ReturnType<
  typeof getTransactionControllerConstructResponseMock
>;
type LegacyYieldDto = ReturnType<
  typeof getYieldV2ControllerGetYieldByIdResponseMock
>;

const apyFaker = () => faker.number.float({ min: 0, max: 0.05 });

export const yieldRewardRateFixture = (
  overrides?: Partial<YieldRewardRateDto>,
): YieldRewardRateDto => ({
  total: apyFaker(),
  rateType: "APY",
  components: [],
  ...overrides,
});

export const yieldApiYieldFixture = (
  overrides?: Partial<YieldApiYieldDto>,
): YieldApiYieldDto =>
  ({
    ...getYieldV2ControllerGetYieldByIdResponseMock(),
    rewardRate: yieldRewardRateFixture(),
    ...overrides,
  }) as YieldApiYieldDto;

export const yieldBalanceFixture = (
  overrides?: Partial<YieldBalanceDto>,
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

export const yieldFixture = (overrides?: Partial<LegacyYieldDto>) =>
  Just(getYieldV2ControllerGetYieldByIdResponseMock())
    .map(
      (val) =>
        ({
          ...val,
          rewardRate: apyFaker(),
          rewardType: "apy",
          apy: apyFaker(),
          args: {
            enter: {
              args: {
                nfts: undefined,
                providerId: { required: false, options: [] },
              },
            },
          },
          feeConfigurations: [],
          status: { enter: true, exit: true },
          validators: val.validators.map((v) => ({ ...v, apr: apyFaker() })),
          ...overrides,
        }) satisfies LegacyYieldDto,
    )
    .unsafeCoerce();

export const yieldValidatorsFixture = (
  validators?: LegacyYieldDto["validators"],
) =>
  (validators ?? yieldFixture().validators).map((validator) => ({
    ...validator,
    apr: validator.apr ?? apyFaker(),
  }));

export const enterResponseFixture = (overrides?: Partial<LegacyActionDto>) => ({
  ...getActionControllerEnterResponseMock(),
  ...overrides,
});

export const transactionConstructFixture = (
  overrides?: Partial<LegacyTransactionDto>,
) => ({
  ...getTransactionControllerConstructResponseMock(),
  ...overrides,
});

export const pendingActionFixture = (overrides?: Partial<LegacyActionDto>) => ({
  ...getActionControllerPendingResponseMock(),
  ...overrides,
});

export const yieldApiTransactionFixture = (
  tx: LegacyTransactionDto,
  overrides?: Partial<YieldTransactionDto>,
) =>
  ({
    id: tx.id || faker.string.uuid(),
    title: tx.type.replaceAll("_", " "),
    network: tx.network,
    status: tx.status,
    type: tx.type,
    gasEstimate: tx.gasEstimate?.amount ?? null,
    stepIndex: tx.stepIndex,
    unsignedTransaction: tx.unsignedTransaction ?? undefined,
    signedTransaction: tx.signedTransaction ?? undefined,
    explorerUrl: tx.explorerUrl ?? undefined,
    hash: tx.hash ?? undefined,
    isMessage: tx.isMessage,
    createdAt: tx.createdAt,
    broadcastedAt: tx.broadcastedAt ?? undefined,
    error: tx.error ?? undefined,
    annotatedTransaction: (tx.annotatedTransaction ?? null) as never,
    structuredTransaction: (tx.structuredTransaction ?? null) as never,
    ...overrides,
  }) as YieldTransactionDto;

export const yieldApiActionFixture = ({
  action,
  address,
  rawArguments,
  transactions,
  overrides,
}: {
  action: LegacyActionDto;
  address: string;
  rawArguments?: YieldActionArgumentsDto | null;
  transactions?: YieldTransactionDto[];
  overrides?: Partial<YieldActionDto>;
}) =>
  ({
    id: action.id,
    intent:
      action.type === "STAKE"
        ? "enter"
        : action.type === "UNSTAKE"
          ? "exit"
          : "manage",
    type: action.type,
    yieldId: action.integrationId,
    address,
    amount: action.amount,
    amountRaw: action.amount,
    amountUsd: action.USDAmount,
    transactions:
      transactions ??
      action.transactions.map((tx) => yieldApiTransactionFixture(tx)),
    executionPattern: "synchronous",
    rawArguments: rawArguments ?? null,
    createdAt: action.createdAt,
    completedAt: action.completedAt,
    status: action.status,
    ...overrides,
  }) as YieldActionDto;
