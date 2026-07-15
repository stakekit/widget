import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import type { NormalizedWalletState } from "../../../services/wallet/domain/state";
import type { WagmiActions } from "../../../services/wallet/wagmi-actions";
import { WalletService } from "../../../services/wallet/wallet-service";
import type { LedgerConnectorState } from "../state/ledger";

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
  appRuntime
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
