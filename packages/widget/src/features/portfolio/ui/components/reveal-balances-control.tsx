import { useTranslation } from "react-i18next";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useRevealBalances } from "../../react/use-reveal-balances";

/** Reveals or hides every confidential position balance on the overview. */
export const RevealBalancesControl = () => {
  const { t } = useTranslation();
  const { canHide, canReveal, onHide, onReveal, revealFailed, revealing } =
    useRevealBalances();

  if (!canReveal && !canHide) return null;

  return (
    <Box alignItems="flex-start" display="flex" flexDirection="column" gap="1">
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
      {canReveal && revealFailed ? (
        <Text variant={{ type: "danger", weight: "normal" }}>
          {t("shared.confidential.reveal_all_failed")}
        </Text>
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
  );
};
