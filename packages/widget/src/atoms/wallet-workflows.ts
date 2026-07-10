import type { Chain } from "@stakekit/rainbowkit";
import { Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EitherAsync } from "purify-ts";

const walletWorkflowRuntime = Atom.runtime(Layer.empty);

type LedgerAccountConnector = {
  readonly requestAndSwitchAccount: (chain: Chain) => EitherAsync<Error, Chain>;
};

export const addLedgerAccountAtom = walletWorkflowRuntime.fn(
  (command: {
    readonly chain: Chain;
    readonly closeChainModal: () => void;
    readonly connector: LedgerAccountConnector | null;
  }) => {
    if (!command.connector) {
      return Effect.fail(new Error("Only Ledger Live is supported"));
    }

    return Effect.promise(() =>
      Promise.resolve(command.connector!.requestAndSwitchAccount(command.chain))
    ).pipe(
      Effect.flatMap((result) =>
        result.caseOf<Effect.Effect<void, Error>>({
          Left: (error) => Effect.fail(error),
          Right: () => Effect.sync(command.closeChainModal),
        })
      )
    );
  }
);

export const logoutAtom = walletWorkflowRuntime.fn(
  (command: { readonly run: () => Promise<void> }) =>
    Effect.promise(command.run)
);
