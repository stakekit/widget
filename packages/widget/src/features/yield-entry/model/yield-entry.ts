import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import { getMaxAmount } from "../../../domain";
import { ActionCommand } from "../../../domain/action/models";
import type { TronResource } from "../../../domain/action/tron-resource";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import {
  getMinStakeAmount,
  getMinUnstakeAmount,
  isForceMaxAmount,
} from "../../../domain/earn/stake";
import type { ValidatorKey } from "../../../domain/earn/validator";
import { getYieldActionArg } from "../../../domain/earn/yield";
import type {
  WalletAddress,
  YieldId,
} from "../../../domain/identity/identifiers";
import type { Token } from "../../../domain/token/token";
import type { AdditionalAddresses } from "../../../domain/wallet/address";
import { getYieldEstimatedRewards } from "../../yield-summary/index";

type YieldEntryInput = Readonly<{
  readonly amount: BigNumber;
  readonly selectedProviderYieldId: YieldId | null;
  readonly token: Token | null;
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

export type YieldEntryAmountInitialization =
  | "PreserveIntent"
  | "DefaultToMinimum";

export type YieldEntryReadiness =
  | Readonly<{ readonly _tag: "Loading" }>
  | Readonly<{ readonly _tag: "Refreshing" }>
  | Readonly<{ readonly _tag: "Ready" }>
  | Readonly<{ readonly _tag: "Blocked" }>;

export type YieldEntryProjectionInput = Readonly<{
  readonly additionalValidationErrors?: Readonly<Record<string, boolean>>;
  readonly availableAmount: BigNumber | null;
  readonly connected: boolean;
  readonly amountInitialization: YieldEntryAmountInitialization;
  readonly entry: YieldEntryInput;
  readonly externalProviders: boolean;
  readonly hasNoYields: boolean;
  readonly isKycBlocking: boolean;
  readonly isKycLoading: boolean;
  readonly isLedgerAccountPlaceholder: boolean;
  readonly readiness: YieldEntryReadiness;
  readonly selectedYieldHasActivePosition: boolean;
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
  connected,
  externalProviders,
  hasNoYields,
  kycBlocking,
  kycLoading,
  ledgerAccountPlaceholder,
  preparationAvailable,
  readiness,
}: {
  readonly connected: boolean;
  readonly externalProviders: boolean;
  readonly hasNoYields: boolean;
  readonly kycBlocking: boolean;
  readonly kycLoading: boolean;
  readonly ledgerAccountPlaceholder: boolean;
  readonly preparationAvailable: boolean;
  readonly readiness: YieldEntryReadiness;
}): YieldEntryCta => {
  if (connected && hasNoYields) return { _tag: "Hidden" };
  if (connected && !ledgerAccountPlaceholder) {
    return {
      _tag: "Submit",
      disabled:
        readiness._tag !== "Ready" || !preparationAvailable || kycBlocking,
      loading: readiness._tag === "Refreshing" || kycLoading,
    };
  }
  if (externalProviders) return { _tag: "Hidden" };
  const appLoading = readiness._tag === "Loading";
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
        readonly selectedYieldHasActivePosition: boolean;
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
      ? getMinStakeAmount(input.yield, input.selectedYieldHasActivePosition)
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
    selectedYieldHasActivePosition: input.selectedYieldHasActivePosition,
    yield: input.entry.yield,
  });
  const amount =
    input.amountInitialization === "DefaultToMinimum" &&
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
      connected: input.connected,
      externalProviders: input.externalProviders,
      hasNoYields: input.hasNoYields,
      kycBlocking: input.isKycBlocking,
      kycLoading: input.isKycLoading,
      ledgerAccountPlaceholder: input.isLedgerAccountPlaceholder,
      preparationAvailable: preparation !== null,
      readiness: input.readiness,
    }),
    estimatedRewards: getYieldEstimatedRewards({
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
