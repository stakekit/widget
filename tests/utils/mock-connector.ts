import { CreateConnectorFn, custom } from "wagmi";
import { MockParameters, mock as mockConnector } from "wagmi/connectors";
import { BuildWagmiConfig } from "../../src/providers/wagmi";

interface MyWalletOptions {
  accounts: MockParameters["accounts"];
  requestFn?: Parameters<typeof custom>[0]["request"];
  connectorParams?: Partial<ReturnType<CreateConnectorFn>>;
}

export const rkMockWallet =
  ({
    connectorParams,
    accounts,
    requestFn,
  }: MyWalletOptions): Parameters<BuildWagmiConfig>[0]["customConnectors"] =>
  () => [
    {
      groupName: "Mock Wallet",
      wallets: [
        () => ({
          id: "mock-wallet",
          name: "Mock Wallet",
          iconUrl: "https://my-image.xyz",
          iconBackground: "#0c2f78",
          downloadUrls: {
            android: "https://fake-uri.com/android",
            ios: "https://fake-uri.com/ios",
            qrCode: "https://fake-uri.com/qr",
          },
          createConnector: () => (config) => ({
            ...mockConnector({
              accounts,
              features: { reconnect: true },
            })(config),
            async isAuthorized() {
              return true;
            },
            ...(requestFn && {
              async getProvider() {
                return custom({ request: requestFn })({ retryCount: 0 });
              },
            }),
            ...connectorParams,
          }),
        }),
      ],
    },
  ];
