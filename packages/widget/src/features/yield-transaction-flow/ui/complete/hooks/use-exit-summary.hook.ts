import { useAtomValue } from "@effect/atom-react";
import { DateTime, Duration } from "effect";
import { useTranslation } from "react-i18next";

import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import { formatDateTime } from "../../../../../shared/lib/date";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { useYieldFlowExecution } from "../../yield-flow-session";

/**
 * What a finished exit, from a position or continued from Activity, adds to
 * Complete: when its funds unlock, a reminder to withdraw them then, and the
 * token a different payout comes in. An unlock within a day shows its time.
 */
export const useExitSummary = ({
  amount,
  batched,
  receiveSymbol,
  symbol,
}: {
  /** The formatted exited amount. */
  readonly amount: string;
  /** The exit only joined the next redemption batch. */
  readonly batched: boolean;
  /** The payout token's symbol, when it is not the exited one. */
  readonly receiveSymbol: string | null;
  /** The exited token's symbol. */
  readonly symbol: string;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const execution = useYieldFlowExecution();
  const unlockDate = useAtomValue(execution.exitUnlockDateAtom);
  const presentationTime = useAtomValue(presentationClockAtom);

  const unlocksAt =
    unlockDate && presentationTime
      ? formatDateTime(unlockDate, {
          day: "numeric",
          locale,
          month: "short",
          timeZone: presentationTime.timeZone,
          ...(Duration.isLessThan(
            DateTime.distance(presentationTime.now, unlockDate),
            Duration.days(1)
          )
            ? { hour: "numeric", minute: "2-digit" }
            : {}),
        })
      : null;

  return {
    note: unlocksAt
      ? t("complete.unlock_reminder", { amount, date: unlocksAt, symbol })
      : null,
    rows: receiveSymbol
      ? [
          {
            label:
              unlockDate || batched
                ? t("complete.you_will_receive")
                : t("complete.you_received"),
            testId: "complete-received",
            value: `${amount} ${receiveSymbol}`,
          },
        ]
      : [],
  };
};
