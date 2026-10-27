import { useAtomValue } from "@effect/atom-react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import type { Token } from "../../../../domain/token/token";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import { Box } from "../../../../shared/ui/primitives/box";
import { InfoIcon } from "../../../../shared/ui/primitives/icons/info";
import { Text } from "../../../../shared/ui/primitives/typography/text";
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
      <Box
        data-testid="position-details-exit-receive-token-note"
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        gap="1"
      >
        <Box display="flex" alignItems="center" justifyContent="center">
          <InfoIcon />
        </Box>
        <Text variant={{ type: "muted", size: "small" }}>
          {t(
            `position_details.receive_token.confidential_${selection.confidentialExit}`,
            {
              ...getNextBatchCopyOptions(nextBatch),
              symbol: selection.selected.symbol,
            }
          )}
        </Text>
      </Box>
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
    <Box
      data-testid="position-details-exit-receive-token-note"
      display="flex"
      alignItems="center"
      justifyContent="flex-start"
      gap="1"
    >
      <Box display="flex" alignItems="center" justifyContent="center">
        <InfoIcon />
      </Box>
      <Text variant={{ type: "muted", size: "small" }}>{message}</Text>
    </Box>
  );
};
