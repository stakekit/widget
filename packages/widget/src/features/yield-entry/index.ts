import BigNumber from "bignumber.js";
import { Array as EArray, Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import { runWidgetNavigationCommand } from "../../app/runtime/navigation";
import { getMaxAmount } from "../../domain";
import { ActionCommand } from "../../domain/schema/action-models";
import type { AdditionalAddresses } from "../../domain/schema/address-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../domain/schema/earn-models";
import type { WalletAddress, YieldId } from "../../domain/schema/identifiers";
import type { AppToken, TronResource } from "../../domain/schema/legacy-models";
import type { PositionsData } from "../../domain/types/positions";
import {
  getMinStakeAmount,
  getMinUnstakeAmount,
  isForceMaxAmount,
} from "../../domain/types/stake";
import type { ValidatorKey } from "../../domain/types/validators";
import {
  getYieldActionArg,
  isBittensorStaking,
} from "../../domain/types/yields";
import type { WidgetNavigation } from "../../services/navigation/widget-navigation";
import type { TrackingService } from "../../services/tracking/tracking-service";
import type { WalletScopeKey } from "../../services/wallet/domain/scope";
import { WalletModal } from "../../services/wallet/wallet-modal";
import { getRewardRateFormatted } from "../../shared/lib/formatters";
import { formatNumber } from "../../shared/lib/number-format";
import {
  type ClassicFlowSession,
  classicFlowSessionStore,
  makeStartClassicFlowSession,
} from "../classic-transaction-flow/facade";
import type { YieldSummaryProvider } from "../yield-summary";

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

type YieldEntryPreparation = NonNullable<
  ReturnType<typeof makeYieldEntryActionCommand>
>;

type SubmitYieldEntry = Readonly<{
  readonly connected: boolean;
  readonly destination: ClassicFlowSession["destination"];
  readonly kycBlocked: boolean;
  readonly preparation: YieldEntryPreparation | null;
  readonly providers: ReadonlyArray<YieldSummaryProvider>;
  readonly validationHasErrors: boolean;
  readonly walletScope: WalletScopeKey | null;
}>;

type YieldEntryCtaActionOf<Tag extends string> = Readonly<{
  readonly _tag: Tag;
  readonly disabled: boolean;
  readonly loading: boolean;
}>;

/** Tagged per action so views can match each branch exhaustively. */
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

export type YieldEntryFacadeInput = Readonly<{
  readonly additionalValidationErrors?: Readonly<Record<string, boolean>>;
  readonly availableAmount: BigNumber | null;
  readonly canSubmit: boolean;
  readonly connected: boolean;
  readonly defaultToMinimum: boolean;
  readonly destination: ClassicFlowSession["destination"];
  readonly entry: YieldEntryInput;
  readonly externalProviders: boolean;
  readonly hasNoYields: boolean;
  readonly isAppLoading: boolean;
  readonly isFetching: boolean;
  readonly isKycBlocking: boolean;
  readonly isKycLoading: boolean;
  readonly isLedgerAccountPlaceholder: boolean;
  readonly isOwnerCurrent: boolean;
  readonly isWalletConnecting: boolean;
  readonly positionsData: PositionsData;
  readonly providers: ReadonlyArray<YieldSummaryProvider> | null;
  readonly submitted: boolean;
  readonly validateAmount: boolean;
  readonly wallet: YieldEntryWallet;
  readonly walletScope: WalletScopeKey | null;
}>;

type YieldEntryCommandRequirements =
  | TrackingService
  | WalletModal
  | WidgetNavigation;

type YieldEntryFacadeOptions = Readonly<{
  readonly markSubmitted: (context: Atom.FnContext) => void;
  readonly onConnectWallet?: (
    context: Atom.FnContext
  ) => Effect.Effect<unknown, unknown, YieldEntryCommandRequirements>;
  readonly runAddLedgerAccount: (
    context: Atom.FnContext
  ) => Effect.Effect<unknown, unknown, YieldEntryCommandRequirements>;
  readonly refreshKyc: (context: Atom.FnContext) => void;
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
  if (hasNoYields) return { _tag: "Hidden" };
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

export const makeYieldEntry = (
  inputAtom: Atom.Atom<YieldEntryFacadeInput>,
  options: YieldEntryFacadeOptions
) => {
  const viewAtom = Atom.make((get) => {
    const input = get(inputAtom);
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
      submitted: input.submitted,
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
  }).pipe(Atom.withLabel("yieldEntryFacadeViewAtom"));

  const submitAtom = appRuntime
    .fn(
      (_input: undefined, context) => {
        const input = context(inputAtom);
        const view = context(viewAtom);
        if (!input.isOwnerCurrent) {
          return Effect.succeed("stale-owner" as const);
        }
        if (
          !input.connected &&
          (input.externalProviders || input.isWalletConnecting)
        ) {
          return Effect.succeed("unavailable" as const);
        }
        if (input.connected && input.isLedgerAccountPlaceholder) {
          return options
            .runAddLedgerAccount(context)
            .pipe(Effect.as("ledger-account" as const));
        }
        if (!input.connected && options.onConnectWallet) {
          return Effect.all(
            [
              options.onConnectWallet(context),
              runSubmitYieldEntry(
                {
                  connected: false,
                  destination: input.destination,
                  kycBlocked: false,
                  preparation: view.preparation,
                  providers: input.providers ?? [],
                  validationHasErrors: false,
                  walletScope: null,
                },
                context
              ),
            ],
            { concurrency: "unbounded", discard: true }
          ).pipe(Effect.as("connecting-wallet" as const));
        }
        if (input.connected) {
          options.markSubmitted(context);
        }
        return runSubmitYieldEntry(
          {
            connected: input.connected,
            destination: input.destination,
            kycBlocked: input.isKycBlocking,
            preparation: view.preparation,
            providers: input.providers ?? [],
            validationHasErrors: view.validation.hasErrors,
            walletScope: input.walletScope,
          },
          context
        );
      },
      { concurrent: false }
    )
    .pipe(Atom.keepAlive, Atom.withLabel("yieldEntryFacadeSubmitAtom"));

  const refreshKycAtom = Atom.fnSync(
    (_input: undefined, context) => options.refreshKyc(context),
    { initialValue: undefined }
  ).pipe(Atom.withLabel("yieldEntryFacadeRefreshKycAtom"));

  return { refreshKycAtom, submitAtom, viewAtom } as const;
};

const runSubmitYieldEntry = (
  input: SubmitYieldEntry,
  context: Atom.FnContext
) => {
  const registry = context.registry;
  if (!input.connected || !input.walletScope) {
    return WalletModal.use((modal) => modal.openConnect).pipe(
      Effect.as("connecting-wallet" as const)
    );
  }
  if (input.validationHasErrors) {
    return Effect.succeed("invalid" as const);
  }
  if (!input.preparation) {
    return Effect.succeed("unavailable" as const);
  }
  if (input.kycBlocked) {
    return Effect.succeed("kyc-blocked" as const);
  }

  const start = makeStartClassicFlowSession({
    _tag: "Enter",
    request: input.preparation.command,
    selectedToken: input.preparation.selectedToken,
    gasFeeToken: input.preparation.gasFeeToken,
    providersDetails: input.providers,
    selectedStake: input.preparation.selectedYield,
    selectedValidators: input.preparation.selectedValidators,
    walletScope: input.walletScope,
  });
  context.set(classicFlowSessionStore.startAtom, {
    ...start,
    destination: input.destination,
  });
  const startedSession = registry
    .get(classicFlowSessionStore.startAtom)
    .pipe(Option.getOrThrow);
  return runWidgetNavigationCommand({
    _tag: "Push",
    path: input.destination.reviewPath,
  }).pipe(
    Effect.tapError(() =>
      Effect.sync(() => {
        registry.set(classicFlowSessionStore.clearAtom, startedSession.epoch);
      })
    ),
    Effect.as("submitted" as const)
  );
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

export const getYieldEntryEstimatedRewards = ({
  amount,
  providers,
  validators,
  yield: selectedYield,
}: {
  readonly amount: BigNumber;
  readonly providers: ReadonlyArray<YieldSummaryProvider> | null;
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
