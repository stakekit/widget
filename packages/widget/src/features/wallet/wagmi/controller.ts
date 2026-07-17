import { Effect, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import {
  type InitParams,
  InitParams as InitParamsSchema,
} from "../../../domain/schema/init-params";
import { YieldApiService } from "../../../services/api/yield-api-service";
import { buildWagmiConfig } from "../../../services/wallet/wagmi-config";
import { WalletService } from "../../../services/wallet/wallet-service";
import { initParamsAtom } from "../../init-params";
import { enabledNetworksAtom } from "./enabled-networks";
import {
  initializeWallet,
  WalletInitializationError,
  type WalletInitializationKey,
} from "./initialization";

const resolveWalletInitParams = Effect.fn("resolveWalletInitParams")(function* (
  initParams: InitParams
) {
  if (!initParams.yieldId) return initParams;

  const api = yield* YieldApiService;
  const yieldData = yield* api
    .getInitialYield(initParams.yieldId)
    .pipe(Effect.catch(() => Effect.succeed(null)));

  if (!yieldData) return initParams;

  const network = yield* Schema.decodeEffect(InitParamsSchema.fields.network)(
    yieldData.token.network
  );

  return {
    ...initParams,
    network,
    token: yieldData.token.symbol,
  };
});

type WalletControllerDependencies = {
  readonly buildConfig: typeof buildWagmiConfig;
  readonly initialize: typeof initializeWallet;
};

export const makeWalletControllerAtom = ({
  buildConfig = buildWagmiConfig,
  initialize = initializeWallet,
}: Partial<WalletControllerDependencies> = {}) =>
  Atom.family((key: WalletInitializationKey) =>
    appRuntime
      .atom((get) =>
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const enabledNetworks = yield* get.result(enabledNetworksAtom);
          const queryParams = yield* resolveWalletInitParams(
            get(initParamsAtom)
          );
          const result = yield* buildConfig({
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
          yield* initialize({
            hasExternalProvider: key.hasExternalProvider,
            queryParamsInitChainId: result.queryParamsInitChainId,
            wagmiConfig: result.wagmiConfig,
          }).pipe(Effect.forkScoped);

          return result;
        })
      )
      .pipe(Atom.setIdleTTL(0))
  );

export const walletControllerAtom = makeWalletControllerAtom();
