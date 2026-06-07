import { Trigger } from "@radix-ui/react-dialog";
import { Maybe } from "purify-ts";
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
import { useMultiYields } from "../../../../../hooks/api/use-multi-yields";
import { formatCompactUsd } from "../../../../../utils/formatters";
import { useEarnPageContext } from "../../state/earn-page-context";
import {
  useEarnPageDispatch,
  useEarnPageState,
} from "../../state/earn-page-state-context";
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
  const { selectedStake, selectedProviderYieldId } = useEarnPageState();
  const { appLoading } = useEarnPageContext();
  const dispatch = useEarnPageDispatch();

  const { t } = useTranslation();

  const providerYieldIdOptions = selectedStake
    .filter(isYieldWithProviderOptions)
    .map(getYieldProviderYieldIds);

  const yields = useMultiYields(providerYieldIdOptions.orDefault([]));

  const selectedProviderYield = Maybe.fromRecord({
    selectedProviderYieldId,
    yields: Maybe.fromNullable(yields.data),
  }).chainNullable((val) =>
    val.yields.find((v) => v.id === val.selectedProviderYieldId)
  );

  const providerSelection = Maybe.fromRecord({
    selectedStake,
    providerYieldIdOptions,
    selectedProviderYield,
  }).chain((val) =>
    Maybe.fromNullable(val.selectedProviderYield.provider).map((provider) => ({
      ...val,
      provider,
    }))
  );

  return appLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : (
    providerSelection
      .map((val) => (
        <SelectYield
          onItemClick={(yieldDto) =>
            dispatch({ type: "providerYieldId/select", data: yieldDto.id })
          }
          providerYieldIds={val.providerYieldIdOptions}
          trigger={
            <Box className={selectorSummaryCard} marginTop="3">
              <Box className={selectorSummaryContent}>
                <Image
                  wrapperProps={{ hw: "8", flexShrink: 0 }}
                  imgProps={{ borderRadius: "base" }}
                  src={val.provider.logoURI}
                  fallbackName={val.provider.name}
                />

                <Box className={selectorSummaryText}>
                  <Text
                    className={overflowEllipsis}
                    variant={{ weight: "bold" }}
                  >
                    {val.provider.name}
                  </Text>

                  {getProviderTvl(val.provider.tvlUsd) && (
                    <Box className={selectorSummaryMeta}>
                      <Text variant={{ type: "muted", weight: "normal" }}>
                        TVL {getProviderTvl(val.provider.tvlUsd)}
                      </Text>
                    </Box>
                  )}

                  {val.provider.website && (
                    <Text
                      as="a"
                      href={val.provider.website}
                      target="_blank"
                      rel="noreferrer"
                      className={selectorSummaryWebsite}
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {getDisplayWebsite(val.provider.website)}
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
      ))
      .extractNullable()
  );
};
