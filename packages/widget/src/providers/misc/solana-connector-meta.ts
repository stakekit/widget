import type { Adapter } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import type { Connector } from "wagmi";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import type { DecodedSolanaTransaction } from "../../domain/types/transaction";

export const getConfigMeta = (adapter: Adapter) => {
  if (adapter instanceof PhantomWalletAdapter) {
    return {
      downloadUrls: {
        android: "https://play.google.com/store/apps/details?id=app.phantom",
        ios: "https://apps.apple.com/us/app/phantom-crypto-wallet/id1598432977",
        qrCode: "https://phantom.com/",
        browserExtension:
          "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
        chrome:
          "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
      },
    };
  }

  if (adapter instanceof TrustWalletAdapter) {
    return {
      downloadUrls: {
        android:
          "https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp",
        ios: "https://apps.apple.com/us/app/trust-crypto-bitcoin-wallet/id1288339409",
        qrCode: "https://trustwallet.com/",
        browserExtension:
          "https://chromewebstore.google.com/detail/trust-wallet/egjidjbpglichdcondbcbdnbeeppgdph",
        chrome:
          "https://chromewebstore.google.com/detail/trust-wallet/egjidjbpglichdcondbcbdnbeeppgdph",
      },
    };
  }

  return {};
};

export type ExtraProps = ConnectorWithFilteredChains & {
  sendTransaction: (tx: DecodedSolanaTransaction) => Promise<string>;
};

type SolanaConnector = Connector & ExtraProps;

export const isSolanaConnector = (
  connector: Connector
): connector is SolanaConnector =>
  !!("isSolanaConnector" in connector && connector.isSolanaConnector);
