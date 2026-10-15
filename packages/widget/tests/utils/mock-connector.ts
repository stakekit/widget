import { type EIP1193Provider, numberToHex, SwitchChainError } from "viem";
import type { CreateConnectorFn } from "wagmi";
import { ChainNotConfiguredError, custom } from "wagmi";
import type { Chain } from "wagmi/chains";
import type { MockParameters } from "wagmi/connectors";
import { mock as mockConnector } from "wagmi/connectors";
import type { WalletList } from "../../src/services/wallet/wallet-descriptors";

interface MyWalletOptions {
  accounts: MockParameters["accounts"];
  requestFn?: Parameters<typeof custom>[0]["request"];
  connectorParams?: Partial<ReturnType<CreateConnectorFn>>;
}

export const mockWalletListFactory =
  ({
    connectorParams,
    accounts,
    requestFn,
  }: MyWalletOptions): ((chains: Chain[]) => WalletList) =>
  () => [
    {
      groupName: "Mock Wallet",
      wallets: [
        () => ({
          availability: { _tag: "Remote" },
          id: "mock-wallet",
          name: "Mock Wallet",
          iconUrl: "https://my-image.xyz",
          iconBackground: "#0c2f78",
          chainGroup: {
            availability: { _tag: "Remote" },
            id: "mock-wallet",
            title: "Mock Wallet",
            iconUrl: "https://my-image.xyz",
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
            async switchChain({ chainId }) {
              const provider = (await this.getProvider()) as EIP1193Provider;
              const chain = config.chains.find((x) => x.id === chainId);
              if (!chain)
                throw new SwitchChainError(new ChainNotConfiguredError());
              await provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: numberToHex(chainId) }],
              });
              config.emitter.emit("change", { chainId });
              return chain;
            },
            ...connectorParams,
          }),
        }),
      ],
    },
  ];
