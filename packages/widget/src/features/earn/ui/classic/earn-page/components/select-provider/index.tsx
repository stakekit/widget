import { Trigger } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { formatUsd } from "../../../../../../../shared/lib/formatters";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../../shared/ui/primitives/content-loader";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { Image } from "../../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import type { EarnProviderOption } from "../../../../../state/earn-selection/types";
import { EarnProviderOptionSelection } from "../../../../components/earn-provider-option-selection";
import {
  overflowEllipsis,
  selectorSummaryCard,
  selectorSummaryChangeButton,
  selectorSummaryContent,
  selectorSummaryMeta,
  selectorSummaryText,
  selectorSummaryWebsite,
} from "../../styles.css";

const getDisplayWebsite = (website: string) => {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, "");
  }
};

const getProviderTvl = (tvlUsd: unknown) => {
  if (typeof tvlUsd !== "string" && typeof tvlUsd !== "number") return null;

  const formatted = formatUsd(tvlUsd);

  return formatted === "-" ? null : formatted;
};

const ProviderOptionSummary = ({
  option,
  placeholder,
}: {
  readonly option: EarnProviderOption | null;
  readonly placeholder: string;
}) => {
  if (!option) {
    return (
      <Box className={selectorSummaryContent}>
        <Text className={overflowEllipsis} variant={{ weight: "bold" }}>
          {placeholder}
        </Text>
      </Box>
    );
  }

  const { provider } = option;
  const name = provider?.name ?? option.value;
  const tvl = getProviderTvl(provider?.tvlUsd);

  return (
    <Box className={selectorSummaryContent}>
      <Image
        wrapperProps={{ hw: "8", flexShrink: 0 }}
        imgProps={{ borderRadius: "base" }}
        src={provider?.logoURI}
        fallbackName={name}
      />

      <Box className={selectorSummaryText}>
        <Text className={overflowEllipsis} variant={{ weight: "bold" }}>
          {name}
        </Text>

        {tvl && (
          <Box className={selectorSummaryMeta}>
            <Text variant={{ type: "muted", weight: "normal" }}>TVL {tvl}</Text>
          </Box>
        )}

        {provider?.website && (
          <Text
            as="a"
            href={provider.website}
            target="_blank"
            rel="noreferrer"
            className={selectorSummaryWebsite}
            variant={{ type: "muted", weight: "normal" }}
          >
            {getDisplayWebsite(provider.website)}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export const SelectProvider = () => {
  const { t } = useTranslation();

  return (
    <EarnProviderOptionSelection
      loading={
        <Box marginTop="2">
          <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
        </Box>
      }
      renderTrigger={({ canSelect, selectedOption, title }) => (
        <Box className={selectorSummaryCard} marginTop="3">
          <ProviderOptionSummary option={selectedOption} placeholder={title} />

          {canSelect && (
            <Trigger asChild>
              <Box
                as="button"
                data-rk="select-provider-trigger"
                className={selectorSummaryChangeButton}
              >
                <Text variant={{ weight: "bold" }}>{t("shared.change")}</Text>
                <CaretDownIcon />
              </Box>
            </Trigger>
          )}
        </Box>
      )}
    />
  );
};
