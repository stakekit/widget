import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useRevealBalances } from "../../react/use-reveal-balances";

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
    <Box display="flex" flexDirection="column" gap="1" my="1">
      <Box
        display="flex"
        alignItems="center"
        justifyContent={leading ? "space-between" : "flex-end"}
        gap="2"
      >
        {leading}
        <Box display="flex" alignItems="center" gap="2">
          {trailing}
          {canReveal ? (
            <Button
              variant={{ size: "small", color: "smallButtonLight" }}
              disabled={revealing}
              isLoading={revealing}
              onClick={onReveal}
            >
              <Text>{t("shared.confidential.reveal_all")}</Text>
            </Button>
          ) : null}
          {canHide ? (
            <Button
              variant={{ size: "small", color: "smallButtonLight" }}
              onClick={onHide}
            >
              <Text>{t("shared.confidential.hide_all")}</Text>
            </Button>
          ) : null}
        </Box>
      </Box>
      {canReveal && revealFailed ? (
        <Text variant={{ type: "danger", weight: "normal" }} textAlign="end">
          {t("shared.confidential.reveal_all_failed")}
        </Text>
      ) : null}
    </Box>
  );
};
