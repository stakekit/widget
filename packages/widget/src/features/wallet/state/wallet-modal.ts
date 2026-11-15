import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../../runtime/app-runtime";
import { walletRuntime } from "../../../runtime/wallet-runtime";
import { WidgetConfigService } from "../../../services/config/widget-config";
import { isMobileWalletEnvironment } from "../../../services/wallet/browser-environment";
import type { ConnectorWithWalletDetails } from "../../../services/wallet/wallet-descriptors";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import { WalletService } from "../../../services/wallet/wallet-service";
import {
  type ConnectPickerEcosystem,
  type ConnectPickerState,
  connectionChainId,
  connectPickerEcosystems,
  connectPickerSessions,
} from "../model/connect-picker";

// Modal flags are local streams; each read publishes the value, closed until
// the first emission, so the UI never handles an async result.
export const walletChainModalOpenAtom = appRuntime
  .atom(
    WalletModal.use((modal) => Effect.succeed(modal.chainOpen.changes)).pipe(
      Stream.unwrap
    )
  )
  .pipe(
    Atom.map(AsyncResult.getOrElse(() => false)),
    Atom.withLabel("walletChainModalOpenAtom")
  );

export const walletConnectModalOpenAtom = appRuntime
  .atom(
    WalletModal.use((modal) => Effect.succeed(modal.connectOpen.changes)).pipe(
      Stream.unwrap
    )
  )
  .pipe(
    Atom.map(AsyncResult.getOrElse(() => false)),
    Atom.withLabel("walletConnectModalOpenAtom")
  );

export const walletConnectPresentationOpenAtom = appRuntime
  .atom(
    WalletModal.use((modal) =>
      Effect.succeed(modal.presentationOpen.changes)
    ).pipe(Stream.unwrap)
  )
  .pipe(
    Atom.map(AsyncResult.getOrElse(() => false)),
    Atom.withLabel("walletConnectPresentationOpenAtom")
  );

export const setWalletChainModalOpenAtom = appRuntime.fn((open: boolean) =>
  WalletModal.use((modal) => modal.chainOpen.set(open))
);

export const setWalletConnectModalOpenAtom = appRuntime.fn((open: boolean) =>
  WalletModal.use((modal) => modal.connectOpen.set(open))
);

export const walletConnectionAttemptAtom = walletRuntime
  .atom(
    WalletService.use((wallet) =>
      Effect.succeed(wallet.connectionAttempts)
    ).pipe(Stream.unwrap)
  )
  .pipe(
    Atom.map(AsyncResult.getOrElse(() => ({ _tag: "Idle" as const }))),
    Atom.withLabel("walletConnectionAttemptAtom")
  );

const closedPicker: ConnectPickerState<ConnectPickerEcosystem> = {
  open: false,
  rows: [],
};

/**
 * The picker session's open flag and its ecosystems, changing together; see
 * `connectPickerSessions`. Each open asks the wallet service to detect
 * injected wallets again and renders from its detection results; rows update
 * in place as results change. It trails `walletConnectModalOpenAtom`, which
 * opens the dialog without waiting on the wallet runtime.
 */
export const connectPickerAtom = walletRuntime
  .atom(
    Effect.gen(function* () {
      const modal = yield* WalletModal;
      const wallet = yield* WalletService;
      return connectPickerSessions(
        modal.connectOpen.changes,
        connectPickerEcosystems({
          availability: wallet.availability,
          connectors: wallet.connectors,
          isMobile: isMobileWalletEnvironment(),
        }).pipe(Stream.onStart(wallet.detectAvailability))
      );
    }).pipe(Stream.unwrap),
    { initialValue: closedPicker }
  )
  .pipe(
    Atom.map(AsyncResult.getOrElse(() => closedPicker)),
    Atom.withLabel("connectPickerAtom")
  );

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
      yield* wallet.connect({
        ...(chainId === undefined ? {} : { chainId }),
        connector,
      });
    }),
  // WalletService decides whether a repeated selection starts a connection.
  { concurrent: true }
);
