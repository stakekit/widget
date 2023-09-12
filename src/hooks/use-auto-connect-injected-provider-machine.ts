import useStateMachine, { t } from "@cassiozen/usestatemachine";
import { $$t } from "@cassiozen/usestatemachine/dist/types";
import { useConnect } from "wagmi";
import { InjectedConnector } from "@wagmi/connectors/injected";
import { useSKWallet } from "./wallet/use-sk-wallet";
import { isLedgerDappBrowserProvider } from "../utils";
import { LedgerLiveConnector } from "../providers/ledger/ledger-connector";
import { useMemo } from "react";

const tt = t as <T extends unknown>() => {
  [$$t]: T;
};

export const useAutoConnectInjectedProviderMachine = () => {
  const { isConnected, isConnecting } = useSKWallet();
  const { connectors, connect } = useConnect();

  const initial = useMemo(
    () =>
      isLedgerDappBrowserProvider()
        ? !isConnected && !isConnecting
          ? "connect"
          : "done"
        : "disabled",
    [isConnected, isConnecting]
  );
  return useStateMachine({
    schema: { context: tt<{ timeoutId: number | null; retryTimes: number }>() },
    initial: initial,
    context: { timeoutId: null, retryTimes: 0 },
    states: {
      disabled: {},
      connect: {
        on: { DONE: "done" },
        effect: ({ send }) => {
          if (isConnected) return send("DONE");

          if (isLedgerDappBrowserProvider()) {
            const ledgerLiveConnector = connectors.find(
              (c) => c instanceof LedgerLiveConnector
            );

            if (ledgerLiveConnector) {
              connect({ connector: ledgerLiveConnector });
            }
          } else {
            const injConn = connectors.find(
              (c) => c instanceof InjectedConnector
            );

            if (injConn) {
              connect({ connector: injConn });
            }
          }

          return send("DONE");
        },
      },
      done: {
        on: { CONNECT: "connect" },
        effect: ({ send, context, setContext }) => {
          if (isConnected || context.retryTimes >= 1) return;

          if (context.timeoutId) clearTimeout(context.timeoutId);

          // Retry in 2 seconds
          const newTimeoutId = setTimeout(() => {
            send("CONNECT");
          }, 1000 * 2);

          setContext((prev) => ({
            ...prev,
            retryTimes: prev.retryTimes + 1,
            timeoutId: newTimeoutId as unknown as number,
          }));
        },
      },
    },
  });
};
