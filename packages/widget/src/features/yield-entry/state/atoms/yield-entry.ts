import type BigNumber from "bignumber.js";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import { getKycProviderName } from "../../../../domain/earn/kyc";
import { walletCommandIdentity } from "../../../../services/wallet/wallet-scope";
import {
  type ClassicTransactionFlowEnterMount,
  startClassicTransactionFlowAtom,
} from "../../../classic-transaction-flow/index";
import {
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../../wallet/index";
import { widgetConfigAtom } from "../../../widget-configuration/index";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  makeYieldSummary,
  refreshCurrentYieldKycAtom,
} from "../../../yield-summary/index";
import {
  projectYieldEntry,
  type YieldEntryAmountInitialization,
  type YieldEntryProjectionInput,
  type YieldEntryReadiness,
} from "../../model/yield-entry";
import { resolveYieldEntrySubmission } from "../../model/yield-entry-submission";
import { YieldEntrySubmissionService } from "../orchestration/yield-entry-submission-service";

export type YieldEntryFacadeInput = Readonly<{
  readonly amountInitialization: YieldEntryAmountInitialization;
  readonly availableAmount: BigNumber | null;
  readonly entry: YieldEntryProjectionInput["entry"];
  readonly hasNoYields: boolean;
  readonly mount: ClassicTransactionFlowEnterMount;
  readonly readiness: YieldEntryReadiness;
  readonly selectedYieldHasActivePosition: boolean;
  readonly validationKey: string;
}>;

