import {
  Context,
  Effect,
  Fiber,
  Layer,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import { WalletClipboard } from "../../../../services/wallet/wallet-clipboard";
import {
  sameWalletCommandIdentity,
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "../../../../services/wallet/wallet-command-identity";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import type {
  WalletIntegrationError,
  WalletRuntimeInvariantError,
  WalletSwitchError,
} from "../../../../services/wallet/wallet-errors";
import {
  makeScopedWalletModalOpening,
  WalletModal,
  type WalletModalOpening,
} from "../../../../services/wallet/wallet-modal";
import { WalletService } from "../../../../services/wallet/wallet-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";

type WalletChainSelection = Readonly<{
  readonly pendingChainId?: number;
  readonly failedChainId?: number;
}>;

type WalletChainSelectionInput = Readonly<{
  readonly chain: Chain;
  readonly addLedgerAccount: boolean;
}>;

const makeWalletPresentationService = Effect.fn(
  "makeWalletPresentationService"
)(function* () {
  const wallet = yield* WalletService;
  const modal = yield* WalletModal;
  const platform = yield* WalletClipboard;
  const operations = yield* makeScopedSerialOperations();
  const copyOperations = yield* makeScopedSerialOperations();
  const chainPermit = yield* Semaphore.make(1);
  const copied = yield* SubscriptionRef.make<WalletCommandIdentity | null>(
    null
  );
  const currentAddressCopied = Effect.gen(function* () {
    const owner = yield* SubscriptionRef.get(copied);
    const state = yield* wallet.state;
    return (
      owner !== null &&
      sameWalletCommandIdentity(owner, walletCommandIdentity(state.connection))
    );
  });
  const chainSelection = yield* SubscriptionRef.make<{
    /** The opening this selection reports for while it lasts. */
    readonly opening: WalletModalOpening;
    readonly owner: WalletCommandIdentity;
    readonly selection: WalletChainSelection;
  } | null>(null);
  const currentChainSelection: Effect.Effect<
    WalletChainSelection,
    WalletRuntimeInvariantError
  > = Effect.gen(function* () {
    const attempt = yield* SubscriptionRef.get(chainSelection);
    const state = yield* wallet.state;
    if (
      !attempt ||
      !sameWalletCommandIdentity(
        attempt.owner,
        walletCommandIdentity(state.connection)
      )
    ) {
      return {};
    }
    return attempt.selection;
  });
  const scope = yield* Effect.scope;
  let resetCopied: Fiber.Fiber<void> | undefined;

  const copyAddress = Effect.fn("copyAddress")(function* () {
    const state = yield* wallet.state;
    if (state.connection.status !== "connected") return;
    const address = state.connection.address;
    yield* platform.copyAddress(address);
    if (resetCopied) yield* Fiber.interrupt(resetCopied);
    yield* SubscriptionRef.set(copied, walletCommandIdentity(state.connection));
    resetCopied = yield* Effect.sleep(1500).pipe(
      Effect.andThen(SubscriptionRef.set(copied, null)),
      Effect.forkIn(scope)
    );
  });

  /**
   * Runs one selection within `opening`: ending the opening interrupts it and
   * clears its pending or failed state. `onSwitched` runs once the same
   * connected wallet has landed on the selected chain.
   */
  const selectChainIn = (
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
              (connection.status === "unsupported" && !input.addLedgerAccount);
            if (!canSwitch || !connection.connector) return;
            const connector = connection.connector;
            const owner = walletCommandIdentity(connection);
            yield* SubscriptionRef.set(chainSelection, {
              opening,
              owner,
              selection: { pendingChainId: input.chain.id },
            });
            yield* opening.onEnd(
              SubscriptionRef.update(chainSelection, (current) =>
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
                  SubscriptionRef.set(chainSelection, {
                    opening,
                    owner,
                    selection: { failedChainId: input.chain.id },
                  }),
                onSuccess: (changed) =>
                  Effect.gen(function* () {
                    yield* SubscriptionRef.set(chainSelection, null);
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
      .pipe(chainPermit.withPermitsIfAvailable(1));

  return {
    addressCopied: Stream.merge(
      SubscriptionRef.changes(copied),
      wallet.states
    ).pipe(Stream.mapEffect(() => currentAddressCopied)),
    chainSelection: Stream.merge(
      SubscriptionRef.changes(chainSelection),
      wallet.states
    ).pipe(Stream.mapEffect(() => currentChainSelection)),
    copyAddress: copyOperations.run(copyAddress()),
    /**
     * Opens chain selection for a surface outside the header network dialog.
     * Selections made through the handle belong to the caller's Scope: closing
     * it interrupts a pending selection and clears its state.
     */
    openChainSelection: Effect.map(makeScopedWalletModalOpening, (opening) => ({
      select: (input: WalletChainSelectionInput) =>
        selectChainIn(opening, input, Effect.void),
    })),
    /**
     * Selects a chain in the header network dialog. Closing the dialog
     * interrupts the selection; a selection that lands closes the dialog.
     */
    selectChain: Effect.fn("selectChain")(function* (
      input: WalletChainSelectionInput
    ) {
      // Closing the network dialog interrupts the selection made in it.
      const opening = yield* modal.chainOpen.opening;
      yield* selectChainIn(opening, input, modal.closeChain);
    }),
  };
});

export class WalletPresentationService extends Context.Service<WalletPresentationService>()(
  "stakekit/widget/features/wallet/WalletPresentationService",
  { make: makeWalletPresentationService() }
) {
  static readonly layer = Layer.effect(
    WalletPresentationService,
    WalletPresentationService.make
  );
}
