import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { StepsPage } from "./common.page";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSetActionHistoryData } from "../../../providers/stake-history";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";

export const UnstakeOrPendingActionStepsPage = () => {
  const {
    unstakeSession,
    pendingActionToken,
    pendingActionSession,
    integrationData,
    unstakeToken,
  } = useUnstakeOrPendingActionState();

  const pendingActionMatch = usePendingActionMatch();

  useTrackPage(pendingActionMatch ? "pendingActionSteps" : "unstakeSteps");

  const setActionHistoryData = useSetActionHistoryData();

  const onDone = () =>
    pendingActionMatch
      ? Maybe.fromRecord({
          integrationData,
          pendingActionSession,
          pendingActionToken,
        }).ifJust((val) =>
          setActionHistoryData({
            type: "pending_action",
            integrationData: val.integrationData,
            amount: new BigNumber(
              pendingActionSession.map((v) => v.amount).extract() ?? 0
            ),
            pendingActionType: val.pendingActionSession.type,
            interactedToken: val.pendingActionToken,
          })
        )
      : Maybe.fromRecord({ integrationData, unstakeToken }).ifJust((val) =>
          setActionHistoryData({
            type: "unstake",
            integrationData: val.integrationData,
            amount: new BigNumber(
              unstakeSession.map((v) => v.amount).extract() ?? 0
            ),
            interactedToken: val.unstakeToken,
          })
        );

  return (
    <StepsPage
      session={pendingActionMatch ? pendingActionSession : unstakeSession}
      onDone={onDone}
    />
  );
};
