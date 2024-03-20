import { Connector } from "wagmi";
import { Chain } from "wagmi/chains";
import { SKWallet } from "../../domain/types";
import { EitherAsync, Left, Right } from "purify-ts";
import {
  CosmosChainsMap,
  EvmChainsMap,
  MiscChainsMap,
  SubstrateChainsMap,
} from "../../domain/types/chains";
import { isCosmosConnector } from "../cosmos/cosmos-connector";

export const wagmiNetworkToSKNetwork = ({
  chain,
  cosmosChainsMap,
  evmChainsMap,
  miscChainsMap,
  substrateChainsMap,
}: {
  chain: Chain;
  evmChainsMap: Partial<EvmChainsMap>;
  cosmosChainsMap: Partial<CosmosChainsMap>;
  miscChainsMap: Partial<MiscChainsMap>;
  substrateChainsMap: Partial<SubstrateChainsMap>;
}): SKWallet["network"] => {
  return (
    Object.values({
      ...evmChainsMap,
      ...cosmosChainsMap,
      ...miscChainsMap,
      ...substrateChainsMap,
    }).find((c) => c.wagmiChain.id === chain.id)?.skChainName ?? null
  );
};

export const getCosmosChainWallet = (connector: Connector | undefined) =>
  EitherAsync.liftEither(
    !connector
      ? Left(new Error("no connector"))
      : !isCosmosConnector(connector)
        ? Left(new Error("not a cosmos connector"))
        : Right(connector)
  ).chain((conn) =>
    EitherAsync(() => conn.chainWallet).mapLeft(
      () => new Error("could not get chain wallet")
    )
  );
