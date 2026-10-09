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
import { WalletModal } from "../../../../services/wallet/wallet-modal";
import { WalletService } from "../../../../services/wallet/wallet-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";

type WalletChainSelection = Readonly<{
  readonly pendingChainId?: number;
  readonly failedChainId?: number;
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
    readonly revision: number;
    readonly owner: WalletCommandIdentity;
    readonly selection: WalletChainSelection;
  } | null>(null);
  const currentChainSelection: Effect.Effect<
    WalletChainSelection,
    WalletRuntimeInvariantError
  > = Effect.gen(function* () {
    const attempt = yield* SubscriptionRef.get(chainSelection);
    const revision = yield* modal.chainOpen.revision;
    const state = yield* wallet.state;
    if (
      !attempt ||
      attempt.revision !== revision ||
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

  return {
    addressCopied: Stream.merge(
      SubscriptionRef.changes(copied),
      wallet.states
    ).pipe(Stream.mapEffect(() => currentAddressCopied)),
    chainSelection: Stream.merge(
      Stream.merge(
        SubscriptionRef.changes(chainSelection),
        modal.chainOpen.changes
      ),
      wallet.states
    ).pipe(Stream.mapEffect(() => currentChainSelection)),
    copyAddress: copyOperations.run(copyAddress()),
    selectChain: Effect.fn("selectChain")(function* (input: {
      readonly chain: Chain;
      readonly addLedgerAccount: boolean;
    }) {
      yield* operations
        .run(
          Effect.gen(function* () {
            const state = yield* wallet.state;
            if (state.connection.status !== "connected") return;
            const revision = yield* modal.chainOpen.revision;
            const owner = walletCommandIdentity(state.connection);
            yield* SubscriptionRef.set(chainSelection, {
              revision,
              owner,
              selection: { pendingChainId: input.chain.id },
            });
            const operation: Effect.Effect<
              boolean,
              | WalletIntegrationError
              | WalletRuntimeInvariantError
              | WalletSwitchError
            > = input.addLedgerAccount
              ? wallet
                  .addLedgerAccount({
                    expected: walletCommandIdentity(state.connection),
                    targetChain: input.chain,
                  })
                  .pipe(Effect.map((outcome) => outcome._tag === "Added"))
              : wallet
                  .switchChain({
                    chainId: input.chain.id,
                    connector: state.connection.connector,
                  })
                  .pipe(Effect.as(true));
            yield* operation.pipe(
              Effect.matchEffect({
                onFailure: () =>
                  SubscriptionRef.set(chainSelection, {
                    revision,
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
                      after.connectorUid === owner.connectorUid &&
                      (yield* modal.chainOpen.revision) === revision
                    )
                      yield* modal.closeChain;
                  }),
              })
            );
          })
        )
        .pipe(chainPermit.withPermitsIfAvailable(1));
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
