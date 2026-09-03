import type { WalletList } from "@stakekit/rainbowkit";
import { Context, Layer } from "effect";
import type { Chain } from "wagmi/chains";

export type WalletListFactory = (chains: Chain[]) => WalletList;

type WalletConnectorSourceService = Readonly<{
  walletListFactory: WalletListFactory | undefined;
}>;

export class WalletConnectorSource extends Context.Service<
  WalletConnectorSource,
  WalletConnectorSourceService
>()("stakekit/widget/services/wallet/WalletConnectorSource") {
  static readonly defaultLayer = Layer.succeed(
    WalletConnectorSource,
    WalletConnectorSource.of({ walletListFactory: undefined })
  );

  static readonly layer = (walletListFactory: WalletListFactory) =>
    Layer.succeed(
      WalletConnectorSource,
      WalletConnectorSource.of({ walletListFactory })
    );
}
