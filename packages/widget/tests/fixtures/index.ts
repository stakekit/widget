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
  YieldValidatorDto,
} from "../../src/providers/yield-api-client-provider/types";
import type { components } from "../../src/types/yield-api-schema";

type LegacyActionDto = ReturnType<typeof getActionControllerEnterResponseMock>;
type LegacyTransactionDto = ReturnType<
  typeof getTransactionControllerConstructResponseMock
>;
type LegacyYieldDto = ReturnType<
  typeof getYieldV2ControllerGetYieldByIdResponseMock
>;
type LegacyValidatorDto = NonNullable<LegacyYieldDto["validators"]>[number];

const apyFaker = () => faker.number.float({ min: 0, max: 0.05 });
type YieldArgumentFieldName = components["schemas"]["ArgumentFieldDto"]["name"];
type YieldArgumentFieldType = components["schemas"]["ArgumentFieldDto"]["type"];

const yieldArgumentFieldNames = new Set<YieldArgumentFieldName>([
  "amount",
  "amounts",
  "validatorAddress",
  "validatorAddresses",
  "receiverAddress",
  "providerId",
  "duration",
  "inputToken",
  "inputTokenNetwork",
  "outputToken",
  "outputTokenNetwork",
  "subnetId",
  "tronResource",
  "feeConfigurationId",
  "cosmosPubKey",
  "tezosPubKey",
  "cAddressBech",
  "pAddressBech",
  "executionMode",
  "ledgerWalletApiCompatible",
  "useMaxAmount",
  "useInstantExecution",
  "rangeMin",
  "rangeMax",
  "percentage",
  "tokenId",
  "skipPrechecks",
]);

export const yieldRewardRateFixture = (
  overrides?: Partial<YieldRewardRateDto>
): YieldRewardRateDto => ({
  total: apyFaker(),
  rateType: "APY",
  components: [],
  ...overrides,
});

export const yieldApiYieldFixture = (
  overrides?: Partial<YieldApiYieldDto>
): YieldApiYieldDto =>
  ({
    ...getYieldV2ControllerGetYieldByIdResponseMock(),
    rewardRate: yieldRewardRateFixture(),
    ...overrides,
  }) as YieldApiYieldDto;

const mapLegacyValidatorToYieldValidator = (
  validator: LegacyValidatorDto
): YieldValidatorDto => ({
  address: validator.address,
  commission: validator.commission,
  logoURI: validator.image,
  minimumStake: validator.minimumStake,
  name: validator.name,
  nominatorCount: validator.nominatorCount,
  preferred: validator.preferred,
  pricePerShare: validator.pricePerShare,
  providerId: validator.providerId,
  remainingPossibleStake: validator.remainingPossibleStake,
  remainingSlots: validator.remainingSlots,
  rewardRate: {
    total: validator.apr ?? apyFaker(),
    rateType: "APR",
    components: [],
  },
  status: validator.status,
  subnetId: validator.subnetId,
  subnetName: validator.subnetName,
  tvl: validator.stakedBalance,
  tokenSymbol: validator.tokenSymbol,
  votingPower: validator.votingPower,
  website: validator.website,
});

const mapYieldArgumentFields = (
  args?: Record<
    string,
    {
      required?: boolean;
      minimum?: number | null;
      maximum?: number | null;
      options?: string[];
    }
  >
) =>
  Object.entries(args ?? {}).flatMap(([name, config]) => {
    if (!yieldArgumentFieldNames.has(name as YieldArgumentFieldName)) {
      return [];
    }

    const type: YieldArgumentFieldType = (() => {
      if (name === "validatorAddress" || name === "validatorAddresses") {
        return "address";
      }

      if (config?.options?.length) {
        return "enum";
      }

      return "string";
    })();

    return [
      {
        name: name as YieldArgumentFieldName,
        type,
        label: name,
        required: config?.required,
        minimum:
          config?.minimum === null || config?.minimum === undefined
            ? undefined
            : String(config.minimum),
        maximum:
          config?.maximum === null || config?.maximum === undefined
            ? undefined
            : String(config.maximum),
        options: config?.options,
        isArray: name === "validatorAddresses" ? true : undefined,
      },
    ];
  });

export const yieldApiYieldFixtureFromLegacy = ({
  legacyYield,
  overrides,
}: {
  legacyYield: LegacyYieldDto;
  overrides?: Partial<YieldApiYieldDto>;
}): YieldApiYieldDto =>
  ({
    id: legacyYield.id,
    network: legacyYield.token.network,
    inputTokens: legacyYield.tokens?.length
      ? legacyYield.tokens
      : [legacyYield.token],
    outputToken: legacyYield.metadata.rewardTokens?.[0] ?? legacyYield.token,
    token: legacyYield.token,
    tokens: legacyYield.tokens,
    rewardRate: yieldRewardRateFixture({
      total:
        typeof legacyYield.rewardRate === "number"
          ? legacyYield.rewardRate
          : apyFaker(),
      rateType: legacyYield.rewardType?.toUpperCase() === "APR" ? "APR" : "APY",
    }),
    status: legacyYield.status,
    metadata: {
      name: legacyYield.metadata.name,
      description: legacyYield.metadata.description ?? "",
      documentation: legacyYield.metadata.documentation ?? "",
      logoURI: legacyYield.metadata.logoURI ?? "",
      underMaintenance: false,
      deprecated: false,
      supportedStandards: [],
    },
    mechanics: {
      type:
        legacyYield.metadata.type === "liquid-staking"
          ? "staking"
          : legacyYield.metadata.type,
      requiresValidatorSelection: (legacyYield.validators?.length ?? 0) > 0,
      rewardSchedule: legacyYield.metadata.rewardSchedule ?? "day",
      rewardClaiming: legacyYield.metadata.rewardClaiming ?? "auto",
      gasFeeToken: legacyYield.metadata.gasFeeToken ?? legacyYield.token,
      fee: legacyYield.metadata.fee,
      supportsLedgerWalletApi: legacyYield.metadata.supportsLedgerWalletApi,
      arguments: {
        enter: {
          fields: mapYieldArgumentFields(
            legacyYield.args.enter?.args as Record<
              string,
              {
                required?: boolean;
                minimum?: number | null;
                maximum?: number | null;
                options?: string[];
              }
            >
          ),
        },
        exit: {
          fields: mapYieldArgumentFields(
            legacyYield.args.exit?.args as Record<
              string,
              {
                required?: boolean;
                minimum?: number | null;
                maximum?: number | null;
                options?: string[];
              }
            >
          ),
        },
      },
    },
    providerId: legacyYield.metadata.provider?.id ?? "unknown",
    validators:
      legacyYield.validators?.map(mapLegacyValidatorToYieldValidator) ?? [],
    ...overrides,
  }) as YieldApiYieldDto;

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
        }) satisfies LegacyYieldDto
    )
    .unsafeCoerce();

export const yieldValidatorsFixture = (
  validators?: LegacyYieldDto["validators"]
): YieldValidatorDto[] =>
  (validators ?? yieldFixture().validators).map((validator) =>
    mapLegacyValidatorToYieldValidator(validator)
  );

export const enterResponseFixture = (overrides?: Partial<LegacyActionDto>) => ({
  ...getActionControllerEnterResponseMock(),
  ...overrides,
});

export const transactionConstructFixture = (
  overrides?: Partial<LegacyTransactionDto>
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
  overrides?: Partial<YieldTransactionDto>
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
