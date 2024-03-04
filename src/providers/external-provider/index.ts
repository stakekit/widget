import { WalletList } from "@stakekit/rainbowkit";
import { Address, Chain, Connector } from "wagmi";
import { ExternalProvider } from "../../domain/types/external-providers";
import { EitherAsync, List } from "purify-ts";
import { getSKIcon } from "../../utils";
import { SKExternalProviders } from "../../domain/types/wallets/safe-wallet";

export class ExternalProviderConnector extends Connector {
  id = "external-provider-connector";
  name = "External Provider";

  provider: ExternalProvider;

  constructor(chains: Chain[], variant: SKExternalProviders) {
    super({ options: {}, chains });
    this.provider = new ExternalProvider(variant);
  }

  ready = true;

  async connect() {
    this.emit("message", { type: "connecting" });

    const [account, chainId] = await Promise.all([
      this.getAccount(),
      this.getChainId(),
    ]);

    // Set chains to expose for switcher
    // @ts-expect-error
    this.chains = this.chains.filter((c) => c.id === chainId);

    return {
      account,
      chain: {
        id: chainId,
        unsupported: false,
      },
    };
  }

  async disconnect() {}

  async getAccount() {
    return (
      await this.provider.getAccount().map((val) => val as Address)
    ).unsafeCoerce();
  }

  async switchChain(chainId: number): Promise<Chain> {
    return (
      await EitherAsync.liftEither(
        List.find((c) => c.id === chainId, this.chains).toEither(
          new Error("Chain not found")
        )
      ).chain((chain) =>
        this.provider
          .switchChain({ chainId: `0x${chainId.toString(16)}` })
          .map(() => chain)
      )
    ).unsafeCoerce();
  }

  async getChainId(): Promise<number> {
    return (await this.provider.getChainId()).unsafeCoerce();
  }

  async getProvider() {}

  getWalletClient = () => {
    throw new Error("Not implemented");
  };

  async isAuthorized() {
    return true;
  }

  protected onAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      this.emit("disconnect");
    } else {
      this.emit("change", { account: accounts[0] as Address });
    }
  };

  protected onChainChanged = (chainId: number | string) => {
    this.emit("change", {
      chain: { id: chainId as number, unsupported: false },
    });
  };

  protected onDisconnect(error: Error): void {
    this.emit("disconnect");
  }
}

export const createExternalProviderConnector = (
  chains: Chain[],
  variant: SKExternalProviders
): WalletList[number] => {
  const connector = new ExternalProviderConnector(chains, variant);

  return {
    groupName: "External Providers",
    wallets: [
      {
        id: connector.id,
        name: connector.name,
        iconUrl: getSKIcon("sk-icon_320x320.png"),
        iconBackground: "#fff",
        createConnector: () => ({ connector }),
      },
    ],
  };
};
