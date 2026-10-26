/**
 * The playground's console surface: `window.skDev`, plus the wallet request
 * log. QA drives the host wallet from here while the widget stays mounted.
 */
import type { PlaygroundConfig } from "./playground-config";
import {
  type PlaygroundWallet,
  type WalletLogEntry,
  walletOutcomes,
} from "./wallet/playground-wallet";

const walletHelp = `skDev.wallet: the playground host wallet
  next(...outcomes)    answer the next wallet requests with these outcomes, in order
  setDefault(outcome)  answer requests with nothing queued (default "success")
  release(outcome?)    answer the oldest held request (default "success")
  reset()              clear queued outcomes and restore the default
  setAddress(address)  change the connected account; "" disconnects
  disconnect()         same as setAddress("")
  setChain(chainId)    report a chain change made in the wallet
  state()              queued outcomes, held requests, account and chain
Outcomes: ${walletOutcomes.join(", ")}
  success        the wallet signs and broadcasts
  cancelled      the user declines; nothing is broadcast
  error          the request fails before broadcasting
  errorWithHash  the wallet broadcasts, then reports a failure with the hash
  reject         the wallet's Promise rejects
  hold           the wallet broadcasts, then keeps its answer until release()
Example (late hash): skDev.wallet.next("hold"), click Stake, leave Steps, then skDev.wallet.release()`;

export const logWalletEntry = (entry: WalletLogEntry) => {
  const { method, ...request } = entry.request;
  switch (entry._tag) {
    case "Requested":
      console.info(
        `[playground wallet] ${method} requested, answering ${entry.outcome}`,
        request
      );
      return;
    case "Held":
      console.warn(
        `[playground wallet] ${method} held: the wallet has answered; skDev.wallet.release() delivers it`
      );
      return;
    case "Answered":
      console.info(
        `[playground wallet] ${method} answered (${entry.outcome}, ${entry.durationMs} ms)`,
        entry.reply
      );
      return;
  }
};

export const installDevConsole = ({
  config,
  wallet,
}: {
  readonly config: PlaygroundConfig;
  readonly wallet: PlaygroundWallet | undefined;
}) => {
  const walletConsole = wallet && {
    ...wallet.controls,
    state: wallet.getState,
    help: () => console.info(walletHelp),
  };

  Object.assign(window, { skDev: { config, wallet: walletConsole } });
  console.info(
    `[playground] wallet: ${config.wallet}. window.skDev.config holds the playground config.${
      walletConsole ? `\n${walletHelp}` : ""
    }`
  );
};
