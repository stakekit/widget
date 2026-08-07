import { Context, Effect, Layer } from "effect";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import type {
  WalletIntegrationError,
  WalletRuntimeInvariantError,
} from "../../../../services/wallet/domain/errors";
import {
  sameWalletCommandIdentity,
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "../../../../services/wallet/domain/scope";
import { WalletAccountSetupService } from "../../../../services/wallet/wallet-account-setup-service";
import { WalletModal } from "../../../../services/wallet/wallet-modal";
import { WalletService } from "../../../../services/wallet/wallet-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";

type YieldEntryWalletActionOutcome =
  | Readonly<{ readonly _tag: "Accepted" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

type YieldEntrySubmissionServiceApi = Readonly<{
  readonly addLedgerAccount: (
    expected: WalletCommandIdentity
  ) => Effect.Effect<
    YieldEntryWalletActionOutcome,
    WalletIntegrationError | WalletRuntimeInvariantError
  >;
  readonly connectWallet: (
    expected: WalletCommandIdentity
  ) => Effect.Effect<
    YieldEntryWalletActionOutcome,
    WalletRuntimeInvariantError
  >;
}>;

const makeYieldEntrySubmissionService = Effect.fn(
  "makeYieldEntrySubmissionService"
)(function* () {
  const modal = yield* WalletModal;
  const accountSetup = yield* WalletAccountSetupService;
  const tracking = yield* TrackingService;
  const wallet = yield* WalletService;
  const operations = yield* makeScopedSerialOperations();

  const connectWallet = Effect.fn("connectWallet")(function* (
    expected: WalletCommandIdentity
  ) {
    return yield* operations.run(
      Effect.gen(function* () {
        const before = yield* wallet.state;
        const current = walletCommandIdentity(before.connection);
        if (!sameWalletCommandIdentity(expected, current)) {
          yield* tracking.trackEvent("connectWalletClicked");
          return { _tag: "RejectedStale" } as const;
        }

        yield* Effect.all(
          [tracking.trackEvent("connectWalletClicked"), modal.openConnect],
          { concurrency: "unbounded", discard: true }
        );
        const after = yield* wallet.state;
        return sameWalletCommandIdentity(
          expected,
          walletCommandIdentity(after.connection)
        )
          ? ({ _tag: "Accepted" } as const)
          : ({ _tag: "RejectedStale" } as const);
      })
    );
  });

  const addLedgerAccount = Effect.fn("addLedgerAccount")(function* (
    expected: WalletCommandIdentity
  ) {
    return yield* operations.run(
      Effect.gen(function* () {
        const state = yield* wallet.state;
        const eligible =
          sameWalletCommandIdentity(
            expected,
            walletCommandIdentity(state.connection)
          ) &&
          state.connection.status === "connected" &&
          state.connection.isLedgerLiveAccountPlaceholder;
        if (!eligible) {
          yield* tracking.trackEvent("addLedgerAccountClicked");
          return { _tag: "RejectedStale" } as const;
        }

        const [, outcome] = yield* Effect.all(
          [
            tracking.trackEvent("addLedgerAccountClicked"),
            accountSetup.addLedgerAccount({ expected }),
          ],
          { concurrency: "unbounded" }
        );
        return outcome._tag === "Added"
          ? ({ _tag: "Accepted" } as const)
          : ({ _tag: "RejectedStale" } as const);
      })
    );
  });

  return {
    addLedgerAccount,
    connectWallet,
  } satisfies YieldEntrySubmissionServiceApi;
});

export class YieldEntrySubmissionService extends Context.Service<
  YieldEntrySubmissionService,
  YieldEntrySubmissionServiceApi
>()("stakekit/widget/features/yield-entry/YieldEntrySubmissionService") {
  static readonly layer = Layer.effect(
    YieldEntrySubmissionService,
    makeYieldEntrySubmissionService()
  );
}
