import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStepsMachine } from "./use-steps-machine.hook";
import { ActionDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useSavedRef } from "../../hooks";

export const useSteps = ({
  session,
  onSignSuccess,
  onSubmitSuccess,
}: {
  onSignSuccess?: () => void;
  onSubmitSuccess?: () => void;
  session: Maybe<ActionDto>;
}) => {
  const navigate = useNavigate();

  const callbacksRef = useSavedRef({ onSignSuccess, onSubmitSuccess });

  const [machine, send] = useStepsMachine();

  const id = session.map((val) => val.id).extractNullable();

  /**
   *
   * @summary Start sign + check tx on mount
   */
  useEffect(() => {
    if (!id) return;

    send({ type: "START", id });
  }, [id, send]);

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
      navigate("../complete", {
        state: { urls: machine.context.urls },
        relative: "path",
        replace: true,
      });
    }
  }, [machine.context.urls, machine.value, navigate]);

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
        if (machine.value !== "signError" || !id) return;

        send({ type: "SIGN_RETRY", id });
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