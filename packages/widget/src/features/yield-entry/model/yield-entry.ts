import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import { getMaxAmount } from "../../../domain";
import { ActionCommand } from "../../../domain/schema/action-models";
import type { AdditionalAddresses } from "../../../domain/schema/address-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type {
  WalletAddress,
  YieldId,
} from "../../../domain/schema/identifiers";
import type {
  AppToken,
  TronResource,
} from "../../../domain/schema/legacy-models";
import type { PositionsData } from "../../../domain/types/positions";
import {
  getMinStakeAmount,
  getMinUnstakeAmount,
  isForceMaxAmount,
} from "../../../domain/types/stake";
import type { ValidatorKey } from "../../../domain/types/validators";
import {
  getYieldActionArg,
  isBittensorStaking,
} from "../../../domain/types/yields";
import { getRewardRateFormatted } from "../../../shared/lib/formatters";
import { formatNumber } from "../../../shared/lib/number-format";

type YieldEntryInput = Readonly<{
  readonly amount: BigNumber;
  readonly selectedProviderYieldId: YieldId | null;
  readonly token: AppToken | null;
  readonly tronResource: TronResource | null;
  readonly useMaxAmount: boolean;
  readonly validators: ReadonlyMap<ValidatorKey, EarnValidator>;
  readonly yield: EarnYieldWithProvider | null;
}>;

type YieldEntryWallet = Readonly<{
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: typeof WalletAddress.Type | null;
  readonly isLedgerLive: boolean;
}>;

type YieldEntryRewardProvider = Readonly<{
  readonly rewardRate?: number | null;
}>;

export type YieldEntryProjectionInput = Readonly<{
  readonly additionalValidationErrors?: Readonly<Record<string, boolean>>;
  readonly availableAmount: BigNumber | null;
  readonly canSubmit: boolean;
  readonly connected: boolean;
  readonly defaultToMinimum: boolean;
  readonly entry: YieldEntryInput;
  readonly externalProviders: boolean;
  readonly hasNoYields: boolean;
  readonly isAppLoading: boolean;
  readonly isFetching: boolean;
  readonly isKycBlocking: boolean;
  readonly isKycLoading: boolean;
  readonly isLedgerAccountPlaceholder: boolean;
  readonly positionsData: PositionsData;
  readonly providers: ReadonlyArray<YieldEntryRewardProvider> | null;
  readonly validateAmount: boolean;
  readonly wallet: YieldEntryWallet;
}>;

const makeYieldEntryActionCommand = ({
  entry,
  wallet,
}: {
  readonly entry: YieldEntryInput;
  readonly wallet: YieldEntryWallet;
}) => {
  const selectedYield = entry.yield;
  if (!wallet.address || !selectedYield || !entry.token) return null;

  const providerIdRequired = Boolean(
    getYieldActionArg(selectedYield, "enter", "providerId")?.required
  );
  if (providerIdRequired && !entry.selectedProviderYieldId) return null;

  const validators = [...entry.validators.values()];
  const validatorArguments = (() => {
    if (
      getYieldActionArg(selectedYield, "enter", "validatorAddresses")?.required
    ) {
      return validators.length > 0
        ? {
            validatorAddresses: validators.map(
              (validator) => validator.address
            ),
          }
        : null;
    }

    const subnetIdRequired = Boolean(
      getYieldActionArg(selectedYield, "enter", "subnetId")?.required
    );
    const validatorAddressRequired = Boolean(
      getYieldActionArg(selectedYield, "enter", "validatorAddress")?.required
    );
    if (!validatorAddressRequired && !subnetIdRequired) return {};

    const validator = EArray.head(validators).pipe(Option.getOrNull);
    if (!validator) return null;

    const subnetId = subnetIdRequired ? validator.subnet?.id : undefined;
    if (subnetIdRequired && subnetId === undefined) return null;

    return {
      validatorAddress: validator.address,
      ...(subnetId === undefined ? {} : { subnetId }),
    };
  })();
  if (!validatorArguments) return null;

  return {
    command: ActionCommand.make({
      address: wallet.address,
      yieldId: selectedYield.id,
      arguments: {
        amount: entry.amount.toString(10),
        ...(entry.token.address ? { inputToken: entry.token.address } : {}),
        ...(wallet.isLedgerLive ? { ledgerWalletApiCompatible: true } : {}),
        ...(entry.tronResource ? { tronResource: entry.tronResource } : {}),
        ...(entry.useMaxAmount ? { useMaxAmount: true } : {}),
        ...(entry.selectedProviderYieldId
          ? { providerId: entry.selectedProviderYieldId }
          : {}),
        ...validatorArguments,
        ...(wallet.additionalAddresses ?? {}),
      },
    }),
    gasFeeToken: selectedYield.mechanics.gasFeeToken,
    selectedToken: entry.token,
    selectedValidators: entry.validators,
    selectedYield,
  } as const;
};

