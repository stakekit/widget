import { Context, Effect, Layer } from "effect";
import {
  isLedgerDappBrowserProvider,
  isMobileWalletEnvironment,
} from "../browser-environment";

type WalletEnvironmentService = {
  readonly href: Effect.Effect<string>;
  readonly isLedgerDappBrowser: Effect.Effect<boolean>;
  readonly isMobileWallet: Effect.Effect<boolean>;
};

export class WalletEnvironment extends Context.Service<
  WalletEnvironment,
  WalletEnvironmentService
>()("stakekit/widget/wallet/platform/WalletEnvironment") {
  static readonly layer = Layer.succeed(
    WalletEnvironment,
    WalletEnvironment.of({
      href: Effect.sync(() =>
        typeof window === "undefined"
          ? "http://localhost/"
          : window.location.href
      ),
      isLedgerDappBrowser: Effect.sync(
        () => typeof window !== "undefined" && isLedgerDappBrowserProvider()
      ),
      isMobileWallet: Effect.sync(
        () => typeof window !== "undefined" && isMobileWalletEnvironment()
      ),
    })
  );
}
