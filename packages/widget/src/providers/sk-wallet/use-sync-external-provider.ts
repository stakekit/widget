import type { SKWallet } from "@sk-widget/domain/types/wallet";
import { useSavedRef } from "@sk-widget/hooks/use-saved-ref";
import { useUpdateEffect } from "@sk-widget/hooks/use-update-effect";
import type { Nullable } from "@sk-widget/types/utils";
import { List, Maybe } from "purify-ts";
import { useEffect, useMemo } from "react";
import { type Connector, useConnect, useConnectors } from "wagmi";
import { isExternalProviderConnector } from "../external-provider";
import { useSettings } from "../settings";

type Props = Pick<
  SKWallet,
  "address" | "chain" | "isConnected" | "isConnecting"
>;

export const useSyncExternalProvider = ({
  address,
  chain,
  isConnected,
  isConnecting,
}: { [Key in keyof Props]: Nullable<Props[Key]> }) => {
  const { externalProviders } = useSettings();

  const { connect } = useConnect();

  const connectors = useConnectors();
  const externalProviderConnector = useMemo(
    () =>
      List.find(
        (c) => isExternalProviderConnector(c),
        connectors as Connector[]
      ).filter(isExternalProviderConnector),
    [connectors]
  );

  const connectRef = useSavedRef(connect);
  const connectorRef = useSavedRef(externalProviderConnector);
  const chainRef = useSavedRef(chain);

  /**
   * Connect to the external provider if it exists and the wallet is not connected
   */
  useEffect(() => {
    if (isConnected || isConnecting || !externalProviders?.currentAddress) {
      return;
    }

    externalProviderConnector.ifJust((val) =>
      connectRef.current({ connector: val })
    );
  }, [
    isConnected,
    isConnecting,
    externalProviders?.currentAddress,
    externalProviderConnector,
    connectRef,
  ]);

  useUpdateEffect(() => {
    connectorRef.current
      .chain((conn) =>
        Maybe.fromNullable(chainRef.current).map((c) => ({ c, conn }))
      )
      .ifJust((val) => {
        val.conn.onSupportedChainsChanged({
          supportedChainIds: externalProviders?.supportedChainIds ?? [],
          currentChainId: val.c.id,
        });
      });
  }, [externalProviders?.supportedChainIds, connectorRef, chainRef]);

  useEffect(() => {
    Maybe.fromRecord({
      externalProviderConnector,
      address: Maybe.fromNullable(address),
      chain: Maybe.fromNullable(chain),
    })
      .filter((val) => !!(val.address && val.chain && isConnected))
      .ifJust((val) => {
        const currentAddress = externalProviders?.currentAddress;
        const currentChain = externalProviders?.currentChain;

        if (currentAddress !== val.address) {
          val.externalProviderConnector.onAccountsChanged([
            currentAddress ?? "",
          ]);
        }

        if (currentChain && currentChain !== val.chain.id) {
          val.externalProviderConnector.onChainChanged(currentChain.toString());
        }
      });
  }, [
    address,
    chain,
    externalProviderConnector,
    externalProviders?.currentAddress,
    externalProviders?.currentChain,
    isConnected,
  ]);
};
