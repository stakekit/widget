import { Maybe } from "purify-ts";
import { useEffect } from "react";
import type { SKWallet } from "../../domain/types";
import { useSettings } from "../settings";
import { isExternalProviderConnector } from "../external-provider";
import type { Nullable } from "../../types";

type Props = Pick<SKWallet, "connector" | "address" | "chain" | "isConnected">;

export const useSyncExternalProviderAddressOrChain = ({
  address,
  chain,
  connector,
  isConnected,
}: { [Key in keyof Props]: Nullable<Props[Key]> }) => {
  const { externalProviders } = useSettings();

  useEffect(() => {
    Maybe.fromRecord({
      connector: Maybe.fromNullable(connector),
      externalProviders: Maybe.fromNullable(externalProviders),
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
        const { currentAddress, currentChain } = val.externalProviders;

        if (currentAddress && currentAddress !== val.address) {
          val.connector.onAccountsChanged([currentAddress]);
        }

        if (currentChain && currentChain !== val.chain.id) {
          val.connector.onChainChanged(currentChain.toString());
        }
      });
  }, [address, chain, connector, externalProviders, isConnected]);
};
