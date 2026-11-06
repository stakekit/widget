import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import type { Token } from "../../../../domain/token/token";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import { Stack, Text } from "../../../../ui/index";
import {
  formatNextBatchTiming,
  getNextBatchCopyOptions,
} from "../../../yield-summary/index";
import {
  type PositionDetailsExitReceiveTokenSelection,
  resolveExitReceiveTokenNote,
} from "../../model/exit-receive-token";

export const ExitReceiveTokenNote = ({
  integration,
  positionToken,
  selection,
}: {
  readonly integration: EarnYieldWithProvider;
  readonly positionToken: Token;
  readonly selection: PositionDetailsExitReceiveTokenSelection | null;
}) => {
  const { t } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);

  if (!selection) return null;

  if (selection.confidentialExit) {
    const nextBatch =
      selection.confidentialExit === "batched"
        ? formatNextBatchTiming({
            now: presentationTime?.now ?? null,
            side: "redemption",
            t,
            yieldDto: integration,
          })
        : null;
    return (
      <Stack testId="position-details-exit-receive-token-note">
        <Text variant="caption" tone="muted" icon="InfoIcon">
          {t(
            `position_details.receive_token.confidential_${selection.confidentialExit}`,
            {
              ...getNextBatchCopyOptions(nextBatch),
              symbol: selection.selected.symbol,
            }
          )}
        </Text>
      </Stack>
    );
  }

  const note = resolveExitReceiveTokenNote({
    positionToken,
    selected: selection.selected,
  });
  if (!note) return null;

  const message = note.formattedAddress
    ? t("position_details.receive_token.note_with_address", {
        symbol: note.symbol,
        address: note.formattedAddress,
      })
    : t("position_details.receive_token.note", {
        symbol: note.symbol,
      });

  return (
    <Stack testId="position-details-exit-receive-token-note">
      <Text variant="caption" tone="muted" icon="InfoIcon">
        {message}
      </Text>
    </Stack>
  );
};
