import { configMeta as safeConfigMeta } from "@sk-widget/providers/safe/safe-connector-meta";
import { useSettings } from "@sk-widget/providers/settings";
import { useWagmiConfig } from "@sk-widget/providers/wagmi";
import { isLedgerDappBrowserProvider, isMobile } from "@sk-widget/utils";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, List, Right } from "purify-ts";
import type { Connector } from "wagmi";
import { connect, reconnect, switchChain } from "wagmi/actions";

export const useInit = () => {
  const wagmiConfig = useWagmiConfig();
  const { externalProviders } = useSettings();

  return useQuery({
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !!wagmiConfig.data,
    queryKey: ["wagmi-config-init"],
    queryFn: () => {
      const config = wagmiConfig.data?.wagmiConfig;
      const queryParamsInitChainId = wagmiConfig.data?.queryParamsInitChainId;

      if (!config) return;

      /**
       * Reconnect to the last used connector if possible
       */
      return (
        EitherAsync(() => reconnect(config))
          .chainLeft(async () => Right(null))
          .chain(async (reconnectVal) => {
            if (
              externalProviders ||
              reconnectVal?.length ||
              isLedgerDappBrowserProvider() ||
              !isMobile()
            ) {
              return Right(null);
            }

            /**
             * If not reconnected and its mobile app, try to connect to the injected connector
             */
            return EitherAsync.liftEither(
              List.find(
                (c) => c.id === "injected" || c.id === safeConfigMeta.id,
                config.connectors as Connector[]
              ).toEither(new Error("Could not find injected connector"))
            )
              .chain((injConnector) =>
                EitherAsync(() =>
                  connect(config, {
                    connector: injConnector,
                    chainId: queryParamsInitChainId,
                  })
                )
              )
              .chainLeft(async () => Right(null));
          })
          /**
           * Switch chain if query param chainId is different from the current chainId
           */
          .chain(() => {
            if (
              queryParamsInitChainId &&
              config.state.chainId !== queryParamsInitChainId
            ) {
              return EitherAsync(() =>
                switchChain(config, { chainId: queryParamsInitChainId })
              ).chainLeft(async () => Right(null));
            }

            return EitherAsync.liftEither(Right(null));
          })
          .run()
          .then((res) => res.unsafeCoerce())
      );
    },
  });
};
