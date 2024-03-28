import { AddressWithTokenDtoAdditionalAddresses } from "@stakekit/api-hooks";
import { EitherAsync, Left, List, Right } from "purify-ts";
import { Connector } from "wagmi";
import { getStorageItem } from "../../services/local-storage";
import { toBase64 } from "@cosmjs/encoding";
import { getCosmosChainWallet } from "./utils";
import { useQuery } from "@tanstack/react-query";
import { isCosmosConnector } from "../cosmos/cosmos-connector";

export const useAdditionalAddresses = ({
  connector,
  address,
  isConnected,
}: {
  isConnected: boolean;
  connector: Connector | undefined;
  address: string | undefined;
}) => {
  return useQuery({
    queryKey: ["additional-addresses", connector?.id, address, isConnected],
    enabled: !!(connector && address && isConnected),
    queryFn: async () => {
      if (!connector) return Promise.resolve(null);

      return (await getAdditionalAddresses(connector)).unsafeCoerce();
    },
  });
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

        return EitherAsync(() => connector.getAccounts())
          .chain((accs) =>
            EitherAsync.liftEither(
              List.head(accs).toEither(new Error("no account"))
            )
          )
          .chain((acc) => {
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
