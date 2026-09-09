import type { WalletList } from "@stakekit/rainbowkit";
import { Array as EArray, Option } from "effect";
import type { Address } from "viem";
import type { Connector, CreateConnectorFn } from "wagmi";
import { createConnector } from "wagmi";
import type { Chain } from "wagmi/chains";
import type { ExternalProviderSnapshot } from "../../../../../public-api/external-provider-contract";
import { config } from "../../../../../shared/config/widget-defaults";
import { makeCurrentValueStream } from "../../../../../shared/effect/current-value-stream";
import { type CurrentRef, ExternalProvider } from "../../../external-provider";
import type { ConnectorWithFilteredChains } from "../../../wallet-connectors";
import { WalletRuntimeInvariantError } from "../../../wallet-errors";
import { normalizeChainId } from "../../normalize-chain-id";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { wagmiConnectResult } from "../wagmi-connect-result";

const configMeta = {
  id: "externalProviderConnector",
  name: "External Provider",
  type: "externalProvider",
} as const;

type ExtraProps = ConnectorWithFilteredChains &
  Pick<
    ExternalProvider,
    | "sendBorrowTransaction"
    | "sendTransaction"
    | "signMessage"
    | "signTypedData"
  > & {
    onSupportedChainsChanged: (args: {
      supportedChainIds: number[] | undefined;
      currentChainId: number;
    }) => void;
  };

type ExternalConnector = Connector & ExtraProps;

export const isExternalProviderConnector = (
  connector: Connector
): connector is ExternalConnector => connector.id === configMeta.id;

export const externalProviderConnector = (
  variant: CurrentRef<ExternalProviderSnapshot>,
  runWalletEffect: RunWalletEffect
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
          const resolveSupportedChains = (
            supportedChainIds: number[] | undefined
          ) => {
            const supported =
              supportedChainIds === undefined
                ? null
                : new Set(supportedChainIds);
            const chains = supported
              ? connectorConfig.chains.filter((chain) =>
                  supported.has(chain.id)
                )
              : (connectorConfig.chains as [Chain, ...Chain[]]);
            if (chains.length === 0) {
              throw new WalletRuntimeInvariantError({
                reason: "external-provider-no-supported-chains",
              });
            }
            return chains;
          };
          const filteredChains = makeCurrentValueStream(
            resolveSupportedChains(variant.current.supportedChainIds)
          );

          const provider = new ExternalProvider(variant);

          const getFirstFilteredChain = () =>
            EArray.head(filteredChains.get()).pipe(
              Option.getOrThrowWith(
                () => new Error("No supported chains found!")
              )
            );

          const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
            async () =>
              variant.current.currentAddress
                ? [variant.current.currentAddress as Address]
                : [];

          // Preserve the host's identity even when the topology cannot route it.
          const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
            async () =>
              variant.current.currentChain ?? getFirstFilteredChain().id;

          const connect: ReturnType<CreateConnectorFn>["connect"] = async (
            args
          ) => {
            connectorConfig.emitter.emit("message", { type: "connecting" });

            const [accounts, chainId] = await Promise.all([
              getAccounts(),
              getChainId(),
            ]);
            if (accounts.length === 0) {
              throw new Error("External provider has no connected account");
            }

            return wagmiConnectResult(
              args?.withCapabilities,
              accounts as Address[],
              chainId
            );
          };

          const switchChain: ReturnType<CreateConnectorFn>["switchChain"] =
            async ({ chainId }) => {
              const chain = connectorConfig.chains.find(
                (candidate) => candidate.id === chainId
              );

              if (!chain) throw new Error("Chain not found");

              await runWalletEffect(provider.switchChain({ chainId }));
              onChainChanged(chain.id.toString());
              return chain;
            };

          const disconnect: ReturnType<CreateConnectorFn>["disconnect"] =
            async () => {};

          const getProvider: ReturnType<CreateConnectorFn>["getProvider"] =
            async () => ({});

          const isAuthorized: ReturnType<CreateConnectorFn>["isAuthorized"] =
            async () => Boolean(variant.current.currentAddress);

          const onDisconnect: ReturnType<CreateConnectorFn>["onDisconnect"] =
            () => {
              connectorConfig.emitter.emit("disconnect");
            };

          const onChainChanged: ReturnType<CreateConnectorFn>["onChainChanged"] =
            (chainId) => {
              connectorConfig.emitter.emit("change", {
                chainId: normalizeChainId(chainId),
              });
            };

          const onAccountsChanged: ReturnType<CreateConnectorFn>["onAccountsChanged"] =
            (accounts) => {
              const connectedAccounts = accounts.filter(
                (account) => !!account
              ) as Address[];
              if (connectedAccounts.length === 0) {
                onDisconnect();
                return;
              }
              connectorConfig.emitter.emit("change", {
                accounts: connectedAccounts,
              });
            };

          const onSupportedChainsChanged: ExtraProps["onSupportedChainsChanged"] =
            ({ currentChainId, supportedChainIds }) => {
              filteredChains.set(resolveSupportedChains(supportedChainIds));

              if (
                variant.current.currentChain === undefined &&
                filteredChains.get().every((c) => c.id !== currentChainId)
              ) {
                onChainChanged(getFirstFilteredChain().id.toString());
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
            sendBorrowTransaction:
              provider.sendBorrowTransaction.bind(provider),
            sendTransaction: provider.sendTransaction.bind(provider),
            signMessage: provider.signMessage.bind(provider),
            signTypedData: provider.signTypedData.bind(provider),
            $filteredChains: filteredChains.changes,
            onSupportedChainsChanged,
          };
        }),
    }),
  ],
});
