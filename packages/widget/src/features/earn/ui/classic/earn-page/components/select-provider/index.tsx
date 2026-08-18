import { useAtomValue } from "@effect/atom-react";
import { Trigger } from "@radix-ui/react-dialog";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import {
  getYieldProviderYieldIds,
  isYieldWithProviderOptions,
} from "../../../../../../../domain/earn/yield";
import { formatUsd } from "../../../../../../../shared/lib/formatters";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../../shared/ui/primitives/content-loader";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { Image } from "../../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import {
  MultiYieldsKey,
  visibleMultiYieldsAtom,
} from "../../../../../../yield-summary/index";
import { useEarnEntry } from "../../../../../react/use-earn-facades";
import { SelectYield } from "../../../../components/select-yield";
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

export const SelectProvider = () => {
  const { selectProvider, view } = useEarnEntry();
  const { appLoading, selectedProviderYieldId, selectedStake } = view;

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

  if (appLoading) {
    return (
      <Box marginTop="2">
        <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
      </Box>
    );
  }
  if (
    !selectedStake ||
    !providerYieldIdOptions ||
    !selectedProviderYield ||
    !provider
  ) {
    return null;
  }

  return (
    <SelectYield
      onItemClick={(yieldDto) => selectProvider(yieldDto.id)}
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
  );
};
