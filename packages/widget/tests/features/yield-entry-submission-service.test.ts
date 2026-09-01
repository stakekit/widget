import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Stream } from "effect";
import { YieldEntrySubmissionService } from "../../src/features/yield-entry/state/orchestration/yield-entry-submission-service";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { walletCommandIdentity } from "../../src/services/wallet/wallet-command-identity";
import { WalletIntegrationError } from "../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";

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

type SubmissionDependencies = TrackingService | WalletModal | WalletService;

const makeSubmissionLayer = (
  dependencies: Layer.Layer<SubmissionDependencies>
) => YieldEntrySubmissionService.layer.pipe(Layer.provide(dependencies));

describe("YieldEntrySubmissionService", () => {
  it.effect("tracks a connection intent and opens the wallet modal", () =>
    Effect.gen(function* () {
      const events: string[] = [];
      let opened = 0;
      const dependencies = Layer.mergeAll(
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: (event) =>
              Effect.sync(() => {
                events.push(event);
              }),
            trackPageView: () => Effect.void,
          })
        ),
        Layer.succeed(
          WalletModal,
          WalletModal.of({
            closeChain: Effect.void,
            install: () => Effect.void,
            openConnect: Effect.sync(() => {
              opened += 1;
            }),
            uninstall: () => Effect.void,
          })
        ),
        Layer.succeed(
          WalletService,
          WalletService.of({
            addLedgerAccount: vi.fn(() => Effect.die("unexpected")),
            state: Effect.succeed(disconnectedWalletState),
            states: Stream.succeed(disconnectedWalletState),
            wagmiConfig: {},
          } as never)
        )
      );

      const outcome = yield* Effect.scoped(
        YieldEntrySubmissionService.use((service) =>
          service.connectWallet(
            walletCommandIdentity(disconnectedWalletState.connection)
          )
        )
      ).pipe(Effect.provide(makeSubmissionLayer(dependencies)));

      expect(outcome).toEqual({ _tag: "Accepted" });
      expect(events).toEqual(["connectWalletClicked"]);
      expect(opened).toBe(1);
    })
  );

  it.effect(
    "tracks a connection intent but rejects a stale connected wallet",
    () =>
      Effect.gen(function* () {
        const events: string[] = [];
        let opened = 0;
        const dependencies = Layer.mergeAll(
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent: (event) =>
                Effect.sync(() => {
                  events.push(event);
                }),
              trackPageView: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletModal,
            WalletModal.of({
              closeChain: Effect.void,
              install: () => Effect.void,
              openConnect: Effect.sync(() => {
                opened += 1;
              }),
              uninstall: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletService,
            WalletService.of({
              addLedgerAccount: vi.fn(() => Effect.die("unexpected")),
              state: Effect.succeed(connectedWalletState),
              states: Stream.succeed(connectedWalletState),
              wagmiConfig: {},
            } as never)
          )
        );

        const outcome = yield* Effect.scoped(
          YieldEntrySubmissionService.use((service) =>
            service.connectWallet(
              walletCommandIdentity(disconnectedWalletState.connection)
            )
          )
        ).pipe(Effect.provide(makeSubmissionLayer(dependencies)));

        expect(outcome).toEqual({ _tag: "RejectedStale" });
        expect(events).toEqual(["connectWalletClicked"]);
        expect(opened).toBe(0);
      })
  );

  it.effect(
    "rejects a connection completion when the wallet changes in flight",
    () =>
      Effect.gen(function* () {
        let current = disconnectedWalletState;
        let opened = 0;
        const dependencies = Layer.mergeAll(
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent: () => Effect.void,
              trackPageView: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletModal,
            WalletModal.of({
              closeChain: Effect.void,
              install: () => Effect.void,
              openConnect: Effect.sync(() => {
                opened += 1;
                current = connectedWalletState;
              }),
              uninstall: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletService,
            WalletService.of({
              addLedgerAccount: () => Effect.die("unexpected"),
              state: Effect.sync(() => current),
              states: Stream.fromEffect(Effect.sync(() => current)),
              wagmiConfig: {},
            } as never)
          )
        );

        const outcome = yield* Effect.scoped(
          YieldEntrySubmissionService.use((service) =>
            service.connectWallet(
              walletCommandIdentity(disconnectedWalletState.connection)
            )
          )
        ).pipe(Effect.provide(makeSubmissionLayer(dependencies)));

        expect(outcome).toEqual({ _tag: "RejectedStale" });
        expect(opened).toBe(1);
      })
  );

  it.effect("tracks and delegates an eligible Ledger account request", () =>
    Effect.gen(function* () {
      const events: string[] = [];
      const addLedgerAccount = vi.fn(() =>
        Effect.succeed({ _tag: "Added" } as const)
      );
      const dependencies = Layer.mergeAll(
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: (event) =>
              Effect.sync(() => {
                events.push(event);
              }),
            trackPageView: () => Effect.void,
          })
        ),
        Layer.succeed(
          WalletModal,
          WalletModal.of({
            closeChain: Effect.void,
            install: () => Effect.void,
            openConnect: Effect.void,
            uninstall: () => Effect.void,
          })
        ),
        Layer.succeed(
          WalletService,
          WalletService.of({
            addLedgerAccount,
            state: Effect.succeed(ledgerPlaceholderWalletState),
            states: Stream.succeed(ledgerPlaceholderWalletState),
            wagmiConfig: {},
          } as never)
        )
      );

      const outcome = yield* Effect.scoped(
        YieldEntrySubmissionService.use((service) =>
          service.addLedgerAccount(
            walletCommandIdentity(ledgerPlaceholderWalletState.connection)
          )
        )
      ).pipe(Effect.provide(makeSubmissionLayer(dependencies)));

      expect(outcome).toEqual({ _tag: "Accepted" });
      expect(events).toEqual(["addLedgerAccountClicked"]);
      expect(addLedgerAccount).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "tracks but rejects Ledger setup when the canonical wallet is stale",
    () =>
      Effect.gen(function* () {
        const events: string[] = [];
        const addLedgerAccount = vi.fn(() =>
          Effect.succeed({ _tag: "Added" } as const)
        );
        let closed = 0;
        const dependencies = Layer.mergeAll(
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent: (event) =>
                Effect.sync(() => {
                  events.push(event);
                }),
              trackPageView: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletModal,
            WalletModal.of({
              closeChain: Effect.sync(() => {
                closed += 1;
              }),
              install: () => Effect.void,
              openConnect: Effect.void,
              uninstall: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletService,
            WalletService.of({
              addLedgerAccount,
              state: Effect.succeed(connectedWalletState),
              states: Stream.succeed(connectedWalletState),
              wagmiConfig: {},
            } as never)
          )
        );

        const outcome = yield* Effect.scoped(
          YieldEntrySubmissionService.use((service) =>
            service.addLedgerAccount(
              walletCommandIdentity(ledgerPlaceholderWalletState.connection)
            )
          )
        ).pipe(Effect.provide(makeSubmissionLayer(dependencies)));

        expect(outcome).toEqual({ _tag: "RejectedStale" });
        expect(events).toEqual(["addLedgerAccountClicked"]);
        expect(addLedgerAccount).not.toHaveBeenCalled();
        expect(closed).toBe(0);
      })
  );

  it.effect(
    "retains a typed Ledger integration failure without closing the modal",
    () =>
      Effect.gen(function* () {
        const failure = new WalletIntegrationError({
          message: "request failed",
          operation: "ledger-request-account",
        });
        let closed = 0;
        const dependencies = Layer.mergeAll(
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent: () => Effect.void,
              trackPageView: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletModal,
            WalletModal.of({
              closeChain: Effect.sync(() => {
                closed += 1;
              }),
              install: () => Effect.void,
              openConnect: Effect.void,
              uninstall: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletService,
            WalletService.of({
              addLedgerAccount: () => Effect.fail(failure),
              state: Effect.succeed(ledgerPlaceholderWalletState),
              states: Stream.succeed(ledgerPlaceholderWalletState),
              wagmiConfig: {},
            } as never)
          )
        );

        const exit = yield* Effect.exit(
          Effect.scoped(
            YieldEntrySubmissionService.use((service) =>
              service.addLedgerAccount(
                walletCommandIdentity(ledgerPlaceholderWalletState.connection)
              )
            )
          ).pipe(Effect.provide(makeSubmissionLayer(dependencies)))
        );

        expect(Exit.isFailure(exit)).toBe(true);
        expect(
          Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : null
        ).toMatchObject({ value: failure });
        expect(closed).toBe(0);
      })
  );

  it.effect("serializes duplicate connection operations", () =>
    Effect.gen(function* () {
      const order: string[] = [];
      const program = Effect.gen(function* () {
        const firstOpened = yield* Deferred.make<void>();
        const releaseFirst = yield* Deferred.make<void>();
        let invocation = 0;
        const dependencies = Layer.mergeAll(
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent: () => Effect.void,
              trackPageView: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletModal,
            WalletModal.of({
              closeChain: Effect.void,
              install: () => Effect.void,
              openConnect: Effect.gen(function* () {
                invocation += 1;
                order.push(`start:${invocation}`);
                if (invocation === 1) {
                  yield* Deferred.succeed(firstOpened, undefined);
                  yield* Deferred.await(releaseFirst);
                }
                order.push(`end:${invocation}`);
              }),
              uninstall: () => Effect.void,
            })
          ),
          Layer.succeed(
            WalletService,
            WalletService.of({
              addLedgerAccount: () => Effect.die("unexpected"),
              state: Effect.succeed(disconnectedWalletState),
              states: Stream.succeed(disconnectedWalletState),
              wagmiConfig: {},
            } as never)
          )
        );
        const layer = makeSubmissionLayer(dependencies);

        return yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* YieldEntrySubmissionService;
            const first = yield* service
              .connectWallet(
                walletCommandIdentity(disconnectedWalletState.connection)
              )
              .pipe(Effect.forkScoped({ startImmediately: true }));
            yield* Deferred.await(firstOpened);
            const second = yield* service
              .connectWallet(
                walletCommandIdentity(disconnectedWalletState.connection)
              )
              .pipe(Effect.forkScoped({ startImmediately: true }));
            yield* Effect.yieldNow;
            order.push("release");
            yield* Deferred.succeed(releaseFirst, undefined);
            yield* Fiber.join(first);
            yield* Fiber.join(second);
          })
        ).pipe(Effect.provide(layer));
      });

      yield* program;

      expect(order).toEqual([
        "start:1",
        "release",
        "end:1",
        "start:2",
        "end:2",
      ]);
    })
  );

  it.effect(
    "interrupts an owned wallet operation when its caller is interrupted",
    () =>
      Effect.gen(function* () {
        const interrupted = yield* Effect.gen(function* () {
          const opened = yield* Deferred.make<void>();
          const operationInterrupted = yield* Deferred.make<void>();
          const dependencies = Layer.mergeAll(
            Layer.succeed(
              TrackingService,
              TrackingService.of({
                trackEvent: () => Effect.void,
                trackPageView: () => Effect.void,
              })
            ),
            Layer.succeed(
              WalletModal,
              WalletModal.of({
                closeChain: Effect.void,
                install: () => Effect.void,
                openConnect: Deferred.succeed(opened, undefined).pipe(
                  Effect.andThen(Effect.never),
                  Effect.onInterrupt(() =>
                    Deferred.succeed(operationInterrupted, undefined).pipe(
                      Effect.asVoid
                    )
                  )
                ),
                uninstall: () => Effect.void,
              })
            ),
            Layer.succeed(
              WalletService,
              WalletService.of({
                addLedgerAccount: () => Effect.die("unexpected"),
                state: Effect.succeed(disconnectedWalletState),
                states: Stream.succeed(disconnectedWalletState),
                wagmiConfig: {},
              } as never)
            )
          );
          const layer = makeSubmissionLayer(dependencies);

          return yield* Effect.scoped(
            Effect.gen(function* () {
              const service = yield* YieldEntrySubmissionService;
              const caller = yield* service
                .connectWallet(
                  walletCommandIdentity(disconnectedWalletState.connection)
                )
                .pipe(Effect.forkScoped({ startImmediately: true }));
              yield* Deferred.await(opened);
              yield* Fiber.interrupt(caller);
              return yield* Deferred.isDone(operationInterrupted);
            })
          ).pipe(Effect.provide(layer));
        });

        expect(interrupted).toBe(true);
      })
  );
});
