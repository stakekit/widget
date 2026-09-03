import { useTranslation } from "react-i18next";
import type { Token } from "../../../../../domain/token/token";
import { Box } from "../../../../../shared/ui/primitives/box";
import { InfoIcon } from "../../../../../shared/ui/primitives/icons/info";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  type PositionDetailsExitReceiveTokenSelection,
  resolveExitReceiveTokenNote,
} from "../../../model/exit-receive-token";

export const ExitReceiveTokenNote = ({
  positionToken,
  selection,
}: {
  readonly positionToken: Token;
  readonly selection: PositionDetailsExitReceiveTokenSelection | null;
}) => {
  const { t } = useTranslation();

  if (!selection) return null;

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
