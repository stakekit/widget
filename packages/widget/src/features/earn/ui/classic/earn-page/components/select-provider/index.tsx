import { useAtomValue } from "@effect/atom-react";
import { Trigger } from "@radix-ui/react-dialog";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../../../domain/earn/models";
import {
  getYieldProviderYieldIds,
  isYieldWithProviderOptions,
} from "../../../../../../../domain/earn/yield";
import { formatUsd } from "../../../../../../../shared/lib/formatters";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import {
  ContentLoaderLine,
  ContentLoaderSquare,
} from "../../../../../../../shared/ui/primitives/content-loader";
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

  if (appLoading || (providerYieldIdOptions && !selectedProviderYield)) {
    return <SelectProviderCard />;
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
      trigger={<SelectProviderCard provider={provider} />}
    />
  );
};

export const SelectProviderCard = ({
  provider,
}: {
  provider?: NonNullable<EarnYieldWithProvider["provider"]>;
}) => {
  const { t } = useTranslation();
  const tvl = provider ? getProviderTvl(provider.tvlUsd) : null;
  const changeButton = (
    <Box
      as="button"
      data-rk="select-provider-trigger"
      className={selectorSummaryChangeButton}
      disabled={!provider}
    >
      <Text variant={{ weight: "bold" }}>{t("shared.change")}</Text>
      <CaretDownIcon loading={!provider} />
    </Box>
  );

  return (
    <Box className={selectorSummaryCard} marginTop="3">
      <Box className={selectorSummaryContent}>
        <Box hw="8" flexShrink={0}>
          {provider ? (
            <Image
              wrapperProps={{ hw: "full" }}
              imgProps={{ borderRadius: "base" }}
              src={provider.logoURI}
              fallbackName={provider.name}
            />
          ) : (
            <ContentLoaderSquare />
          )}
        </Box>

        <Box className={selectorSummaryText}>
          <Text className={overflowEllipsis} variant={{ weight: "bold" }}>
            {provider ? provider.name : <ContentLoaderLine widthPx="12ch" />}
          </Text>

          {tvl && (
            <Box className={selectorSummaryMeta}>
              <Text variant={{ type: "muted", weight: "normal" }}>
                TVL {tvl}
              </Text>
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

      {provider ? <Trigger asChild>{changeButton}</Trigger> : changeButton}
    </Box>
  );
};
