import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type {
  WalletCommandIdentity,
  WalletScopeKey,
} from "../../../../services/wallet/domain/scope";
import {
  type ClassicTransactionFlowEnterMount,
  startClassicTransactionFlowAtom,
} from "../../../classic-transaction-flow/state";
import type { YieldSummaryProvider } from "../../../yield-summary/state";
import {
  projectYieldEntry,
  type YieldEntryProjectionInput,
} from "../../model/yield-entry";
import { resolveYieldEntrySubmission } from "../../model/yield-entry-submission";
import { YieldEntrySubmissionService } from "../orchestration/yield-entry-submission-service";

export type YieldEntryFacadeInput = Omit<
  YieldEntryProjectionInput,
  "providers"
> &
  Readonly<{
    readonly isWalletConnecting: boolean;
    readonly mount: ClassicTransactionFlowEnterMount;
    readonly providers: ReadonlyArray<YieldSummaryProvider> | null;
    readonly validationKey: string;
    readonly walletCommandIdentity: WalletCommandIdentity;
    readonly walletScope: WalletScopeKey | null;
  }>;

export const makeYieldEntry = (inputAtom: Atom.Atom<YieldEntryFacadeInput>) => {
  const submittedValidationKeyAtom = Atom.make<string | null>(null).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel("yieldEntrySubmittedValidationKeyAtom")
  );
  const viewAtom = Atom.make((get) => {
    const input = get(inputAtom);
    return projectYieldEntry({
      input,
      submitted: get(submittedValidationKeyAtom) === input.validationKey,
    });
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("yieldEntryFacadeViewAtom"));

  const submitAtom = walletRuntime
    .fn(
      (_input: undefined, context) => {
        const input = context(inputAtom);
        const view = context(viewAtom);
        const decision = resolveYieldEntrySubmission({
          connected: input.connected,
          externalProviders: input.externalProviders,
          isLedgerAccountPlaceholder: input.isLedgerAccountPlaceholder,
          isWalletConnecting: input.isWalletConnecting,
          kycBlocked: input.isKycBlocking,
          preparationAvailable: view.preparation !== null,
          validationHasErrors: view.validation.hasErrors,
          walletScopeAvailable: input.walletScope !== null,
        });

        return Effect.gen(function* () {
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
              context.set(submittedValidationKeyAtom, input.validationKey);
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
                    providersDetails: input.providers ?? [],
                    selectedStake: view.preparation.selectedYield,
                    selectedValidators: view.preparation.selectedValidators,
                    walletScope: input.walletScope,
                  },
                  mount: input.mount,
                }
              );
              return outcome._tag === "Started"
                ? ("submitted" as const)
                : ("stale-owner" as const);
            }
          }
        });
      },
      { concurrent: false }
    )
    .pipe(Atom.keepAlive, Atom.withLabel("yieldEntryFacadeSubmitAtom"));

  return { submitAtom, viewAtom } as const;
};
