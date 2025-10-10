import type { WalletList } from "@stakekit/rainbowkit";
import { EitherAsync, List, Maybe } from "purify-ts";
import type { RefObject } from "react";
import { BehaviorSubject } from "rxjs";
import type { Address } from "viem";
import type { Connector, CreateConnectorFn } from "wagmi";
import { createConnector } from "wagmi";
import type { Chain } from "wagmi/chains";
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
          const $filteredChains = new BehaviorSubject(
            Maybe.fromNullable(variant.current.supportedChainIds)
              .map((val) => new Set(val))
              .mapOrDefault(
                (val) => connectorConfig.chains.filter((c) => val.has(c.id)),
                connectorConfig.chains as [Chain, ...Chain[]]
              )
          );

          if ($filteredChains.getValue().length === 0) {
            throw new Error("No supported chains found!");
          }

          const provider = new ExternalProvider(variant);

          const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
            async () => [variant.current.currentAddress as Address];

          const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
            async () => $filteredChains.getValue()[0].id;

          const connect: ReturnType<CreateConnectorFn>["connect"] =
            async () => {
              connectorConfig.emitter.emit("message", { type: "connecting" });

              const [accounts, chainId] = await Promise.all([
                getAccounts(),
                getChainId(),
              ]);

              return { accounts, chainId };
            };

          const switchChain: ReturnType<CreateConnectorFn>["switchChain"] =
            async ({ chainId }) => {
              return (
                await EitherAsync.liftEither(
                  List.find(
                    (c) => c.id === chainId,
                    connectorConfig.chains as unknown as Array<Chain>
                  ).toEither(new Error("Chain not found"))
                )
                  .chain((chain) =>
                    provider.switchChain({ chainId }).map(() => chain)
                  )
                  .ifRight((chain) => onChainChanged(chain.id.toString()))
              ).unsafeCoerce();
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
              $filteredChains.next(
                Maybe.fromFalsy(!!supportedChainIds.length)
                  .map(() => new Set(supportedChainIds))
                  .mapOrDefault(
                    (val) =>
                      connectorConfig.chains.filter((c) => val.has(c.id)),
                    connectorConfig.chains as [Chain, ...Chain[]]
                  )
              );

              // If the current chain is not in the supported chains, switch to the first supported chain
              if (
                $filteredChains.getValue().every((c) => c.id !== currentChainId)
              ) {
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
            $filteredChains: $filteredChains.asObservable(),
            onSupportedChainsChanged,
          };
        }),
    }),
  ],
});
