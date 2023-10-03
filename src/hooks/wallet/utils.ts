import { Chain, Connector } from "wagmi";
import { SKWallet } from "../../domain/types";
import { CosmosWagmiConnector } from "../../providers/cosmos/config";
import { EitherAsync, Left, Right } from "purify-ts";
import { LedgerLiveConnector } from "../../providers/ledger/ledger-connector";
import {
  CosmosChainsMap,
  EvmChainsMap,
  MiscChainsMap,
} from "../../domain/types/chains";

export const wagmiNetworkToSKNetwork = ({
  chain,
  cosmosChainsMap,
  evmChainsMap,
  miscChainsMap,
}: {
  chain: Chain;
  evmChainsMap: EvmChainsMap;
  cosmosChainsMap: CosmosChainsMap;
  miscChainsMap: MiscChainsMap;
}): SKWallet["network"] => {
  return (
    Object.values({
      ...evmChainsMap,
      ...cosmosChainsMap,
      ...miscChainsMap,
    }).find((c) => c.wagmiChain.id === chain.id)?.skChainName ?? null
  );
};

export const isCosmosConnector = (
  connector: Connector
): connector is CosmosWagmiConnector =>
  connector instanceof CosmosWagmiConnector;

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

export const isLedgerLiveConnector = (
  connector: Connector
): connector is LedgerLiveConnector => connector instanceof LedgerLiveConnector;
