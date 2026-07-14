import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetAtomRuntime } from "../../effect-atom-runtime/widget-runtime";
import type { NormalizedWalletState } from "../domain/state";
import type { LedgerConnectorState } from "../state/ledger";
import type { WagmiActions } from "../wagmi/actions";
import { WalletService } from "./service";

export const makeWalletServiceBindingAtom = <
  ControllerError,
  StateError,
  LedgerStateError,
  CosmosStateError,
>(
  controllerAtom: Atom.Atom<
    AsyncResult.AsyncResult<{ readonly actions: WagmiActions }, ControllerError>
  >,
  stateAtom: Atom.Atom<
    AsyncResult.AsyncResult<NormalizedWalletState, StateError>
  >,
  ledgerStateAtom: Atom.Atom<
    AsyncResult.AsyncResult<LedgerConnectorState, LedgerStateError>
  >,
  cosmosChainWalletAtom: Atom.Atom<
    AsyncResult.AsyncResult<ChainWalletBase | null, CosmosStateError>
  >
) =>
  widgetAtomRuntime
    .atom(
      (get) =>
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const [controller, state, ledgerState, cosmosChainWallet] =
            yield* Effect.all([
              get.result(controllerAtom),
              get.result(stateAtom),
              get.result(ledgerStateAtom),
              get.result(cosmosChainWalletAtom),
            ]);

          yield* wallet.bind({
            actions: controller.actions,
            cosmosChainWallet,
            ledgerState,
            state,
          });
        }),
      { initialValue: undefined }
    )
    .pipe(Atom.setIdleTTL(0));
