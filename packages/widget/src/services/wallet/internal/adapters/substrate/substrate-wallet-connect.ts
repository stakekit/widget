import { isSameAddress } from "@luno-kit/core/utils";
import type { SignerPayloadJSON } from "@polkadot/types/types";
import { Array as EArray, Effect, Predicate, Schema } from "effect";
import { WalletIntegrationError } from "../../../wallet-errors";
import type {
  WalletConnectProtocol,
  WalletConnectSession,
} from "../../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import type { SubstrateChain } from "./chains";
import type { SubstrateWallet } from "./substrate-connector-meta";

const signTransactionMethod = "polkadot_signTransaction";
const methods = [signTransactionMethod, "polkadot_signMessage"];

const Hex = Schema.TemplateLiteral(["0x", Schema.String]);
const SignerResult = Schema.Struct({
  id: Schema.optionalKey(Schema.Finite),
  signature: Hex,
  // Some wallets serialise the absent optional field as null.
  signedTransaction: Schema.optionalKey(Schema.NullOr(Hex)),
});

/** WalletConnect identifies a Substrate chain by its genesis hash's first 16 bytes. */
const toChainId = (genesisHash: string) =>
  `polkadot:${genesisHash.slice(2, 34)}`;

const walletError = (operation: string, message: string) =>
  new WalletIntegrationError({ message, operation });

const addressesOn = (session: WalletConnectSession, chainId: string) =>
  session.accounts.flatMap((account) =>
    account.startsWith(`${chainId}:`) ? [account.slice(chainId.length + 1)] : []
  );

/**
 * A Substrate wallet over the shared WalletConnect protocol (namespace
 * `polkadot`). One instance belongs to one wagmi connector; `onDisconnect`
 * fires when the wallet ends this connector's session.
 */
export const makeSubstrateWalletConnect = ({
  chains: substrateChains,
  walletConnectProtocol: protocol,
  runWalletEffect,
  onDisconnect,
}: {
  readonly chains: EArray.NonEmptyReadonlyArray<SubstrateChain>;
  readonly walletConnectProtocol: WalletConnectProtocol;
  readonly runWalletEffect: RunWalletEffect;
  readonly onDisconnect: () => void;
}): SubstrateWallet => {
  const chains = EArray.map(substrateChains, (chain) =>
    toChainId(chain.genesisHash)
  );
  const state: {
    session: WalletConnectSession | undefined;
    unsubscribeEnded: (() => void) | undefined;
    attempt: number;
  } = { session: undefined, unsubscribeEnded: undefined, attempt: 0 };

  const usable = (session: WalletConnectSession) =>
    session.methods.includes(signTransactionMethod) &&
    chains.some((chainId) => addressesOn(session, chainId).length > 0);

  const restoredSession = protocol
    .sessions("polkadot")
    .pipe(Effect.map((sessions) => sessions.find(usable)));

  const release = () => {
    state.unsubscribeEnded?.();
    state.unsubscribeEnded = undefined;
    state.session = undefined;
  };

  const establish = (attempt: number) => (session: WalletConnectSession) => {
    // A late approval after disconnect stays out of connector state.
    if (attempt !== state.attempt) {
      return Effect.fail(
        walletError("substrate-connect", "Connection attempt was superseded")
      );
    }
    if (!usable(session)) {
      return Effect.fail(
        walletError(
          "substrate-wallet-connect-approval",
          "Wallet approved no Substrate account that can sign transactions"
        )
      );
    }
    release();
    state.session = session;
    state.unsubscribeEnded = protocol.subscribeEnded(session.topic, () => {
      release();
      onDisconnect();
    });
    return Effect.void;
  };

  return {
    connect: ({ isReconnecting }) => {
      const attempt = ++state.attempt;
      return runWalletEffect(
        restoredSession.pipe(
          Effect.filterOrElse(Predicate.isNotUndefined, () =>
            isReconnecting
              ? Effect.fail(
                  walletError(
                    "substrate-reconnect",
                    "No WalletConnect session to restore"
                  )
                )
              : protocol.connect({
                  namespace: "polkadot",
                  chains,
                  requiredMethods: methods,
                  optionalMethods: methods,
                  events: ["accountsChanged", "chainChanged", "connect"],
                })
          ),
          Effect.flatMap(establish(attempt))
        )
      );
    },
    disconnect: async () => {
      ++state.attempt;
      const topic = state.session?.topic;
      release();
      if (topic) await runWalletEffect(protocol.disconnect(topic));
    },
    getAccounts: async (wagmiChainId) => {
      const chain = substrateChains.find(
        (candidate) => candidate.wagmiChain.id === wagmiChainId
      );
      return state.session && chain
        ? addressesOn(state.session, toChainId(chain.genesisHash))
        : [];
    },
    canRestore: () =>
      runWalletEffect(restoredSession).then(Predicate.isNotUndefined),
    signPayload: (payload: SignerPayloadJSON) => {
      const session = state.session;
      if (!session) {
        return Effect.fail(
          walletError("substrate-sign", "WalletConnect session not connected")
        );
      }
      const chainId = toChainId(payload.genesisHash);
      // Wallets may report the signer in another SS58 format.
      const address = addressesOn(session, chainId).find((candidate) =>
        isSameAddress(candidate, payload.address)
      );
      if (!address) {
        return Effect.fail(
          walletError(
            "substrate-sign",
            "Signer is not an account of this WalletConnect session"
          )
        );
      }
      return protocol.request({
        topic: session.topic,
        chainId,
        method: signTransactionMethod,
        params: { address, transactionPayload: { ...payload, address } },
        response: SignerResult,
      });
    },
  };
};
