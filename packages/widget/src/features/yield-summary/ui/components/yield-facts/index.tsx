import type { DateTime } from "effect";
import { useTranslation } from "react-i18next";

import type { SelectedValidators } from "../../../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { formatAddress } from "../../../../../shared/lib/general";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  DetailList,
  DetailRow,
  Disclosure,
  ExternalLink,
  InfoTip,
  Stack,
  Text,
} from "../../../../../ui/index";
import {
  getYieldContracts,
  getYieldFacts,
  type YieldFactId,
  type YieldFactValue as YieldFactValueModel,
} from "../../../../yield-presentation/index";
import { YieldRiskRatingActions } from "../yield-risk";

/** A yield fact's value: text, the risk rating with its explainer, or a link. */
export const YieldFactValue = ({
  value,
}: {
  readonly value: YieldFactValueModel;
}) => {
  const { t } = useTranslation();

  if (typeof value === "string") return value;
  if (value._tag === "Risk") {
    return <YieldRiskRatingActions risk={value.risk} />;
  }
  return (
    <ExternalLink href={value.href} newTabLabel={t("shared.opens_in_new_tab")}>
      {value.label}
    </ExternalLink>
  );
};

/**
 * What a yield is, wherever it is shown: its description and documentation,
 * then its facts and its contracts, under one "About". A page that already
 * shows a fact elsewhere, such as a figure its summary leads with, passes it
 * in `omit` so no fact appears twice.
 */
export const YieldFactsSection = ({
  now = null,
  omit = [],
  selectedValidators = null,
  yieldDto,
}: {
  /** Presentation time: a batched vault's cooldown reads as its next batch. */
  readonly now?: DateTime.Utc | null;
  readonly omit?: ReadonlyArray<YieldFactId>;
  readonly selectedValidators?: SelectedValidators | null;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const resolveTokenLogo = useTokenLogoResolver();
  const facts = getYieldFacts({
    locale,
    now,
    selectedValidators,
    t,
    yieldDto,
  }).filter((fact) => !omit.includes(fact.id));
  const contracts = getYieldContracts(yieldDto, t);
  const { description, documentation } = yieldDto.metadata;

  return (
    <Disclosure
      title={t("dashboard.earn_details.about")}
      defaultOpen
      testId="yield-facts"
    >
      <Stack gap={16}>
        {description || documentation ? (
          <Stack gap={4}>
            {description ? <Text tone="muted">{description}</Text> : null}
            {documentation ? (
              <ExternalLink
                href={documentation}
                newTabLabel={t("shared.opens_in_new_tab")}
              >
                {t("dashboard.earn_details.read_docs")}
              </ExternalLink>
            ) : null}
          </Stack>
        ) : null}

        <DetailList>
          {facts.map((fact) => (
            <DetailRow
              key={fact.id}
              label={fact.label}
              logo={
                fact.token === undefined
                  ? undefined
                  : resolveTokenLogo(fact.token, { badge: "none" })
              }
              value={
                fact.info === undefined ? (
                  <YieldFactValue value={fact.value} />
                ) : (
                  <Stack as="span" direction="row" align="center" gap={4}>
                    <YieldFactValue value={fact.value} />
                    <InfoTip label={fact.info.label}>{fact.info.text}</InfoTip>
                  </Stack>
                )
              }
            />
          ))}
          {contracts.map((contract) => (
            <DetailRow
              key={`${contract.label}-${contract.address}`}
              label={contract.label}
              value={formatAddress(contract.address)}
              copyable={{
                value: contract.address,
                label: t("position_details.copy_address", {
                  label: contract.label,
                }),
                copiedLabel: t("position_details.copied"),
              }}
            />
          ))}
        </DetailList>
      </Stack>
    </Disclosure>
  );
};
