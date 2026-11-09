import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";

import {
  formatUsd,
  unavailableFigure,
} from "../../../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../../../shared/react/widget-presentation";
import {
  Button,
  Card,
  ExternalLink,
  Skeleton,
  Stack,
  Text,
  TokenAvatar,
} from "../../../../../../../ui/index";
import {
  formatProviderWebsite,
  formatProviderWebsiteHref,
} from "../../../../../../yield-presentation/index";
import type { EarnProviderOption } from "../../../../../state/earn-selection/types";
import { EarnProviderOptionSelection } from "../../../../components/earn-provider-option-selection";

const getProviderTvl = (
  tvlUsd: BigNumber | null | undefined,
  locale: string
) => {
  if (!tvlUsd) return null;

  const formatted = formatUsd(tvlUsd, locale);

  return formatted === unavailableFigure ? null : formatted;
};

const ProviderOptionSummary = ({
  option,
  placeholder,
}: {
  readonly option: EarnProviderOption | null;
  readonly placeholder: string;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (!option) {
    return (
      <Text weight="semibold" truncate>
        {placeholder}
      </Text>
    );
  }

  const { provider } = option;
  const name = provider?.name ?? option.value;
  const tvl = getProviderTvl(provider?.tvlUsd, locale);

  return (
    <Stack direction="row" align="center" gap={12} grow>
      <TokenAvatar
        name={name}
        {...(provider?.logoURI ? { src: provider.logoURI } : {})}
        decorative
      />

      <Stack gap={2} grow>
        <Text weight="semibold" truncate>
          {name}
        </Text>

        {tvl && (
          <Text variant="caption" tone="muted" numeric>
            TVL {tvl}
          </Text>
        )}

        {provider?.website && (
          <Text variant="caption" tone="muted">
            <ExternalLink
              href={formatProviderWebsiteHref(provider.website)}
              newTabLabel={t("shared.opens_in_new_tab")}
            >
              {formatProviderWebsite(provider.website)}
            </ExternalLink>
          </Text>
        )}
      </Stack>
    </Stack>
  );
};

/** The Compact Layout's provider option, with a change control for several. */
export const SelectProvider = () => {
  const { t } = useTranslation();

  return (
    <EarnProviderOptionSelection
      loading={<Skeleton shape="line" />}
      renderTrigger={({ canSelect, open, selectedOption, title }) => (
        <Card variant="outline" padding={12}>
          <Stack direction="row" align="center" justify="between" gap={12}>
            <ProviderOptionSummary
              option={selectedOption}
              placeholder={title}
            />

            {canSelect && (
              <Button
                variant="secondary"
                size="sm"
                iconEnd="CaretDownIcon"
                onClick={open}
              >
                {t("shared.change")}
              </Button>
            )}
          </Stack>
        </Card>
      )}
    />
  );
};
