import type { WalletList } from "@stakekit/rainbowkit";
import { Array as EArray, Effect, Option } from "effect";
import type { RefObject } from "react";
import type { Address } from "viem";
import type { Connector, CreateConnectorFn } from "wagmi";
import { createConnector } from "wagmi";
import type { Chain } from "wagmi/chains";
import { makeCurrentValueStream } from "../../common/current-value-stream";
import { config } from "../../config";
import { skNormalizeChainId } from "../../domain";
import type { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import { ExternalProvider } from "../../domain/types/external-providers";
import type { SKExternalProviders } from "../../domain/types/wallets";

const configMeta = {
  id: "externalProviderConnector",
  name: "External Provider",
  type: "externalProvider",
} as const;

type ExtraProps = ConnectorWithFilteredChains &
  Pick<ExternalProvider, "sendTransaction" | "signMessage"> & {
    onSupportedChainsChanged: (args: {
      supportedChainIds: number[];
      currentChainId: number;
    }) => void;
  };

type ExternalConnector = Connector & ExtraProps;

export const isExternalProviderConnector = (
  connector: Connector
): connector is ExternalConnector => connector.id === configMeta.id;

export const externalProviderConnector = (
  variant: RefObject<SKExternalProviders>
): WalletList[number] => ({
  groupName: "External Providers",
  wallets: [
    () => ({
      id: configMeta.id,
      name: configMeta.name,
      iconUrl: config.appIcon,
      iconBackground: "#fff",
      chainGroup: {
        id: configMeta.id,
        title: configMeta.name,
        iconUrl: config.appIcon,
      },
      createConnector: () =>
        createConnector<unknown, ExtraProps>((connectorConfig) => {
          const filteredChains = makeCurrentValueStream(
            variant.current.supportedChainIds
              ? connectorConfig.chains.filter((chain) =>
                  new Set(variant.current.supportedChainIds).has(chain.id)
                )
              : (connectorConfig.chains as [Chain, ...Chain[]])
          );

          if (filteredChains.get().length === 0) {
            throw new Error("No supported chains found!");
          }

          const provider = new ExternalProvider(variant);

          const getFirstFilteredChain = () =>
            EArray.head(filteredChains.get()).pipe(
              Option.getOrThrowWith(
                () => new Error("No supported chains found!")
              )
            );

          const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
            async () => [variant.current.currentAddress as Address];

          const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
            async () => getFirstFilteredChain().id;

          const connect: ReturnType<CreateConnectorFn>["connect"] = async (
            args
          ) => {
            connectorConfig.emitter.emit("message", { type: "connecting" });

            const [accounts, chainId] = await Promise.all([
              getAccounts(),
              getChainId(),
            ]);

            return {
              accounts: args?.withCapabilities
                ? [{ address: accounts[0] as Address, capabilities: {} }]
                : (accounts as Address[]),
              chainId,
            } as never;
          };

          const switchChain: ReturnType<CreateConnectorFn>["switchChain"] =
            async ({ chainId }) => {
              const chain = connectorConfig.chains.find(
                (candidate) => candidate.id === chainId
              );

              if (!chain) throw new Error("Chain not found");

              await Effect.runPromise(provider.switchChain({ chainId }));
              onChainChanged(chain.id.toString());
              return chain;
            };

          const disconnect: ReturnType<CreateConnectorFn>["disconnect"] =
            async () => {};

          const getProvider: ReturnType<CreateConnectorFn>["getProvider"] =
            async () => ({});

          const isAuthorized: ReturnType<CreateConnectorFn>["isAuthorized"] =
            async () => true;

          const onDisconnect: ReturnType<CreateConnectorFn>["onDisconnect"] =
            () => {
              connectorConfig.emitter.emit("disconnect");
            };

          const onChainChanged: ReturnType<CreateConnectorFn>["onChainChanged"] =
            (chainId) => {
              connectorConfig.emitter.emit("change", {
                chainId: skNormalizeChainId(chainId),
              });
            };

          const onAccountsChanged: ReturnType<CreateConnectorFn>["onAccountsChanged"] =
            (accounts) => {
              connectorConfig.emitter.emit("change", {
                accounts: accounts.filter((a) => !!a) as Address[],
              });
            };

          const onSupportedChainsChanged: ExtraProps["onSupportedChainsChanged"] =
            ({ currentChainId, supportedChainIds }) => {
              filteredChains.set(
                supportedChainIds.length
                  ? connectorConfig.chains.filter((chain) =>
                      new Set(supportedChainIds).has(chain.id)
                    )
                  : (connectorConfig.chains as [Chain, ...Chain[]])
              );

              // If the current chain is not in the supported chains, switch to the first supported chain
              if (filteredChains.get().every((c) => c.id !== currentChainId)) {
                getChainId().then((chainId) =>
                  onChainChanged(chainId.toString())
                );
              }
            };

          return {
            id: configMeta.id,
            name: configMeta.name,
            type: configMeta.type,
            getAccounts,
            getChainId,
            connect,
            disconnect,
            getProvider,
            isAuthorized,
            onDisconnect,
            onChainChanged,
            onAccountsChanged,
            switchChain,
            sendTransaction: provider.sendTransaction.bind(provider),
            signMessage: provider.signMessage.bind(provider),
            $filteredChains: filteredChains.changes,
            onSupportedChainsChanged,
          };
        }),
    }),
  ],
});
