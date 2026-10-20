import {
  Context,
  Effect,
  Layer,
  type Scope,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import { makeScopedSerialOperations } from "../../shared/effect/scoped-serial-operations";
import {
  sameWalletCommandIdentity,
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "./wallet-command-identity";
import type { Chain } from "./wallet-descriptors";
import type {
  WalletIntegrationError,
  WalletRuntimeInvariantError,
  WalletSwitchError,
} from "./wallet-errors";
import {
  makeScopedWalletModalOpening,
  WalletModal,
  type WalletModalOpening,
} from "./wallet-modal";
import { WalletService } from "./wallet-service";

/** The wallet's chain selection: a switch in flight or the last that failed. */
type WalletChainSelectionState = Readonly<{
  readonly pendingChainId?: number;
  readonly failedChainId?: number;
}>;

export type WalletChainSelectionInput = Readonly<{
  readonly chain: Chain;
  readonly addLedgerAccount: boolean;
}>;

/** A selection owned by the Scope that opened it. */
type ScopedWalletChainSelection = Readonly<{
  readonly select: (
    input: WalletChainSelectionInput
  ) => Effect.Effect<void, WalletRuntimeInvariantError>;
}>;

type WalletChainSelectionService = Readonly<{
  /** The current wallet's selection, as it or the wallet changes. */
  readonly selection: Stream.Stream<
    WalletChainSelectionState,
    WalletRuntimeInvariantError
  >;
  /**
   * Selects a chain in the header network dialog. Closing the dialog
   * interrupts the selection; a selection that lands closes the dialog.
   */
  readonly select: (
    input: WalletChainSelectionInput
  ) => Effect.Effect<void, WalletRuntimeInvariantError>;
  /**
   * Opens chain selection for a surface outside the header network dialog.
   * Selections made through the handle belong to the caller's Scope: closing
   * it interrupts a pending selection and clears its state.
   */
  readonly openScoped: Effect.Effect<
    ScopedWalletChainSelection,
    never,
    Scope.Scope
  >;
}>;

const makeWalletChainSelection = Effect.fn("makeWalletChainSelection")(
  function* () {
    const wallet = yield* WalletService;
    const modal = yield* WalletModal;
    const operations = yield* makeScopedSerialOperations();
    // The wallet switches one chain at a time; a selection made while one is
    // in flight is dropped.
    const switchPermit = yield* Semaphore.make(1);
    const attempt = yield* SubscriptionRef.make<{
      /** The opening this selection reports for while it lasts. */
      readonly opening: WalletModalOpening;
      readonly owner: WalletCommandIdentity;
      readonly selection: WalletChainSelectionState;
    } | null>(null);
    const currentSelection: Effect.Effect<
      WalletChainSelectionState,
      WalletRuntimeInvariantError
    > = Effect.gen(function* () {
      const current = yield* SubscriptionRef.get(attempt);
      const state = yield* wallet.state;
      if (
        !current ||
        !sameWalletCommandIdentity(
          current.owner,
          walletCommandIdentity(state.connection)
        )
      ) {
        return {};
      }
      return current.selection;
    });

    /**
     * Runs one selection within `opening`: ending the opening interrupts it
     * and clears its pending or failed state. `onSwitched` runs once the same
     * connected wallet has landed on the selected chain.
     */
    const selectIn = (
      opening: WalletModalOpening,
      input: WalletChainSelectionInput,
      onSwitched: Effect.Effect<void>
    ) =>
      operations
        .run(
          opening.run(
            Effect.gen(function* () {
              const state = yield* wallet.state;
              const connection = state.connection;
              // An unsupported wallet keeps its connector so it can switch
              // back; only a connected one can add Ledger accounts.
              const canSwitch =
                connection.status === "connected" ||
                (connection.status === "unsupported" &&
                  !input.addLedgerAccount);
              if (!canSwitch || !connection.connector) return;
              const connector = connection.connector;
              const owner = walletCommandIdentity(connection);
              yield* SubscriptionRef.set(attempt, {
                opening,
                owner,
                selection: { pendingChainId: input.chain.id },
              });
              yield* opening.onEnd(
                SubscriptionRef.update(attempt, (current) =>
                  current?.opening === opening ? null : current
                )
              );
              const operation: Effect.Effect<
                boolean,
                | WalletIntegrationError
                | WalletRuntimeInvariantError
                | WalletSwitchError
              > = input.addLedgerAccount
                ? wallet
                    .addLedgerAccount({
                      expected: owner,
                      targetChain: input.chain,
                    })
                    .pipe(Effect.map((outcome) => outcome._tag === "Added"))
                : wallet
                    .switchChain({
                      chainId: input.chain.id,
                      connector,
                    })
                    .pipe(Effect.as(true));
              yield* operation.pipe(
                Effect.matchEffect({
                  onFailure: () =>
                    SubscriptionRef.set(attempt, {
                      opening,
                      owner,
                      selection: { failedChainId: input.chain.id },
                    }),
                  onSuccess: (changed) =>
                    Effect.gen(function* () {
                      yield* SubscriptionRef.set(attempt, null);
                      const after = walletCommandIdentity(
                        (yield* wallet.state).connection
                      );
                      if (
                        changed &&
                        after.status === "connected" &&
                        after.address === owner.address &&
                        after.connectorUid === owner.connectorUid
                      )
                        yield* onSwitched;
                    }),
                })
              );
            })
          )
        )
        .pipe(switchPermit.withPermitsIfAvailable(1), Effect.asVoid);

    return {
      selection: Stream.merge(
        SubscriptionRef.changes(attempt),
        wallet.states
      ).pipe(Stream.mapEffect(() => currentSelection)),
      openScoped: Effect.map(makeScopedWalletModalOpening, (opening) => ({
        select: (input: WalletChainSelectionInput) =>
          selectIn(opening, input, Effect.void),
      })),
      select: Effect.fn("WalletChainSelection.select")(function* (
        input: WalletChainSelectionInput
      ) {
        const opening = yield* modal.chainOpen.opening;
        yield* selectIn(opening, input, modal.closeChain);
      }),
    } satisfies WalletChainSelectionService;
  }
);

export class WalletChainSelection extends Context.Service<
  WalletChainSelection,
  WalletChainSelectionService
>()("stakekit/widget/services/wallet/WalletChainSelection") {
  static readonly layer = Layer.effect(
    WalletChainSelection,
    makeWalletChainSelection()
  );
}