type YieldEntryCtaActionOf<Tag extends string> = Readonly<{
  readonly _tag: Tag;
  readonly disabled: boolean;
  readonly loading: boolean;
}>;

type YieldEntryCtaAction =
  | YieldEntryCtaActionOf<"AddLedgerAccount">
  | YieldEntryCtaActionOf<"ConnectWallet">
  | YieldEntryCtaActionOf<"Submit">;

type YieldEntryCta =
  | Readonly<{ readonly _tag: "Hidden" }>
  | YieldEntryCtaAction;

type YieldEntryValidationErrors = Readonly<{
  readonly stakeAmountGreaterThanAvailableAmount: boolean;
  readonly stakeAmountGreaterThanMax: boolean;
  readonly stakeAmountIsZero: boolean;
  readonly stakeAmountLessThanMin: boolean;
  readonly tronResource: boolean;
}>;

export const getYieldEntryCta = ({
  appLoading,
  canSubmit,
  connected,
  externalProviders,
  hasNoYields,
  isFetching,
  kycBlocking,
  kycLoading,
  ledgerAccountPlaceholder,
  preparationAvailable,
}: {
  readonly appLoading: boolean;
  readonly canSubmit: boolean;
  readonly connected: boolean;
  readonly externalProviders: boolean;
  readonly hasNoYields: boolean;
  readonly isFetching: boolean;
  readonly kycBlocking: boolean;
  readonly kycLoading: boolean;
  readonly ledgerAccountPlaceholder: boolean;
  readonly preparationAvailable: boolean;
}): YieldEntryCta => {
  if (connected && hasNoYields) return { _tag: "Hidden" };
  if (connected && !ledgerAccountPlaceholder) {
    return {
      _tag: "Submit",
      disabled:
        isFetching || !canSubmit || !preparationAvailable || kycBlocking,
      loading: isFetching || kycLoading,
    };
  }
  if (externalProviders) return { _tag: "Hidden" };
  return {
    _tag: ledgerAccountPlaceholder ? "AddLedgerAccount" : "ConnectWallet",
    disabled: appLoading,
    loading: appLoading,
  };
};

type YieldAmountConstraintsInput = Readonly<{
  readonly availableAmount: BigNumber | null;
  readonly yield: EarnYieldWithProvider | null;
}> &
  (
    | Readonly<{
        readonly type: "enter";
        readonly positionsData: PositionsData;
      }>
    | Readonly<{
        readonly type: "exit";
        readonly pricePerShare: string | null;
      }>
  );

const resolveMinimum = (
  input: YieldAmountConstraintsInput,
  forceMax: boolean
) => {
  if (forceMax) return input.availableAmount;
  if (!input.yield) return null;

  return new BigNumber(
    input.type === "enter"
      ? getMinStakeAmount(input.yield, input.positionsData)
      : getMinUnstakeAmount(input.yield, input.pricePerShare)
  );
};

const resolveMaximum = (
  input: YieldAmountConstraintsInput,
  forceMax: boolean,
  candidate: BigNumber | null
) => {
  if (forceMax) return input.availableAmount;
  return candidate?.isGreaterThan(0) ? candidate : null;
};

export const getYieldAmountConstraints = (
  input: YieldAmountConstraintsInput
) => {
  const amountArgument = input.yield
    ? getYieldActionArg(input.yield, input.type, "amount")
    : null;
  const forceMax = isForceMaxAmount(amountArgument);
  const minimum = resolveMinimum(input, forceMax);
  const configuredMaximum = amountArgument?.maximum;
  const candidateMaximum =
    configuredMaximum == null ? null : new BigNumber(configuredMaximum);
  const maximum = resolveMaximum(input, forceMax, candidateMaximum);
  const allowedMaximum = getMaxAmount({
    availableAmount: input.availableAmount ?? new BigNumber(0),
    gasEstimateTotal: new BigNumber(0),
    integrationMaxLimit: maximum,
  });

  return {
    allowedMaximum,
    allowedMinimum: minimum ?? new BigNumber(0),
    forceMax,
    maximum,
    minimum,
  } as const;
};

const getYieldAmountValidation = ({
  amount,
  availableAmount,
  maximum,
  minimum,
}: {
  readonly amount: BigNumber;
  readonly availableAmount: BigNumber | null;
  readonly maximum: BigNumber;
  readonly minimum: BigNumber;
}) => ({
  amountGreaterThanAvailable: availableAmount?.isLessThan(amount) ?? false,
  amountGreaterThanMaximum:
    availableAmount !== null && amount.isGreaterThan(maximum),
  amountIsZero: availableAmount !== null && amount.isZero(),
  amountLessThanMinimum: availableAmount !== null && amount.isLessThan(minimum),
});

