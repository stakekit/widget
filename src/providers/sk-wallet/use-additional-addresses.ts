import { AddressWithTokenDtoAdditionalAddresses } from "@stakekit/api-hooks";
import { EitherAsync, Left, Right } from "purify-ts";
import { Address, Connector } from "wagmi";
import { getStorageItem } from "../../services/local-storage";
import { toBase64 } from "@cosmjs/encoding";
import { getCosmosChainWallet, isCosmosConnector } from "./utils";
import { useQuery } from "@tanstack/react-query";

export const useAdditionalAddresses = ({
  connector,
  address,
}: {
  connector: Connector | undefined;
  address: Address | undefined;
}) => {
  return useQuery(
    ["additional-addresses", connector?.id, address],
    async () => {
      if (!connector) return Promise.resolve(null);

      return (await getAdditionalAddresses(connector)).caseOf({
        Left: (e) => Promise.reject(e),
        Right: (val) => Promise.resolve(val),
      });
    },
    { enabled: !!connector && !!address }
  );
};

export const getAdditionalAddresses = (
  connector: Connector
): EitherAsync<Error, AddressWithTokenDtoAdditionalAddresses | null> => {
  if (isCosmosConnector(connector)) {
    return getCosmosPubKey(connector).map(
      (pubKey): AddressWithTokenDtoAdditionalAddresses => ({
        cosmosPubKey: pubKey,
      })
    );
  }

  return EitherAsync.liftEither(Right(null));
};

const getCosmosPubKey = (connector: Connector) =>
  getCosmosChainWallet(connector).chain((val) =>
    EitherAsync.liftEither(getStorageItem("sk-widget@1//skPubKeys"))
      .chain((prevSkPubKeys) => {
        if (!prevSkPubKeys) return EitherAsync.liftEither(Left(null));

        return EitherAsync(() => connector.getAccount()).chain((acc) => {
          const skPubKey = prevSkPubKeys[acc];

          if (skPubKey) {
            return EitherAsync.liftEither(Right(skPubKey));
          }

          return EitherAsync.liftEither(Left(null));
        });
      })
      .chainLeft(() =>
        EitherAsync(() => val.client.getAccount!(val.chainId))
          .mapLeft((e) => {
            console.log("missing account error: ", e);
            return new Error("missing account");
          })
          .map((account) => {
            return toBase64(account.pubkey);
          })
      )
  );
