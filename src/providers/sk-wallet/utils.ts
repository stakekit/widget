import type { Hex } from "viem";
import { numberToHex } from "viem";
import type { Chain } from "wagmi/chains";
import type { SKWallet } from "../../domain/types";
import type {
  CosmosChainsMap,
  EvmChainsMap,
  MiscChainsMap,
  SubstrateChainsMap,
} from "../../domain/types/chains";
import type { EVMTx } from "../../domain/types/wallets/generic-wallet";
import { TxType } from "../../domain/types/wallets/generic-wallet";
import type { DecodedEVMTransaction } from "./validation";

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
