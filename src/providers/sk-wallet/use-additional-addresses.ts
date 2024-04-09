import { AddressWithTokenDtoAdditionalAddresses } from "@stakekit/api-hooks";
import { EitherAsync, Left, List, Right } from "purify-ts";
import { Connector } from "wagmi";
import { getStorageItem } from "../../services/local-storage";
import { toBase64 } from "@cosmjs/encoding";
import { useQuery } from "@tanstack/react-query";
import { CosmosConnector, isCosmosConnector } from "../cosmos/cosmos-connector";
import { ChainWalletBase } from "@cosmos-kit/core";
import { useCosmosCW } from "./use-cosmos-cw";

export const useAdditionalAddresses = ({
  connector,
  address,
  isConnected,
}: {
  isConnected: boolean;
  connector: Connector | undefined;
  address: string | undefined;
}) => {
  const chainWallet = useCosmosCW(connector);

  return useQuery({
    queryKey: [
      "additional-addresses",
      connector?.id,
      chainWallet?.chainId,
      address,
      isConnected,
    ],
    enabled: !!(connector && address && isConnected),
    queryFn: async () => {
      if (chainWallet && connector && isCosmosConnector(connector)) {
        return (
          await getAdditionalAddresses({ connector, chainWallet })
        ).unsafeCoerce();
      }

      return Promise.resolve(null);
    },
  });
};

const getAdditionalAddresses = (args: {
  chainWallet: ChainWalletBase;
  connector: CosmosConnector;
}): EitherAsync<Error, AddressWithTokenDtoAdditionalAddresses | null> => {
  // Add new in the future
  if (isCosmosConnector(args.connector)) {
    return getCosmosPubKey(args).map(
      (pubKey): AddressWithTokenDtoAdditionalAddresses => ({
        cosmosPubKey: pubKey,
      })
    );
  }

  return EitherAsync.liftEither(Right(null));
};

const getCosmosPubKey = (args: {
  chainWallet: ChainWalletBase;
  connector: CosmosConnector;
}) =>
  EitherAsync.liftEither(getStorageItem("sk-widget@1//skPubKeys"))
    .chain((prevSkPubKeys) => {
      if (!prevSkPubKeys) return EitherAsync.liftEither(Left(null));

      return EitherAsync(() => args.connector.getAccounts())
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
      EitherAsync(() =>
        args.chainWallet.client.getAccount!(args.chainWallet.chainId)
      )
        .mapLeft((e) => {
          console.log("missing account error: ", e);
          return new Error("missing account");
        })
        .map((account) => {
          return toBase64(account.pubkey);
        })
    );
