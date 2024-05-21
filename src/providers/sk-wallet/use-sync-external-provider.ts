import { useSavedRef } from "@sk-widget/hooks";
import { useUpdateEffect } from "@sk-widget/hooks/use-update-effect";
import { Maybe } from "purify-ts";
import { useEffect } from "react";
import type { SKWallet } from "../../domain/types";
import type { Nullable } from "../../types";
import { isExternalProviderConnector } from "../external-provider";
import { useSettings } from "../settings";

type Props = Pick<SKWallet, "connector" | "address" | "chain" | "isConnected">;

export const useSyncExternalProvider = ({
  address,
  chain,
  connector,
  isConnected,
}: { [Key in keyof Props]: Nullable<Props[Key]> }) => {
  const { externalProviders } = useSettings();

  const connectorRef = useSavedRef(connector);
  const chainRef = useSavedRef(chain);

  useUpdateEffect(() => {
    Maybe.fromNullable(connectorRef.current)
      .chain((conn) =>
        Maybe.fromNullable(chainRef.current).map((c) => ({ c, conn }))
      )
      .ifJust((val) => {
        if (!isExternalProviderConnector(val.conn)) return;

        val.conn.onSupportedChainsChanged({
          supportedChainIds: externalProviders?.supportedChainIds ?? [],
          currentChainId: val.c.id,
        });
      });
  }, [externalProviders?.supportedChainIds, connectorRef, chainRef]);

  useEffect(() => {
    Maybe.fromRecord({
      connector: Maybe.fromNullable(connector),
      address: Maybe.fromNullable(address),
      chain: Maybe.fromNullable(chain),
    })
      .filter(
        (val) =>
          !!(
            isExternalProviderConnector(val.connector) &&
            val.address &&
            val.chain &&
            isConnected
          )
      )
      .ifJust((val) => {
        const currentAddress = externalProviders?.currentAddress;
        const currentChain = externalProviders?.currentChain;

        if (currentAddress && currentAddress !== val.address) {
          val.connector.onAccountsChanged([currentAddress]);
        }

        if (currentChain && currentChain !== val.chain.id) {
          val.connector.onChainChanged(currentChain.toString());
        }
      });
  }, [
    address,
    chain,
    connector,
    externalProviders?.currentAddress,
    externalProviders?.currentChain,
    isConnected,
  ]);
};