export const makeYieldEntry = (inputAtom: Atom.Atom<YieldEntryFacadeInput>) => {
  const summary = makeYieldSummary(
    Atom.make((get) => {
      const input = get(inputAtom);
      return {
        selectedProviderYieldId: input.entry.selectedProviderYieldId,
        validators: input.entry.validators,
        yield: input.entry.yield,
      };
    })
  );
  const resolvedInputAtom = Atom.make((get) => {
    const input = get(inputAtom);
    const wallet = get(walletConnectionStateAtom);
    const connected = wallet.status === "connected";
    const walletScope = get(walletScopeAtom);
    const config = get(widgetConfigAtom);
    const kyc = get(
      currentYieldKycGateAtom(
        new CurrentYieldKycGateKey({
          enabled: true,
          yieldDto: input.entry.yield,
        })
      )
    );
    const readiness = input.readiness;
    const summaryView = get(summary.viewAtom);

    return {
      input,
      isWalletConnecting: wallet.status === "connecting",
      kyc: {
        gate: kyc.gate,
        isBlocking: kyc.isBlocking,
        isChecking: kyc.isChecking,
        isLoading: kyc.isLoading,
        providerName: getKycProviderName(input.entry.yield),
      },
      projection: {
        amountInitialization: input.amountInitialization,
        availableAmount: input.availableAmount,
        connected,
        entry: input.entry,
        externalProviders: Boolean(config.externalProviders),
        hasNoYields: input.hasNoYields,
        isKycBlocking: kyc.isBlocking,
        isKycLoading: kyc.isLoading,
        isLedgerAccountPlaceholder:
          connected && wallet.isLedgerLiveAccountPlaceholder,
        providers: summaryView.providers,
        readiness,
        selectedYieldHasActivePosition: input.selectedYieldHasActivePosition,
        validateAmount: connected || input.mount._tag === "PositionStake",
        wallet: {
          additionalAddresses: connected ? wallet.additionalAddresses : null,
          address: connected ? wallet.address : null,
          isLedgerLive: wallet.isLedgerLive,
        },
      } satisfies YieldEntryProjectionInput,
      rewardToken: summaryView.rewardToken,
      walletCommandIdentity: walletCommandIdentity(wallet),
      walletScope,
    } as const;
  }).pipe(Atom.withLabel("yieldEntryResolvedInputAtom"));
  const submittedValidationKeyAtom = Atom.make<string | null>(null).pipe(
    Atom.withLabel("yieldEntrySubmittedValidationKeyAtom")
  );
  const viewAtom = Atom.make((get) => {
    const resolved = get(resolvedInputAtom);
    const readiness = resolved.projection.readiness;
    return {
      ...projectYieldEntry({
        input: resolved.projection,
        submitted:
          get(submittedValidationKeyAtom) === resolved.input.validationKey,
      }),
      appLoading: readiness._tag === "Loading",
      canSubmit: readiness._tag === "Ready" || readiness._tag === "Refreshing",
      connected: resolved.projection.connected,
      isFetching: readiness._tag === "Refreshing",
      isLedgerAccountPlaceholder:
        resolved.projection.isLedgerAccountPlaceholder,
      kyc: resolved.kyc,
      providers: resolved.projection.providers,
      readiness,
      rewardToken: resolved.rewardToken,
      walletScope: resolved.walletScope,
    } as const;
  }).pipe(Atom.withLabel("yieldEntryFacadeViewAtom"));

  const refreshKycAtom = Atom.fnSync(
    (_input: undefined, context) => {
      const input = context(inputAtom);
      context.set(
        refreshCurrentYieldKycAtom(
          new CurrentYieldKycGateKey({
            enabled: true,
            yieldDto: input.entry.yield,
          })
        ),
        undefined
      );
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("refreshYieldEntryKycAtom"));

  const submitAtom = walletRuntime
    .fn(
      (_input: undefined, context) =>
        Effect.gen(function* () {
          const input = context(resolvedInputAtom);
          const view = context(viewAtom);
          const decision = resolveYieldEntrySubmission({
            connected: input.projection.connected,
            externalProviders: input.projection.externalProviders,
            isLedgerAccountPlaceholder:
              input.projection.isLedgerAccountPlaceholder,
            isWalletConnecting: input.isWalletConnecting,
            kycBlocked: input.kyc.isBlocking,
            preparationAvailable:
              input.input.readiness._tag === "Ready" &&
              view.preparation !== null,
            validationHasErrors: view.validation.hasErrors,
            walletScopeAvailable: input.walletScope !== null,
          });

          switch (decision._tag) {
            case "AddLedgerAccount": {
              const service = yield* YieldEntrySubmissionService;
              const outcome = yield* service.addLedgerAccount(
                input.walletCommandIdentity
              );
              return outcome._tag === "Accepted"
                ? ("ledger-account" as const)
                : ("unavailable" as const);
            }
            case "ConnectWallet": {
              const service = yield* YieldEntrySubmissionService;
              const outcome = yield* service.connectWallet(
                input.walletCommandIdentity
              );
              return outcome._tag === "Accepted"
                ? ("connecting-wallet" as const)
                : ("unavailable" as const);
            }
            case "Invalid":
              context.set(
                submittedValidationKeyAtom,
                input.input.validationKey
              );
              return "invalid" as const;
            case "KycBlocked":
              return "kyc-blocked" as const;
            case "Unavailable":
              return "unavailable" as const;
            case "StartClassicFlow": {
              if (!view.preparation || !input.walletScope) {
                return yield* Effect.die(
                  "Yield Entry submission invariant violated"
                );
              }
              const outcome = yield* context.setResult(
                startClassicTransactionFlowAtom,
                {
                  intake: {
                    _tag: "Enter",
                    request: view.preparation.command,
                    selectedToken: view.preparation.selectedToken,
                    gasFeeToken: view.preparation.gasFeeToken,
                    providersDetails: input.projection.providers ?? [],
                    selectedStake: view.preparation.selectedYield,
                    selectedValidators: view.preparation.selectedValidators,
                    walletScope: input.walletScope,
                  },
                  mount: input.input.mount,
                }
              );
              return outcome._tag === "Started"
                ? ("submitted" as const)
                : ("stale-owner" as const);
            }
          }
        }),

      { concurrent: false }
    )
    .pipe(Atom.withLabel("yieldEntryFacadeSubmitAtom"));

  return { refreshKycAtom, submitAtom, viewAtom } as const;
};