const getYieldEntryValidation = ({
  additionalValidationErrors,
  amountValidation,
  selectedYield,
  submitted,
  tronResource,
  validateAmount,
}: {
  readonly additionalValidationErrors:
    | Readonly<Record<string, boolean>>
    | undefined;
  readonly amountValidation: ReturnType<typeof getYieldAmountValidation>;
  readonly selectedYield: EarnYieldWithProvider | null;
  readonly submitted: boolean;
  readonly tronResource: TronResource | null;
  readonly validateAmount: boolean;
}) => {
  const errors: YieldEntryValidationErrors & Readonly<Record<string, boolean>> =
    {
      stakeAmountGreaterThanAvailableAmount:
        validateAmount && amountValidation.amountGreaterThanAvailable,
      stakeAmountGreaterThanMax:
        validateAmount && amountValidation.amountGreaterThanMaximum,
      stakeAmountIsZero: validateAmount && amountValidation.amountIsZero,
      stakeAmountLessThanMin:
        validateAmount && amountValidation.amountLessThanMinimum,
      tronResource:
        validateAmount &&
        Boolean(
          selectedYield &&
            getYieldActionArg(selectedYield, "enter", "tronResource")?.required
        ) &&
        !tronResource,
      ...additionalValidationErrors,
    };

  return {
    errors,
    hasErrors: Object.values(errors).some(Boolean),
    submitted: validateAmount && submitted,
  } as const;
};

export const getYieldEntryEstimatedRewards = ({
  amount,
  providers,
  validators,
  yield: selectedYield,
}: {
  readonly amount: BigNumber;
  readonly providers: ReadonlyArray<YieldEntryRewardProvider> | null;
  readonly validators: ReadonlyMap<ValidatorKey, EarnValidator>;
  readonly yield: EarnYieldWithProvider | null;
}) => {
  const firstValidator = EArray.head([...validators.values()]).pipe(
    Option.getOrNull
  );
  const pricePerShare = firstValidator?.subnet?.pricePerShare;
  const rewardAmount =
    selectedYield && isBittensorStaking(selectedYield.id) && pricePerShare
      ? amount.dividedBy(pricePerShare)
      : amount;
  if (!providers || !selectedYield) return null;

  const rewardRateAverage = providers
    .reduce(
      (total, provider) => total.plus(new BigNumber(provider.rewardRate ?? 0)),
      new BigNumber(0)
    )
    .dividedBy(providers.length);

  return {
    monthly: rewardRateAverage.isGreaterThan(0)
      ? formatNumber(
          rewardAmount.times(rewardRateAverage).dividedBy(12).decimalPlaces(5)
        )
      : "-",
    percentage: getRewardRateFormatted({
      rewardRate: rewardRateAverage.toNumber(),
    }),
    rewardRateAverage,
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    yearly: rewardRateAverage.isGreaterThan(0)
      ? formatNumber(rewardAmount.times(rewardRateAverage).decimalPlaces(5))
      : "-",
  } as const;
};

export const projectYieldEntry = ({
  input,
  submitted,
}: {
  readonly input: YieldEntryProjectionInput;
  readonly submitted: boolean;
}) => {
  const constraints = getYieldAmountConstraints({
    type: "enter",
    availableAmount: input.availableAmount,
    positionsData: input.positionsData,
    yield: input.entry.yield,
  });
  const amount =
    input.defaultToMinimum &&
    input.entry.amount.isZero() &&
    constraints.allowedMinimum.isGreaterThan(0)
      ? constraints.allowedMinimum
      : input.entry.amount;
  const entry = { ...input.entry, amount };
  const amountValidation = getYieldAmountValidation({
    amount,
    availableAmount: input.availableAmount,
    maximum: constraints.allowedMaximum,
    minimum: constraints.allowedMinimum,
  });
  const validation = getYieldEntryValidation({
    additionalValidationErrors: input.additionalValidationErrors,
    amountValidation,
    selectedYield: input.entry.yield,
    submitted,
    tronResource: input.entry.tronResource,
    validateAmount: input.validateAmount,
  });
  const preparation = makeYieldEntryActionCommand({
    entry,
    wallet: input.wallet,
  });

  return {
    constraints,
    cta: getYieldEntryCta({
      appLoading: input.isAppLoading,
      canSubmit: input.canSubmit,
      connected: input.connected,
      externalProviders: input.externalProviders,
      hasNoYields: input.hasNoYields,
      isFetching: input.isFetching,
      kycBlocking: input.isKycBlocking,
      kycLoading: input.isKycLoading,
      ledgerAccountPlaceholder: input.isLedgerAccountPlaceholder,
      preparationAvailable: preparation !== null,
    }),
    estimatedRewards: getYieldEntryEstimatedRewards({
      amount,
      providers: input.providers,
      validators: input.entry.validators,
      yield: input.entry.yield,
    }),
    preparation,
    amount,
    validation,
  } as const;
};
