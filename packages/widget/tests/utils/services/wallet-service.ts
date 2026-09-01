import { Effect, Layer, SubscriptionRef } from "effect";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import type { WalletState } from "../../../src/services/wallet/wallet-state";

type TestWalletService = WalletService["Service"];

export type TestWalletOptions = Readonly<{
  readonly addLedgerAccount?: TestWalletService["addLedgerAccount"];
  readonly enabledNetworks?: TestWalletService["enabledNetworks"];
  readonly initialState: WalletState;
  readonly logout?: TestWalletService["logout"];
  readonly signMessage?: TestWalletService["signMessage"];
  readonly signTransaction?: TestWalletService["signTransaction"];
  readonly switchAccount?: TestWalletService["switchAccount"];
  readonly wagmiConfig?: TestWalletService["wagmiConfig"];
}>;

const unexpectedWalletCommand = <A>(method: string): Effect.Effect<A> =>
  Effect.die(`makeTestWallet: unexpected call to ${method}`);

export const makeTestWallet = Effect.fn("makeTestWallet")(function* (
  options: TestWalletOptions
) {
  const state = yield* SubscriptionRef.make(options.initialState);
  const service = WalletService.of({
    addLedgerAccount:
      options.addLedgerAccount ??
      (() => unexpectedWalletCommand("addLedgerAccount")),
    enabledNetworks: options.enabledNetworks ?? new Set(),
    logout: options.logout ?? unexpectedWalletCommand("logout"),
    signMessage:
      options.signMessage ?? (() => unexpectedWalletCommand("signMessage")),
    signTransaction:
      options.signTransaction ??
      (() => unexpectedWalletCommand("signTransaction")),
    state: SubscriptionRef.get(state),
    states: SubscriptionRef.changes(state),
    switchAccount:
      options.switchAccount ?? (() => unexpectedWalletCommand("switchAccount")),
    wagmiConfig:
      options.wagmiConfig ?? ({} as TestWalletService["wagmiConfig"]),
  });

  return {
    layer: Layer.succeed(WalletService, service),
    service,
    setState: (next: WalletState) => SubscriptionRef.set(state, next),
    walletState: SubscriptionRef.get(state),
  } as const;
});
