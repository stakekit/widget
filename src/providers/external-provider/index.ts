import { WalletList } from "@stakekit/rainbowkit";
import { ExternalProvider } from "../../domain/types/external-providers";
import { EitherAsync, List } from "purify-ts";
import { getSKIcon } from "../../utils";
import { SKExternalProviders } from "../../domain/types/wallets/safe-wallet";
import {
  Connector,
  CreateConnectorFn,
  createConnector,
  normalizeChainId,
} from "wagmi";
import { Chain } from "wagmi/chains";
import { Address } from "viem";
import { ConnectorWithFilteredChains } from "../../domain/types/connectors";
import { useTransactionGetTransactionStatusByNetworkAndHashHook } from "@stakekit/api-hooks";
import { MutableRefObject } from "react";
import { BehaviorSubject } from "rxjs";

const configMeta = {
  id: "externalProviderConnector",
  name: "External Provider",
  type: "externalProvider",
} as const;

type ExtraProps = ConnectorWithFilteredChains &
  Pick<
    ExternalProvider,
    "sendMultipleTransactions" | "shouldMultiSend" | "signMessage"
  >;

type ExternalConnector = Connector & ExtraProps;

export const isExternalProviderConnector = (
  connector: Connector
): connector is ExternalConnector => connector.id === configMeta.id;

export const externalProviderConnector = (
  variant: MutableRefObject<SKExternalProviders>,
  transactionGetTransactionStatusByNetworkAndHash: ReturnType<
    typeof useTransactionGetTransactionStatusByNetworkAndHashHook
  >
): WalletList[number] => ({
  groupName: "External Providers",
  wallets: [
    () => ({
      id: configMeta.id,
      name: configMeta.name,
      iconUrl: getSKIcon("sk-icon_320x320.png"),
      iconBackground: "#fff",
      createConnector: () =>
        createConnector<unknown, ExtraProps>((config) => {
          const $filteredChains = new BehaviorSubject<Chain[]>([]);
          const provider = new ExternalProvider(
            variant,
            transactionGetTransactionStatusByNetworkAndHash
          );

          const getAccounts: ReturnType<CreateConnectorFn>["getAccounts"] =
            async () =>
              (
                await provider.getAccount().map((val) => [val as Address])
              ).unsafeCoerce();

          const getChainId: ReturnType<CreateConnectorFn>["getChainId"] =
            async () => (await provider.getChainId()).unsafeCoerce();

          const connect: ReturnType<CreateConnectorFn>["connect"] =
            async () => {
              config.emitter.emit("message", { type: "connecting" });

              const [accounts, chainId] = await Promise.all([
                getAccounts(),
                getChainId(),
              ]);

              $filteredChains.next(
                config.chains.filter((c) => c.id === chainId)
              );

              return { accounts, chainId };
            };

          const switchChain: ReturnType<CreateConnectorFn>["switchChain"] =
            async ({ chainId }) => {
              return (
                await EitherAsync.liftEither(
                  List.find(
                    (c) => c.id === chainId,
                    config.chains as unknown as Array<Chain>
                  ).toEither(new Error("Chain not found"))
                ).chain((chain) =>
                  provider
                    .switchChain({ chainId: `0x${chainId.toString(16)}` })
                    .map(() => chain)
                )
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
              config.emitter.emit("disconnect");
            };

          const onChainChanged: ReturnType<CreateConnectorFn>["onChainChanged"] =
            (chainId) => {
              config.emitter.emit("change", {
                chainId: normalizeChainId(chainId),
              });
            };

          const onAccountsChanged: ReturnType<CreateConnectorFn>["onAccountsChanged"] =
            () => {};

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
            sendMultipleTransactions:
              provider.sendMultipleTransactions.bind(provider),
            signMessage: provider.signMessage.bind(provider),
            shouldMultiSend: provider.shouldMultiSend,
            $filteredChains: $filteredChains.asObservable(),
          };
        }),
    }),
  ],
});
