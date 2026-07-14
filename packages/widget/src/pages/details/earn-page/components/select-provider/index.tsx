import { useAtomValue } from "@effect/atom-react";
import { Trigger } from "@radix-ui/react-dialog";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { CaretDownIcon } from "../../../../../components/atoms/icons/caret-down";
import { Image } from "../../../../../components/atoms/image";
import { Text } from "../../../../../components/atoms/typography/text";
import { SelectYield } from "../../../../../components/molecules/select-yield";
import {
  getYieldProviderYieldIds,
  isYieldWithProviderOptions,
} from "../../../../../domain/types/yields";
import {
  MultiYieldsKey,
  visibleMultiYieldsAtom,
} from "../../../../../hooks/api/yield-atoms";
import { formatCompactUsd } from "../../../../../utils/formatters";
import { useEarnPageContext } from "../../state/earn-page-context";
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

  const formatted = formatCompactUsd(tvlUsd);

  return formatted === "-" ? null : formatted;
};

export const SelectProvider = () => {
  const {
    appLoading,
    onProviderYieldIdSelect,
    selectedProviderYieldId,
    selectedStake,
  } = useEarnPageContext();

  const { t } = useTranslation();

  const providerYieldIdOptions =
    selectedStake && isYieldWithProviderOptions(selectedStake)
      ? getYieldProviderYieldIds(selectedStake)
      : null;

  const yieldIds = providerYieldIdOptions ?? [];
  const yields = AsyncResult.getOrElse(
    useAtomValue(
      visibleMultiYieldsAtom(
        new MultiYieldsKey({
          enabled: yieldIds.length > 0,
          yieldIds,
        })
      )
    ),
    () => null
  );

  const selectedProviderYield =
    selectedProviderYieldId && yields
      ? (yields.find((value) => value.id === selectedProviderYieldId) ?? null)
      : null;
  const provider = selectedProviderYield?.provider;

  return appLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : selectedStake &&
    providerYieldIdOptions &&
    selectedProviderYield &&
    provider ? (
    <SelectYield
      onItemClick={(yieldDto) => onProviderYieldIdSelect(yieldDto.id)}
      providerYieldIds={providerYieldIdOptions}
      selectedYieldId={selectedProviderYield.id}
      trigger={
        <Box className={selectorSummaryCard} marginTop="3">
          <Box className={selectorSummaryContent}>
            <Image
              wrapperProps={{ hw: "8", flexShrink: 0 }}
              imgProps={{ borderRadius: "base" }}
              src={provider.logoURI}
              fallbackName={provider.name}
            />

            <Box className={selectorSummaryText}>
              <Text className={overflowEllipsis} variant={{ weight: "bold" }}>
                {provider.name}
              </Text>

              {getProviderTvl(provider.tvlUsd) && (
                <Box className={selectorSummaryMeta}>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    TVL {getProviderTvl(provider.tvlUsd)}
                  </Text>
                </Box>
              )}

              {provider.website && (
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
        </Box>
      }
    />
  ) : null;
};
