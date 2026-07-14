import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetAtomRuntime } from "../../effect-atom-runtime/widget-runtime";
import { WalletService } from "../runtime/service";
import { buildWagmiConfig } from "./config";
import {
  initializeWallet,
  WalletInitializationError,
  type WalletInitializationKey,
} from "./initialization";
import {
  enabledNetworksAtom,
  WalletInitParamsKey,
  walletInitParamsAtom,
} from "./initialization-params";

export const walletControllerAtom = Atom.family(
  (key: WalletInitializationKey) =>
    widgetAtomRuntime
      .atom((get) =>
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const enabledNetworks = yield* get.result(enabledNetworksAtom);
          const queryParams = yield* get.result(
            walletInitParamsAtom(
              new WalletInitParamsKey({
                externalProviderInitToken: key.externalProviderInitToken,
              })
            )
          );
          const result = yield* buildWagmiConfig({
            ...key,
            enabledNetworks,
            persistPublicKey: (input) =>
              Effect.runPromise(wallet.persistPublicKey(input)),
            queryParams,
          }).pipe(
            Effect.mapError(
              (cause) =>
                new WalletInitializationError({
                  cause,
                  phase: "configuration",
                })
            )
          );
          yield* initializeWallet({
            hasExternalProvider: key.hasExternalProvider,
            queryParamsInitChainId: result.queryParamsInitChainId,
            wagmiConfig: result.wagmiConfig,
          });

          return result;
        })
      )
      .pipe(Atom.setIdleTTL(0))
);
