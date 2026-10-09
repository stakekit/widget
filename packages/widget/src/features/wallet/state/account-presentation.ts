import { Effect, Stream } from "effect";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { WalletPresentationService } from "./orchestration/wallet-presentation-service";

export const walletChainSelectionAtom = walletRuntime.atom(
  WalletPresentationService.use((service) =>
    Effect.succeed(service.chainSelection)
  ).pipe(Stream.unwrap)
);

export const selectWalletChainAtom = walletRuntime.fn(
  (input: Parameters<WalletPresentationService["Service"]["selectChain"]>[0]) =>
    WalletPresentationService.use((service) => service.selectChain(input)),
  // The chain switch permit decides whether a repeated selection switches.
  { concurrent: true }
);

export const walletAddressCopiedAtom = walletRuntime.atom(
  WalletPresentationService.use((service) =>
    Effect.succeed(service.addressCopied)
  ).pipe(Stream.unwrap)
);

export const copyWalletAddressAtom = walletRuntime.fn(() =>
  WalletPresentationService.use((service) => service.copyAddress)
);
