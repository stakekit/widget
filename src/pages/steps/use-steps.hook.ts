import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStepsMachine } from "./use-steps-machine.hook";
import { ActionDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useSavedRef } from "../../hooks";
import { useInvalidateYieldBalances } from "../../hooks/api/use-yield-balances-scan";
import { useInvalidateTokenAvailableAmount } from "../../hooks/api/use-token-available-amount";

export const useSteps = ({
  session,
  onDone,
  onSignSuccess,
  onSubmitSuccess,
}: {
  onDone?: () => void;
  onSignSuccess?: () => void;
  onSubmitSuccess?: () => void;
  session: Maybe<ActionDto>;
}) => {
  const navigate = useNavigate();

  const callbacksRef = useSavedRef({
    onSignSuccess,
    onSubmitSuccess,
    onDone,
    invalidateBalances: useInvalidateYieldBalances(),
    invalidateTokenAvailableAmount: useInvalidateTokenAvailableAmount(),
  });

  const [machine, send] = useStepsMachine();

  const sessionId = session.map((val) => val.id).extractNullable();
  const yieldId = session.map((val) => val.integrationId).extractNullable();

  /**
   *
   * @summary Start sign + check tx on mount
   */
  useEffect(() => {
    if (!sessionId || !yieldId) return;

    send({ type: "START", sessionId, yieldId });
  }, [sessionId, send, yieldId]);

  useEffect(() => {
    if (machine.event.type === "SIGN_SUCCESS") {
      callbacksRef.current.onSignSuccess?.();
    } else if (machine.event.type === "BROADCAST_SUCCESS") {
      callbacksRef.current.onSubmitSuccess?.();
    }
  }, [machine.event.type, callbacksRef]);

  /**
   *
   * @summary Clear timeout on unmount
   */
  useEffect(() => {
    return () => {
      const timeoutId = machine.context.txCheckTimeoutId;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [machine.context.txCheckTimeoutId]);

  useEffect(() => {
    if (machine.value === "done") {
      callbacksRef.current.onDone?.();
      callbacksRef.current.invalidateBalances();
      callbacksRef.current.invalidateTokenAvailableAmount();

      navigate("../complete", {
        state: { urls: machine.context.urls },
        relative: "path",
        replace: true,
      });
    }
  }, [callbacksRef, machine.context.urls, machine.value, navigate]);

  const onClick = () => navigate(-1);

  const isSignSuccess =
    machine.value !== "idle" &&
    machine.value !== "signLoading" &&
    machine.value !== "signError";

  const isBroadcastSuccess =
    isSignSuccess &&
    machine.value !== "broadcastLoading" &&
    machine.value !== "broadcastError";

  const state = {
    sign: {
      isSuccess: isSignSuccess,
      isLoading: machine.value === "signLoading",
      isError: machine.value === "signError",
      retry: () => {
        if (machine.value !== "signError" || !sessionId || !yieldId) return;

        send({ type: "SIGN_RETRY", sessionId, yieldId });
      },
    },
    broadcast: {
      isSuccess: isBroadcastSuccess,
      isLoading: machine.value === "broadcastLoading",
      isError: machine.value === "broadcastError",
      retry: () => {
        if (machine.value !== "broadcastError") return;

        send({ type: "BROADCAST_RETRY" });
      },
    },
    checkTxStatus: {
      isSuccess: machine.value === "done",
      isLoading:
        machine.value === "txCheckLoading" || machine.value === "txCheckRetry",
      isError: machine.value === "txCheckError",
      retry: () => {
        if (machine.value === "txCheckLoading") return;

        send({ type: "TX_CHECK_RETRY" });
      },
    },
  };

  return {
    state,
    onClick,
  };
};
