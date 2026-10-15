import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { makeScopedEffectAtom } from "../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { WalletPresentationService } from "./orchestration/wallet-presentation-service";

type WalletChainSelectionInput = Parameters<
  WalletPresentationService["Service"]["selectChain"]
>[0];

/** The header chain selection; `undefined` until the service first emits. */
export const walletChainSelectionAtom = walletRuntime
  .atom(
    WalletPresentationService.use((service) =>
      Effect.succeed(service.chainSelection)
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.map(AsyncResult.getOrElse(() => undefined)));

export const selectWalletChainAtom = walletRuntime.fn(
  (input: WalletChainSelectionInput) =>
    WalletPresentationService.use((service) => service.selectChain(input)),
  // The chain switch permit decides whether a repeated selection switches.
  { concurrent: true }
);

/**
 * Chain selection owned by one mounted surface outside the header network
 * dialog. The surface creates an instance per mount; unmounting it ends the
 * Atom's Scope, which interrupts a pending selection and clears its state.
 */
export const makeWalletChainSelectionScopeAtom = () =>
  makeScopedEffectAtom({
    acquire: () =>
      WalletPresentationService.use((service) => service.openChainSelection),
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
  });

export const walletAddressCopiedAtom = walletRuntime
  .atom(
    WalletPresentationService.use((service) =>
      Effect.succeed(service.addressCopied)
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.map(AsyncResult.getOrElse(() => false)));

export const copyWalletAddressAtom = walletRuntime.fn(() =>
  WalletPresentationService.use((service) => service.copyAddress)
);
