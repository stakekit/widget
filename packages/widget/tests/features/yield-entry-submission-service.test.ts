import { Cause, Deferred, Effect, Exit, Fiber, Layer, Stream } from "effect";
import { describe, expect, it, vi } from "vitest";
import { YieldEntrySubmissionService } from "../../src/features/yield-entry/state/orchestration/yield-entry-submission-service";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletIntegrationError } from "../../src/services/wallet/domain/errors";
import { walletCommandIdentity } from "../../src/services/wallet/domain/scope";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/domain/state";
import { WalletAccountSetupService } from "../../src/services/wallet/wallet-account-setup-service";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import { WalletService } from "../../src/services/wallet/wallet-service";

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
) => {
  const accountSetupLayer = WalletAccountSetupService.layer.pipe(
    Layer.provide(dependencies)
  );
  return YieldEntrySubmissionService.layer.pipe(
    Layer.provide(Layer.merge(dependencies, accountSetupLayer))
  );
};

describe("YieldEntrySubmissionService", () => {
  it("tracks a connection intent and opens the wallet modal", async () => {
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

    const outcome = await Effect.runPromise(
      Effect.scoped(
        YieldEntrySubmissionService.use((service) =>
          service.connectWallet(
            walletCommandIdentity(disconnectedWalletState.connection)
          )
        )
      ).pipe(Effect.provide(makeSubmissionLayer(dependencies)))
    );

    expect(outcome).toEqual({ _tag: "Accepted" });
    expect(events).toEqual(["connectWalletClicked"]);
    expect(opened).toBe(1);
  });

  it("tracks a connection intent but rejects a stale connected wallet", async () => {
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

    const outcome = await Effect.runPromise(
      Effect.scoped(
        YieldEntrySubmissionService.use((service) =>
          service.connectWallet(
            walletCommandIdentity(disconnectedWalletState.connection)
          )
        )
      ).pipe(Effect.provide(makeSubmissionLayer(dependencies)))
    );

    expect(outcome).toEqual({ _tag: "RejectedStale" });
    expect(events).toEqual(["connectWalletClicked"]);
    expect(opened).toBe(0);
  });

  it("rejects a connection completion when the wallet changes in flight", async () => {
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

    const outcome = await Effect.runPromise(
      Effect.scoped(
        YieldEntrySubmissionService.use((service) =>
          service.connectWallet(
            walletCommandIdentity(disconnectedWalletState.connection)
          )
        )
      ).pipe(Effect.provide(makeSubmissionLayer(dependencies)))
    );

    expect(outcome).toEqual({ _tag: "RejectedStale" });
    expect(opened).toBe(1);
  });

  it("tracks and adds a Ledger account before closing the wallet modal", async () => {
    const events: string[] = [];
    let closed = 0;
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
          state: Effect.succeed(ledgerPlaceholderWalletState),
          states: Stream.succeed(ledgerPlaceholderWalletState),
          wagmiConfig: {},
        } as never)
      )
    );

    const outcome = await Effect.runPromise(
      Effect.scoped(
        YieldEntrySubmissionService.use((service) =>
          service.addLedgerAccount(
            walletCommandIdentity(ledgerPlaceholderWalletState.connection)
          )
        )
      ).pipe(Effect.provide(makeSubmissionLayer(dependencies)))
    );

    expect(outcome).toEqual({ _tag: "Accepted" });
    expect(events).toEqual(["addLedgerAccountClicked"]);
    expect(addLedgerAccount).toHaveBeenCalledOnce();
    expect(closed).toBe(1);
  });

  it("tracks but rejects Ledger setup when the canonical wallet is stale", async () => {
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

    const outcome = await Effect.runPromise(
      Effect.scoped(
        YieldEntrySubmissionService.use((service) =>
          service.addLedgerAccount(
            walletCommandIdentity(ledgerPlaceholderWalletState.connection)
          )
        )
      ).pipe(Effect.provide(makeSubmissionLayer(dependencies)))
    );

    expect(outcome).toEqual({ _tag: "RejectedStale" });
    expect(events).toEqual(["addLedgerAccountClicked"]);
    expect(addLedgerAccount).not.toHaveBeenCalled();
    expect(closed).toBe(0);
  });

  it("retains a typed Ledger integration failure without closing the modal", async () => {
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

    const exit = await Effect.runPromiseExit(
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
  });

  it("serializes duplicate connection operations", async () => {
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

    await Effect.runPromise(program);

    expect(order).toEqual(["start:1", "release", "end:1", "start:2", "end:2"]);
  });

  it("interrupts an owned wallet operation when its caller is interrupted", async () => {
    const interrupted = await Effect.runPromise(
      Effect.gen(function* () {
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
      })
    );

    expect(interrupted).toBe(true);
  });
});
