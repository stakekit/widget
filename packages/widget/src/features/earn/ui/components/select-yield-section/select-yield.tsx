import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import {
  getYieldOutputToken,
  getYieldRiskDisplay,
  getYieldTypeLabels,
} from "../../../../../domain/earn/yield";
import { capitalizeFirstLetters } from "../../../../../shared/lib/formatters";
import { unavailableFigure } from "../../../../../shared/lib/number-format";
import {
  useTokenLogo,
  useTokenLogoResolver,
} from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { SelectSheet, TokenTrigger } from "../../../../../ui/index";
import { useTrackEvent } from "../../../../tracking/index";
import {
  getRiskRatingTone,
  getYieldFigures,
} from "../../../../yield-summary/index";
import { useEarnYieldSelection } from "../../../react/use-earn-facades";

/** The chosen yield beside its reward rate, and the sheet to choose another. */
export const SelectYield = () => {
  const { view } = useEarnYieldSelection();

  if (!view.selected) return null;

  return <SelectYieldSheet selected={view.selected} />;
};

/**
 * The yields to choose from; each row shows its rate, TVL and risk rating.
 * Each run of yields of one type is a group, so the ranking holds.
 */
const SelectYieldSheet = ({
  selected,
}: {
  readonly selected: EarnYieldWithProvider;
}) => {
  const { select, setSearch, view } = useEarnYieldSelection();
  const trackEvent = useTrackEvent();
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveLogo = useTokenLogoResolver();

  const displayToken = getYieldOutputToken(selected) ?? selected.token;
  const triggerLogo = {
    ...useTokenLogo(displayToken, {
      badge: "provider",
      metadata: {
        logoURI: selected.metadata.logoURI,
        name: selected.metadata.name,
        provider: selected.provider,
      },
    }),
    name: displayToken.symbol,
  };

  const groups = view.filtered.reduce<
    Array<{
      key: string;
      label: string;
      items: Array<{ item: EarnYieldWithProvider; index: number }>;
    }>
  >((acc, item, index) => {
    const label = getYieldTypeLabels(item, t).title;
    const group = acc.at(-1);
    if (group?.label === label) {
      group.items.push({ item, index });
    } else {
      acc.push({ key: `${label}-${index}`, label, items: [{ item, index }] });
    }
    return acc;
  }, []);

  return (
    <SelectSheet
      title={t("details.opportunity_search_title")}
      closeLabel={t("shared.close")}
      listLabel={t("details.opportunity_search_title")}
      trigger={<TokenTrigger token={triggerLogo} testId="select-opportunity" />}
      onOpenChange={(open) => {
        if (open) trackEvent("selectYieldModalOpened");
        else setSearch("");
      }}
      search={{
        value: view.search,
        onValueChange: setSearch,
        label: t("shared.search"),
        placeholder: t("shared.search_yields"),
        clearLabel: t("shared.clear_search"),
      }}
      empty={{ title: t("details.opportunities_no_results") }}
      groups={groups.map((group) => {
        const figures = group.items.map(({ item }) =>
          getYieldFigures({ yieldDto: item, locale, t })
        );
        const rateLabels = new Set(
          figures.flatMap((figure) => (figure.rate ? [figure.rate.label] : []))
        );
        // A rate label every row shares heads the group, above the rates.
        const [sharedRateLabel] = rateLabels.size === 1 ? [...rateLabels] : [];

        return {
          key: group.key,
          label: group.label,
          ...(sharedRateLabel ? { caption: sharedRateLabel } : {}),
          options: group.items.map(({ item, index }, position) => {
            const { rate, tvl } = figures[position] ?? {
              rate: null,
              tvl: null,
            };
            const risk = getYieldRiskDisplay(item);
            const via = item.provider?.name
              ? t("details.opportunity_item_subtitle_no_network", {
                  provider: item.provider.name,
                })
              : capitalizeFirstLetters(item.token.network);

            return {
              id: item.id,
              testId: `select-opportunity__item_${item.id}-${index}`,
              title: item.metadata.name,
              subtitle: tvl
                ? `${via} · ${t("details.opportunity_item_tvl", { amount: tvl.usd })}`
                : via,
              value: rate?.value ?? unavailableFigure,
              ...(rate && !sharedRateLabel ? { subvalue: rate.label } : {}),
              ...(risk
                ? {
                    badges: [
                      {
                        label: t("details.risk.badge", { rating: risk.rating }),
                        tone: getRiskRatingTone(risk),
                      },
                    ],
                  }
                : {}),
              logo: resolveLogo(item.token, {
                badge: "provider",
                metadata: {
                  logoURI: item.metadata.logoURI,
                  name: item.metadata.name,
                  provider: item.provider,
                },
              }),
            };
          }),
        };
      })}
      selectedId={selected.id}
      onSelect={(id) => {
        const item = view.filtered.find((candidate) => candidate.id === id);
        if (item) select(item.id);
      }}
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
        search: "select-modal__search-input",
      }}
    />
  );
};
