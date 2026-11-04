import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Ref } from "effect";
import {
  addYieldEntryLedgerAccount,
  connectYieldEntryWallet,
} from "../../../src/features/yield-entry/state/yield-entry";
import { walletCommandIdentity } from "../../../src/services/wallet/wallet-command-identity";
import { WalletIntegrationError } from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import type { WalletService } from "../../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../../src/services/wallet/wallet-state";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestWallet } from "../../utils/services/wallet-service";
import { stubWalletModal } from "../../utils/wallet-modal";

const disconnectedWalletState: WalletState = {
  connection: disconnectedNormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
};

const connectedWalletConnection = {
  additionalAddresses: null,
  address: "0x1234567890123456789012345678901234567890" as never,
  chain: {} as never,
  connector: { id: "ledgerLive", uid: "ledger-a" } as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
} satisfies NormalizedWalletState;

const connectedWalletState: WalletState = {
  connection: connectedWalletConnection,
  ledger: disconnectedLedgerConnectorState,
};

const ledgerPlaceholderWalletState: WalletState = {
  ...connectedWalletState,
  connection: {
    ...connectedWalletConnection,
    isLedgerLive: true,
    isLedgerLiveAccountPlaceholder: true,
  },
};

type AddLedgerAccount = WalletService["Service"]["addLedgerAccount"];
type AddLedgerAccountInput = Parameters<AddLedgerAccount>[0];

type SubmissionHarnessOptions = Readonly<{
  readonly addLedgerAccount?: AddLedgerAccount;
  readonly initialWalletState: WalletState;
  readonly openConnect?: (
    setWalletState: (state: WalletState) => Effect.Effect<void>
  ) => Effect.Effect<void>;
}>;

const makeSubmissionHarness = Effect.fn("makeSubmissionHarness")(function* (
  options: SubmissionHarnessOptions
) {
  const tracking = yield* makeTestTracking();
  const ledgerRequests = yield* Ref.make<ReadonlyArray<AddLedgerAccountInput>>(
    []
  );
  const openConnectCount = yield* Ref.make(0);
  const closeChainCount = yield* Ref.make(0);
  const addLedgerAccount = options.addLedgerAccount;
  const wallet = yield* makeTestWallet({
    ...(addLedgerAccount
      ? {
          addLedgerAccount: (input: AddLedgerAccountInput) =>
            Ref.update(ledgerRequests, (current) => [...current, input]).pipe(
              Effect.andThen(addLedgerAccount(input))
            ),
        }
      : {}),
    initialState: options.initialWalletState,
  });
  const modal = stubWalletModal({
    closeChain: Ref.update(closeChainCount, (count) => count + 1),
    openConnect: Ref.update(openConnectCount, (count) => count + 1).pipe(
      Effect.andThen(options.openConnect?.(wallet.setState) ?? Effect.void)
    ),
  });
  const dependencies = Layer.mergeAll(
    tracking.layer,
    wallet.layer,
    Layer.succeed(WalletModal, modal)
  );
  const provide = Effect.provide(dependencies);

  return {
    addLedgerAccount: (
      expected: Parameters<typeof addYieldEntryLedgerAccount>[0]
    ) => addYieldEntryLedgerAccount(expected).pipe(provide),
    closeChainCount: Ref.get(closeChainCount),
    connectWallet: (expected: Parameters<typeof connectYieldEntryWallet>[0]) =>
      connectYieldEntryWallet(expected).pipe(provide),
    ledgerRequests: Ref.get(ledgerRequests),
    openConnectCount: Ref.get(openConnectCount),
    setWalletState: wallet.setState,
    trackedEvents: tracking.trackedEvents.pipe(
      Effect.map((events) => events.map(({ event }) => event))
    ),
  } as const;
});

describe("Yield Entry submission", () => {
  it.effect("tracks a connection intent and opens the wallet modal", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const submission = yield* makeSubmissionHarness({
          initialWalletState: disconnectedWalletState,
        });

        const outcome = yield* submission.connectWallet(
          walletCommandIdentity(disconnectedWalletState.connection)
        );

        expect(outcome).toEqual({ _tag: "Accepted" });
        expect(yield* submission.trackedEvents).toEqual([
          "connectWalletClicked",
        ]);
        expect(yield* submission.openConnectCount).toBe(1);
      })
    )
  );

  it.effect(
    "tracks a connection intent but rejects a stale connected wallet",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const submission = yield* makeSubmissionHarness({
            initialWalletState: connectedWalletState,
          });

          const outcome = yield* submission.connectWallet(
            walletCommandIdentity(disconnectedWalletState.connection)
          );

          expect(outcome).toEqual({ _tag: "RejectedStale" });
          expect(yield* submission.trackedEvents).toEqual([
            "connectWalletClicked",
          ]);
          expect(yield* submission.openConnectCount).toBe(0);
        })
      )
  );

  it.effect(
    "rejects a connection completion when the wallet changes in flight",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const submission = yield* makeSubmissionHarness({
            initialWalletState: disconnectedWalletState,
            openConnect: (setWalletState) =>
              setWalletState(connectedWalletState),
          });

          const outcome = yield* submission.connectWallet(
            walletCommandIdentity(disconnectedWalletState.connection)
          );

          expect(outcome).toEqual({ _tag: "RejectedStale" });
          expect(yield* submission.openConnectCount).toBe(1);
        })
      )
  );

  it.effect("tracks and delegates an eligible Ledger account request", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const submission = yield* makeSubmissionHarness({
          addLedgerAccount: () => Effect.succeed({ _tag: "Added" }),
          initialWalletState: ledgerPlaceholderWalletState,
        });

        const outcome = yield* submission.addLedgerAccount(
          walletCommandIdentity(ledgerPlaceholderWalletState.connection)
        );

        expect(outcome).toEqual({ _tag: "Accepted" });
        expect(yield* submission.trackedEvents).toEqual([
          "addLedgerAccountClicked",
        ]);
        expect(yield* submission.ledgerRequests).toHaveLength(1);
      })
    )
  );

  it.effect(
    "tracks but rejects Ledger setup when the canonical wallet is stale",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const submission = yield* makeSubmissionHarness({
            addLedgerAccount: () => Effect.succeed({ _tag: "Added" }),
            initialWalletState: connectedWalletState,
          });

          const outcome = yield* submission.addLedgerAccount(
            walletCommandIdentity(ledgerPlaceholderWalletState.connection)
          );

          expect(outcome).toEqual({ _tag: "RejectedStale" });
          expect(yield* submission.trackedEvents).toEqual([
            "addLedgerAccountClicked",
          ]);
          expect(yield* submission.ledgerRequests).toEqual([]);
          expect(yield* submission.closeChainCount).toBe(0);
        })
      )
  );

  it.effect(
    "retains a typed Ledger integration failure without closing the modal",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const failure = new WalletIntegrationError({
            message: "request failed",
            operation: "ledger-request-account",
          });
          const submission = yield* makeSubmissionHarness({
            addLedgerAccount: () => Effect.fail(failure),
            initialWalletState: ledgerPlaceholderWalletState,
          });

          const exit = yield* Effect.exit(
            submission.addLedgerAccount(
              walletCommandIdentity(ledgerPlaceholderWalletState.connection)
            )
          );

          expect(Exit.isFailure(exit)).toBe(true);
          expect(
            Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : null
          ).toMatchObject({ value: failure });
          expect(yield* submission.closeChainCount).toBe(0);
        })
      )
  );
});
