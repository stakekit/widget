import { Effect, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { WidgetConfigService } from "../../../services/config/widget-config";
import { isMobileWalletEnvironment } from "../../../services/wallet/browser-environment";
import type { ConnectorWithWalletDetails } from "../../../services/wallet/wallet-descriptors";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import { WalletService } from "../../../services/wallet/wallet-service";
import {
  type ConnectPickerEcosystem,
  connectionChainId,
  connectPickerEcosystems,
} from "../model/connect-picker";

export const walletChainModalOpenAtom = appRuntime
  .atom(
    WalletModal.use((modal) => Effect.succeed(modal.chainOpen.changes)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.withLabel("walletChainModalOpenAtom"));

export const walletConnectModalOpenAtom = appRuntime
  .atom(
    WalletModal.use((modal) => Effect.succeed(modal.connectOpen.changes)).pipe(
      Stream.unwrap
    )
  )
  .pipe(Atom.withLabel("walletConnectModalOpenAtom"));

export const walletConnectPresentationOpenAtom = appRuntime
  .atom(
    WalletModal.use((modal) =>
      Effect.succeed(modal.presentationOpen.changes)
    ).pipe(Stream.unwrap)
  )
  .pipe(Atom.withLabel("walletConnectPresentationOpenAtom"));

export const setWalletChainModalOpenAtom = appRuntime.fn((open: boolean) =>
  WalletModal.use((modal) => modal.chainOpen.set(open))
);

export const setWalletConnectModalOpenAtom = appRuntime.fn((open: boolean) =>
  WalletModal.use((modal) => modal.connectOpen.set(open))
);

export const walletConnectionAttemptAtom = walletRuntime.atom(
  WalletService.use((wallet) => Effect.succeed(wallet.connectionAttempts)).pipe(
    Stream.unwrap
  )
);

const noEcosystems: ReadonlyArray<ConnectPickerEcosystem> = [];

/**
 * The picker's ecosystems. Each open renders from the wallet service's latest
 * detection results at once and asks it to detect injected wallets again;
 * rows update in place as results change. An open first clears the previous
 * open's rows, so a reopened picker never shows rows the new session would
 * then move.
 */
export const connectPickerAtom = walletRuntime
  .atom(
    Effect.gen(function* () {
      const modal = yield* WalletModal;
      const wallet = yield* WalletService;
      return modal.connectOpen.changes.pipe(
        Stream.switchMap((open) =>
          open
            ? connectPickerEcosystems({
                availability: wallet.availability,
                connectors: wallet.connectors,
                isMobile: isMobileWalletEnvironment(),
              }).pipe(
                Stream.onStart(wallet.detectAvailability),
                Stream.prepend([noEcosystems])
              )
            : Stream.empty
        )
      );
    }).pipe(Stream.unwrap),
    { initialValue: noEcosystems }
  )
  .pipe(Atom.withLabel("connectPickerAtom"));

export const connectWalletAtom = walletRuntime.fn(
  (connector: ConnectorWithWalletDetails) =>
    Effect.gen(function* () {
      const wallet = yield* WalletService;
      const { initialChain } = yield* WidgetConfigService.use(
        (config) => config.current
      );
      const chainId = yield* connectionChainId({
        connector,
        enabledChains: wallet.wagmiConfig.chains,
        initialChain,
      });
      yield* wallet.connect({ chainId, connector });
    }),
  // WalletService decides whether a repeated selection starts a connection.
  { concurrent: true }
);
