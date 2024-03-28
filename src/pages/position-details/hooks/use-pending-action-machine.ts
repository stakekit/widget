import useStateMachine, { t } from "@cassiozen/usestatemachine";
import { $$t } from "@cassiozen/usestatemachine/dist/types";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import {
  PendingActionDto,
  ValidatorDto,
  YieldBalanceDto,
} from "@stakekit/api-hooks";
import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../domain";

const tt = t as <T extends unknown>() => {
  [$$t]: T;
};

const usePendingActionMachine = () => {
  const trackEvent = useTrackEvent();
  const { integrationData } = useUnstakeOrPendingActionState();

  return useStateMachine({
    schema: {
      events: {
        PA_CLICK: tt<{
          pendingActionDto: PendingActionDto;
          yieldBalance: YieldBalanceDto;
        }>(),
        MULTI_SELECT: tt<{ validator: ValidatorDto["address"] }>(),
      },
      context: tt<{
        pendingActionDto: PendingActionDto | null;
        yieldBalance: YieldBalanceDto | null;
        selectedValidators: Set<ValidatorDto["address"]>;
      }>(),
    },
    initial: "initial",
    on: { PA_CLICK: "paCheck" },
    context: {
      pendingActionDto: null,
      yieldBalance: null,
      selectedValidators: new Set<ValidatorDto["address"]>(),
    },
    states: {
      initial: {},
      paCheck: {
        on: {
          __MULTI_VALIDATOR_SELECT__: "multiValidatorSelect",
          __SINGLE_VALIDATOR_SELECT__: "singleValidatorSelect",
          __PENDING_ACTION__: "pendingActionLoading",
        },
        effect: ({ event, setContext, send }) => {
          setContext((ctx) => ({
            ...ctx,
            pendingActionDto: event.pendingActionDto,
            yieldBalance: event.yieldBalance,
          }));

          integrationData.ifJust((val) => {
            trackEvent("pendingActionClicked", {
              yieldId: val.id,
              type: event.pendingActionDto.type,
            });

            if (PAMultiValidatorsRequired(event.pendingActionDto)) {
              send("__MULTI_VALIDATOR_SELECT__");
            } else if (PASingleValidatorRequired(event.pendingActionDto)) {
              send("__SINGLE_VALIDATOR_SELECT__");
            } else {
              send("__PENDING_ACTION__");
            }
          });
        },
      },

      multiValidatorSelect: {
        on: { MULTI_SELECT: "multiValidatorSelect" },
        effect: ({ event, setContext }) => {
          if (event.type === "MULTI_SELECT") {
            setContext((ctx) => {
              const newSet = new Set(ctx.selectedValidators);

              if (newSet.has(event.validator)) {
                newSet.delete(event.validator);
              } else {
                newSet.add(event.validator);
              }

              if (newSet.size === 0) return ctx;

              return {
                ...ctx,
                selectedValidators: newSet,
              };
            });
          }
        },
      },
      singleValidatorSelect: {},

      pendingActionLoading: {},
    },
  });
};
