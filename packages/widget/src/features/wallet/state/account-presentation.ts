import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { makeScopedEffectAtom } from "../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import {
  WalletChainSelection,
  type WalletChainSelectionInput,
} from "../../../services/wallet/wallet-chain-selection";
import { WalletClipboard } from "../../../services/wallet/wallet-clipboard";
import {
  sameWalletCommandIdentity,
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "../../../services/wallet/wallet-command-identity";
import { WalletService } from "../../../services/wallet/wallet-service";
import { currentWalletStateResultAtom } from "./root-atom";

/** The wallet chain selection; `undefined` until the service first emits. */
export const walletChainSelectionAtom = walletRuntime
  .atom(
    WalletChainSelection.use((chainSelection) =>
      Effect.succeed(chainSelection.selection)
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.map(AsyncResult.getOrElse(() => undefined)));

export const selectWalletChainAtom = walletRuntime.fn(
  (input: WalletChainSelectionInput) =>
    WalletChainSelection.use((chainSelection) => chainSelection.select(input)),
  // The chain switch permit decides whether a repeated selection switches.
  { concurrent: true }
);

/**
 * Chain selection owned by one mounted surface outside the header network
 * dialog, keyed by that surface's `useId()`, so its renders share one Atom. A
 * render React abandons before mounting may open a selection nothing selects
 * through; the registry drops it unsubscribed. The subscribed Atom owns the
 * selection: when the surface stops subscribing, its Scope ends, which
 * interrupts a pending selection and clears its state.
 */
export const walletChainSelectionScopeAtom = Atom.family((_owner: string) =>
  makeScopedEffectAtom({
    acquire: () =>
      WalletChainSelection.use((chainSelection) => chainSelection.openScoped),
    label: "walletChainSelectionScope",
    makeValue: (handleAtom) =>
      walletRuntime
        .fn(
          (input: WalletChainSelectionInput, context) =>
            context
              .result(handleAtom)
              .pipe(Effect.flatMap((handle) => handle.select(input))),
          // The chain switch permit decides whether a repeated selection switches.
          { concurrent: true }
        )
        .pipe(Atom.withLabel("selectScopedWalletChain")),
    runtime: walletRuntime,
  })
);

/**
 * The latest successful copy and the wallet it copied, until its feedback
 * expires. Each copy is a new object, so a repeated copy restarts the expiry.
 */
const addressCopyAtom = Atom.make<Readonly<{
  readonly owner: WalletCommandIdentity;
}> | null>(null).pipe(Atom.withLabel("walletAddressCopyAtom"));

/** Clears copied feedback 1.5s after the latest copy. */
const addressCopyExpiryAtom = Atom.make((get) =>
  get(addressCopyAtom) === null
    ? Effect.void
    : Effect.sleep("1500 millis").pipe(
        Effect.andThen(Effect.sync(() => get.set(addressCopyAtom, null)))
      )
).pipe(Atom.withLabel("walletAddressCopyExpiryAtom"));

/** Copied feedback, shown only while the copied wallet is still current. */
export const walletAddressCopiedAtom = Atom.make((get) => {
  // Reading the expiry keeps it running while the feedback is shown.
  get(addressCopyExpiryAtom);
  const copy = get(addressCopyAtom);
  const connection = get(currentWalletStateResultAtom);
  return (
    copy !== null &&
    AsyncResult.isSuccess(connection) &&
    sameWalletCommandIdentity(
      copy.owner,
      walletCommandIdentity(connection.value)
    )
  );
}).pipe(Atom.withLabel("walletAddressCopiedAtom"));

/** Copies the connected wallet's address; `null` when none is connected. */
const copyConnectedWalletAddress = Effect.fn("copyConnectedWalletAddress")(
  function* () {
    const { connection } = yield* WalletService.use((wallet) => wallet.state);
    if (connection.status !== "connected") return null;
    const clipboard = yield* WalletClipboard;
    yield* clipboard.copyAddress(connection.address);
    return walletCommandIdentity(connection);
  }
);

export const copyWalletAddressAtom = walletRuntime
  .fn((_input: undefined, context) =>
    copyConnectedWalletAddress().pipe(
      Effect.map((owner) => {
        if (owner) context.set(addressCopyAtom, { owner });
      })
    )
  )
  .pipe(Atom.withLabel("copyWalletAddressAtom"));
