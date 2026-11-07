import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";

import { ActionCommand } from "../../../domain/action/models";
import type { TronResource } from "../../../domain/action/tron-resource";
import type {
  EarnValidator,
  EarnValidatorKey,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import {
  getMaxAmount,
  getMinStakeAmount,
  getMinUnstakeAmount,
  isForceMaxAmount,
  stakeTokenSameAsGasToken,
} from "../../../domain/earn/stake";
import { getYieldActionArg } from "../../../domain/earn/yield";
import {
  exactZero,
  truncateToTokenDecimals,
} from "../../../domain/finance/exact";
import type {
  ProviderOption,
  WalletAddress,
} from "../../../domain/identity/identifiers";
import {
  getTokenArgumentAddress,
  type Token,
} from "../../../domain/token/token";
import type { AdditionalAddresses } from "../../../domain/wallet/address";
import { getYieldEstimatedRewards } from "../../yield-summary/index";

type YieldEntryInput = Readonly<{
  readonly amount: BigNumber;
  readonly selectedProviderOption: ProviderOption | null;
  readonly token: Token | null;
  readonly tronResource: TronResource | null;
  readonly useMaxAmount: boolean;
  readonly validators: ReadonlyMap<EarnValidatorKey, EarnValidator>;
  readonly yield: EarnYieldWithProvider | null;
}>;

type YieldEntryWallet = Readonly<{
  readonly additionalAddresses: AdditionalAddresses | null;
  readonly address: WalletAddress | null;
  readonly isLedgerLive: boolean;
}>;

type YieldEntryRewardProvider = Readonly<{
  readonly rewardRate?: BigNumber | number | null | undefined;
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
  if (!selectedYield.status.enter) return null;

  const providerIdRequired = Boolean(
    getYieldActionArg(selectedYield, "enter", "providerId")?.required
  );
  if (providerIdRequired && !entry.selectedProviderOption) return null;

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

  const executableAmount = truncateToTokenDecimals(
    entry.amount,
    entry.token.decimals
  );

  return {
    command: ActionCommand.make({
      address: wallet.address,
      yieldId: selectedYield.id,
      arguments: {
        amount: executableAmount.toFixed(),
        inputToken: getTokenArgumentAddress(entry.token),
        ...(wallet.isLedgerLive ? { ledgerWalletApiCompatible: true } : {}),
        ...(entry.tronResource ? { tronResource: entry.tronResource } : {}),
        ...(entry.useMaxAmount ? { useMaxAmount: true } : {}),
        ...(entry.selectedProviderOption
          ? { providerId: entry.selectedProviderOption }
          : {}),
        ...validatorArguments,
        ...wallet.additionalAddresses,
      },
    }),
    gasFeeToken: selectedYield.mechanics.gasFeeToken,
    selectedProviderOption: entry.selectedProviderOption,
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
  | (YieldEntryCtaActionOf<"Submit"> &
      Readonly<{
        /** Why the disabled CTA cannot submit, once nothing is loading. */
        readonly blocker: YieldEntryCtaBlocker | null;
      }>);

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

/** Why a connected entry cannot be submitted, for the CTA to name. */
export type YieldEntryCtaBlocker =
  | "AboveMaximum"
  | "BelowMinimum"
  | "EnterAmount"
  | "InsufficientBalance"
  | "VerifyIdentity";

export const getYieldEntryCta = ({
  balanceShort,
  blocker,
  connected,
  externalProviders,
  hasNoYields,
  kycBlocking,
  kycLoading,
  ledgerAccountPlaceholder,
  preparationAvailable,
  readiness,
}: {
  /**
   * The balance cannot fund the entry: the amount exceeds it, or it falls
   * short of any entry the yield takes.
   */
  readonly balanceShort: boolean;
  readonly blocker: YieldEntryCtaBlocker | null;
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
    const disabled =
      readiness._tag !== "Ready" ||
      !preparationAvailable ||
      kycBlocking ||
      balanceShort;
    const loading = readiness._tag === "Refreshing" || kycLoading;
    const settled = disabled && !loading && readiness._tag !== "Loading";
    return {
      _tag: "Submit",
      blocker: settled ? blocker : null,
      disabled,
      loading,
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
        readonly pricePerShare: BigNumber | null;
      }>
  );

const resolveMinimum = (
  input: YieldAmountConstraintsInput,
  forceMax: boolean
) => {
  if (forceMax) return input.availableAmount;
  if (!input.yield) return null;

  return input.type === "enter"
    ? getMinStakeAmount(input.yield, input.selectedYieldHasActivePosition)
    : getMinUnstakeAmount(input.yield, input.pricePerShare);
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
  const candidateMaximum = configuredMaximum == null ? null : configuredMaximum;
  const maximum = resolveMaximum(input, forceMax, candidateMaximum);
  const allowedMaximum = getMaxAmount({
    availableAmount: input.availableAmount ?? exactZero(),
    gasEstimateTotal: exactZero(),
    integrationMaxLimit: maximum,
  });

  return {
    allowedMaximum,
    allowedMinimum: minimum ?? exactZero(),
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

/**
 * The first reason, in the order the user can act on them. The limits hold
 * without a known balance too (a hidden confidential one), as submission
 * checks them either way.
 */
const getYieldEntryCtaBlocker = ({
  amount,
  amountValidation,
  balanceWarning,
  forceMax,
  kycBlocking,
  maximum,
  minimum,
}: {
  readonly amount: BigNumber;
  readonly amountValidation: ReturnType<typeof getYieldAmountValidation>;
  readonly balanceWarning: YieldEntryBalanceWarning | null;
  readonly forceMax: boolean;
  readonly kycBlocking: boolean;
  readonly maximum: BigNumber | null;
  readonly minimum: BigNumber;
}): YieldEntryCtaBlocker | null => {
  if (kycBlocking) return "VerifyIdentity";
  if (balanceWarning) return "InsufficientBalance";
  // A force-max yield takes the whole balance, so a zero amount means none.
  if (amount.isZero()) return forceMax ? "InsufficientBalance" : "EnterAmount";
  if (amountValidation.amountGreaterThanAvailable) return "InsufficientBalance";
  if (amount.isLessThan(minimum)) return "BelowMinimum";
  if (maximum && amount.isGreaterThan(maximum)) return "AboveMaximum";
  return null;
};

/**
 * Why the balance alone cannot fund an entry, known before any amount is
 * typed: there is none, or less than the yield's minimum. Only a known
 * balance of a connected wallet has one.
 */
export type YieldEntryBalanceWarning =
  | Readonly<{ readonly _tag: "NoBalance" }>
  | Readonly<{ readonly _tag: "BelowMinimum"; readonly minimum: BigNumber }>;

const getYieldEntryBalanceWarning = ({
  availableAmount,
  connected,
  forceMax,
  minimum,
}: {
  readonly availableAmount: BigNumber | null;
  readonly connected: boolean;
  readonly forceMax: boolean;
  readonly minimum: BigNumber;
}): YieldEntryBalanceWarning | null => {
  if (!connected || availableAmount === null) return null;
  if (availableAmount.isZero()) return { _tag: "NoBalance" };
  if (!forceMax && availableAmount.isLessThan(minimum)) {
    return { _tag: "BelowMinimum", minimum };
  }
  return null;
};

/** The amount the entry stands for: typed, or its minimum until one is. */
const resolveYieldEntryAmount = (
  input: YieldEntryProjectionInput,
  minimum: BigNumber
) =>
  input.amountInitialization === "DefaultToMinimum" &&
  input.entry.amount.isZero() &&
  minimum.isGreaterThan(0)
    ? minimum
    : input.entry.amount;

/**
 * The enters to simulate, built as submission would build them: `fee`, the
 * entry's own amount once the limits allow it, for the fee it costs, and
 * `reserve`, the most Max can draw on when the stake token pays the gas, for
 * what Max must leave of it. Keyed by the balance alone, the reserve holds
 * still while an amount is typed. Only a connected wallet has either.
 */
export const getYieldEntrySimulations = (input: YieldEntryProjectionInput) => {
  const { token, yield: selectedYield } = input.entry;
  if (!input.connected || !token || !selectedYield) {
    return { fee: null, reserve: null } as const;
  }

  const constraints = getYieldAmountConstraints({
    type: "enter",
    availableAmount: input.availableAmount,
    selectedYieldHasActivePosition: input.selectedYieldHasActivePosition,
    yield: selectedYield,
  });
  const amount = truncateToTokenDecimals(
    resolveYieldEntryAmount(input, constraints.allowedMinimum),
    token.decimals
  );
  const commandFor = (simulated: BigNumber, useMaxAmount: boolean) =>
    makeYieldEntryActionCommand({
      entry: { ...input.entry, amount: simulated, useMaxAmount },
      wallet: input.wallet,
    })?.command ?? null;
  // The API refuses an amount outside the limits, so only one inside them
  // is worth asking about; the most Max can draw on is the balance or the
  // yield's maximum, whichever is less.
  const usable = (candidate: BigNumber) =>
    candidate.isGreaterThan(0) &&
    candidate.isGreaterThanOrEqualTo(constraints.allowedMinimum) &&
    (input.availableAmount === null ||
      candidate.isLessThanOrEqualTo(constraints.allowedMaximum));
  const maxDraw = constraints.allowedMaximum;
  const paysGas =
    !constraints.forceMax &&
    input.availableAmount !== null &&
    stakeTokenSameAsGasToken({ stakeToken: token, yieldDto: selectedYield });

  return {
    fee: usable(amount) ? commandFor(amount, input.entry.useMaxAmount) : null,
    reserve: paysGas && usable(maxDraw) ? commandFor(maxDraw, false) : null,
  } as const;
};

export const projectYieldEntry = ({
  gasReserve = exactZero(),
  input,
  submitted,
}: {
  /**
   * What Max keeps aside of the balance for the gas (see
   * `getMaxGasReserve`); null while unknown, which leaves Max nothing to
   * fill. Typing an amount is validated against the balance alone.
   */
  readonly gasReserve?: BigNumber | null;
  readonly input: YieldEntryProjectionInput;
  readonly submitted: boolean;
}) => {
  const constraints = getYieldAmountConstraints({
    type: "enter",
    availableAmount: input.availableAmount,
    selectedYieldHasActivePosition: input.selectedYieldHasActivePosition,
    yield: input.entry.yield,
  });
  // A force-max yield takes the whole balance; nothing is kept aside.
  const maxAmount =
    gasReserve === null
      ? null
      : getMaxAmount({
          availableAmount: input.availableAmount ?? exactZero(),
          gasEstimateTotal: constraints.forceMax ? exactZero() : gasReserve,
          integrationMaxLimit: constraints.maximum,
        });
  const amount = resolveYieldEntryAmount(input, constraints.allowedMinimum);
  const entry = { ...input.entry, amount };
  const executableAmount = input.entry.token
    ? truncateToTokenDecimals(amount, input.entry.token.decimals)
    : amount;
  const amountValidation = getYieldAmountValidation({
    amount: executableAmount,
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
    entry: { ...entry, amount: executableAmount },
    wallet: input.wallet,
  });
  const balanceWarning = getYieldEntryBalanceWarning({
    availableAmount: input.availableAmount,
    connected: input.connected,
    forceMax: constraints.forceMax,
    minimum: constraints.allowedMinimum,
  });

  return {
    balanceWarning,
    constraints,
    cta: getYieldEntryCta({
      balanceShort:
        validation.errors.stakeAmountGreaterThanAvailableAmount ||
        balanceWarning !== null,
      blocker: getYieldEntryCtaBlocker({
        amount: executableAmount,
        amountValidation,
        balanceWarning,
        forceMax: constraints.forceMax,
        kycBlocking: input.isKycBlocking,
        maximum: constraints.maximum,
        minimum: constraints.allowedMinimum,
      }),
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
    /** What Max fills in; null while the gas it must leave is unknown. */
    maxAmount,
    preparation,
    amount,
    validation,
  } as const;
};
