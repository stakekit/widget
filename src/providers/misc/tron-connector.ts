import { Address, Connector } from "wagmi";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { EitherAsync, Maybe } from "purify-ts";
import { tron } from "./chains";
import { getTokenLogo } from "../../utils";
import { MaybeWindow } from "../../utils/maybe-window";

export class TronConnector extends Connector {
  id = "tron";
  name = "Tron";

  adapter = new TronLinkAdapter();

  ready = MaybeWindow.mapOrDefault((w) => !!w.tronWeb?.ready, false);

  async connect() {
    this.emit("message", { type: "connecting" });

    await this.adapter.connect();

    return {
      account: this.adapter.address as Address,
      chain: {
        id: tron.id,
        unsupported: false,
      },
    };
  }

  async disconnect() {
    await this.adapter.disconnect();
  }

  async getAccount() {
    return (
      await EitherAsync.liftEither(
        Maybe.fromNullable(this.adapter.address as Address).toEither(
          new Error("No account found")
        )
      )
    ).unsafeCoerce();
  }

  async switchChain() {
    return tron;
  }

  async getChainId() {
    return tron.id;
  }

  async getProvider() {
    throw new Error("Not implemented");
  }

  getWalletClient = () => {
    throw new Error("Not implemented");
  };

  async isAuthorized() {
    return !!(this.adapter.connected && this.adapter.address);
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

export const tronConnector = {
  groupName: "Tron",
  wallets: [
    {
      id: "tron-link",
      name: "Tron Link",
      iconUrl: async () => getTokenLogo("trx"),
      iconBackground: "#fff",
      createConnector: () => ({
        connector: new TronConnector({ options: {}, chains: [tron] }), // only mainnet for now
      }),
      downloadUrls: {
        chrome:
          "https://chromewebstore.google.com/detail/tronlink/ibnejdfjmmkpcnlpebklmnkoeoihofec",
        firefox:
          "https://chromewebstore.google.com/detail/tronlink/ibnejdfjmmkpcnlpebklmnkoeoihofec",
        browserExtension:
          "https://chromewebstore.google.com/detail/tronlink/ibnejdfjmmkpcnlpebklmnkoeoihofec",
      },
    },
  ],
};
