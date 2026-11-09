import { useTranslation } from "react-i18next";

import { useWidgetConfig } from "../../../../../features/widget-configuration/index";
import { unavailableFigure } from "../../../../../shared/lib/number-format";
import { Stack, Text } from "../../../../../ui/index";

/** An estimated reward in the reward token and, when priced, in USD. */
type RewardFigure = { readonly token: string; readonly usd: string | null };

type EstimatedRewardAmountsProps = {
  /**
   * The estimated rewards, formatted, such as "0.0834 ETH" and "$243.10";
   * null before an amount is entered, when each row says "—" so the rows
   * hold their place as the amount changes.
   */
  readonly figures: {
    readonly yearly: RewardFigure;
    readonly monthly: RewardFigure;
  } | null;
};

/**
 * The token figure, then its USD value after a separator: an estimate of
 * what the amount earns, in `success`, or a muted "—" while unknown.
 */
const RewardValue = ({ figure }: { readonly figure: RewardFigure | null }) => (
  <Stack direction="row" align="center" gap={4}>
    <Text numeric tone={figure ? "success" : "muted"}>
      {figure?.token ?? unavailableFigure}
    </Text>
    {figure?.usd != null && (
      <Text tone="muted" numeric>
        {`· ${figure.usd}`}
      </Text>
    )}
  </Stack>
);

export const EstimatedRewardAmounts = ({
  figures,
}: EstimatedRewardAmountsProps) => {
  const { t } = useTranslation();
  const { earnPresentation } = useWidgetConfig("hostProfile");

  return (
    <Stack gap={8}>
      <Stack
        direction="row"
        align="center"
        justify="between"
        gap={8}
        testId="estimated-reward__yearly"
        hostHook="estimated-reward__yearly"
      >
        <Text tone="muted">
          {t(
            earnPresentation.zerion ? "details.rewards.yearly" : "shared.yearly"
          )}
        </Text>
        <RewardValue figure={figures?.yearly ?? null} />
      </Stack>

      <Stack
        direction="row"
        align="center"
        justify="between"
        gap={8}
        testId="estimated-reward__monthly"
        hostHook="estimated-reward__monthly"
      >
        <Text tone="muted">{t("shared.monthly")}</Text>
        <RewardValue figure={figures?.monthly ?? null} />
      </Stack>
    </Stack>
  );
};
