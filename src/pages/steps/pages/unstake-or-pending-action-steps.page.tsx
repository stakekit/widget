import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { StepsPage } from "./common.page";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSetActionHistoryData } from "../../../providers/stake-history";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";

export const UnstakeOrPendingActionStepsPage = () => {
  const {
    unstakeSession,
    pendingActionToken,
    pendingActionSession,
    integrationData,
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
      : integrationData.ifJust((val) =>
          setActionHistoryData({
            type: "unstake",
            integrationData: val,
            amount: new BigNumber(
              unstakeSession.map((v) => v.amount).extract() ?? 0
            ),
            interactedToken: Maybe.fromPredicate(
              (t) => t === "liquid-staking",
              val.metadata.type
            )
              .chain(() => Maybe.fromNullable(val.metadata.rewardTokens))
              .chain((v) => List.head(v)) // TODO: Handle multiple reward tokens
              .orDefault(val.token),
          })
        );

  return (
    <StepsPage
      session={pendingActionMatch ? pendingActionSession : unstakeSession}
      onDone={onDone}
    />
  );
};
