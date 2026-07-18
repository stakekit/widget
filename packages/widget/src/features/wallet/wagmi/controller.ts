import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import { WalletRuntimeTerminalError } from "../../../services/wallet/domain/errors";
import { WalletService } from "../../../services/wallet/wallet-service";
import type { WalletInitializationKey } from "./initialization";

const serviceWalletControllerAtom = appRuntime
  .atom(
    WalletService.use((wallet) =>
      Effect.succeed(
        wallet.changes.pipe(
          Stream.filter((snapshot) => snapshot.phase !== "Bootstrapping"),
          Stream.changesWith(
            (current, previous) => current.phase === previous.phase
          ),
          Stream.mapEffect((snapshot) => {
            if (snapshot.phase !== "Ready") {
              return Effect.fail(
                new WalletRuntimeTerminalError({
                  cause: snapshot.cause,
                  phase: snapshot.phase,
                })
              );
            }

            return wallet.legacyController.pipe(
              Effect.flatMap((controller) =>
                controller === null
                  ? Effect.die("Ready Wallet Runtime has no controller")
                  : Effect.succeed(controller)
              )
            );
          })
        )
      )
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.setIdleTTL(0), Atom.withLabel("serviceWalletControllerAtom"));

/**
 * Temporary compatibility adapter for enrichment atoms removed by later
 * wallet-runtime tickets. Every key resolves to the service-owned controller.
 */
export const walletControllerAtom = (_key: WalletInitializationKey) =>
  serviceWalletControllerAtom;
