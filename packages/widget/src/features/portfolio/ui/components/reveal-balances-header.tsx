import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Box, Button, Stack, Text } from "../../../../ui/index";
import { useRevealBalances } from "../use-reveal-balances";

/**
 * A positions list header row that ends with the control revealing or hiding
 * every confidential position balance, the reveal's failure under the row.
 * Without a leading or trailing part, it shows only while there is something
 * to reveal or hide.
 */
export const RevealBalancesHeader = ({
  leading,
  trailing,
}: {
  /** The row's start, such as the list title. */
  readonly leading?: ReactNode;
  /** What sits just before the control, such as the position count. */
  readonly trailing?: ReactNode;
}) => {
  const { t } = useTranslation();
  const { canHide, canReveal, onHide, onReveal, revealFailed, revealing } =
    useRevealBalances();
  const hasControl = canReveal || canHide;

  if (!leading && !trailing && !hasControl) return null;

  return (
    <Box paddingBlock={4}>
      <Stack gap={4}>
        <Stack
          direction="row"
          align="center"
          justify={leading ? "between" : "end"}
          gap={8}
        >
          {leading}
          <Stack direction="row" align="center" gap={8}>
            {trailing}
            {canReveal ? (
              <Button size="sm" loading={revealing} onClick={onReveal}>
                {t("shared.confidential.reveal_all")}
              </Button>
            ) : null}
            {canHide ? (
              <Button size="sm" onClick={onHide}>
                {t("shared.confidential.hide_all")}
              </Button>
            ) : null}
          </Stack>
        </Stack>
        {canReveal && revealFailed ? (
          <Text tone="danger" align="end">
            {t("shared.confidential.reveal_all_failed")}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
};
