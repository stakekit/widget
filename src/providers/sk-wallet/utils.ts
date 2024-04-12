import { Chain } from "wagmi/chains";
import { SKWallet } from "../../domain/types";
import {
  CosmosChainsMap,
  EvmChainsMap,
  MiscChainsMap,
  SubstrateChainsMap,
} from "../../domain/types/chains";
import { DecodedEVMTransaction } from "./validation";
import { EVMTx, TxType } from "../../domain/types/wallets/generic-wallet";
import { Hex, numberToHex } from "viem";

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

export const prepareEVMTx = ({
  address,
  decodedTx,
}: {
  address: Hex;
  decodedTx: DecodedEVMTransaction;
}): EVMTx => ({
  to: decodedTx.to,
  from: address,
  data: decodedTx.data,
  value: decodedTx.value ? numberToHex(decodedTx.value) : undefined,
  nonce: numberToHex(decodedTx.nonce),
  gas: numberToHex(decodedTx.gasLimit),
  chainId: numberToHex(decodedTx.chainId),
  ...(decodedTx.maxFeePerGas
    ? {
        type: TxType.EIP1559,
        maxFeePerGas: numberToHex(decodedTx.maxFeePerGas),
        maxPriorityFeePerGas: decodedTx.maxPriorityFeePerGas
          ? numberToHex(decodedTx.maxPriorityFeePerGas)
          : undefined,
      }
    : { type: TxType.Legacy }),
});
