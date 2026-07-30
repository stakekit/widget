import { Trigger } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { Divider } from "../../../../../components/atoms/divider";
import { CaretDownIcon } from "../../../../../components/atoms/icons/caret-down";
import { PlusIcon } from "../../../../../components/atoms/icons/plus";
import { PreferredIcon } from "../../../../../components/atoms/icons/preferred";
import { XIcon } from "../../../../../components/atoms/icons/x-icon";
import { Image } from "../../../../../components/atoms/image";
import { Text } from "../../../../../components/atoms/typography/text";
import type { Yield } from "../../../../../domain/types/yields";
import type { ValidatorDto } from "../../../../../generated/api/yield";
import { APToPercentage } from "../../../../../utils";
import { formatCompactNumber } from "../../../../../utils/formatters";
import {
  addValidatorContainer,
  overflowEllipsis,
  selectorSummaryActive,
  selectorSummaryBadge,
  selectorSummaryCard,
  selectorSummaryChangeButton,
  selectorSummaryContent,
  selectorSummaryHeader,
  selectorSummaryMeta,
  selectorSummaryText,
  selectorSummaryWebsite,
  validatorChip,
  validatorChipAddButton,
  validatorChipName,
  validatorChipRemoveButton,
  validatorChipsContainer,
} from "../../styles.css";

const getDisplayWebsite = (website: string) => {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, "");
  }
};

const formatCommission = (commission: number | undefined) =>
  typeof commission === "number" ? `${APToPercentage(commission)}%` : null;

const formatValidatorTvl = (validator: ValidatorDto, selectedStake: Yield) => {
  const tvl = validator.tvl ?? validator.tvlRaw;

  if (!tvl) return null;

  const formatted = formatCompactNumber(tvl);

  return formatted === "-"
    ? null
    : `${formatted} ${selectedStake.token.symbol}`;
};

export const SelectValidatorTrigger = ({
  onRemoveValidator,
  multiSelect,
  selectedValidatorsArr,
  selectedStake,
}: {
  onRemoveValidator: (item: ValidatorDto) => void;
  multiSelect: boolean;
  selectedValidatorsArr: ValidatorDto[];
  selectedStake: Yield;
}) => {
  const { t } = useTranslation();
  const hasSelectedValidators = selectedValidatorsArr.length > 0;

  if (multiSelect) {
    return (
      <>
        <Box
          data-rk="select-validator-trigger-container"
          className={validatorChipsContainer}
        >
          <Text flexShrink={0} variant={{ weight: "bold" }}>
            {t("details.earn_with")}
          </Text>

          {selectedValidatorsArr.map((sv) => {
            const nameOrAddress = sv.name ?? sv.address;

            return (
              <Box
                key={sv.address}
                data-rk="select-validator-trigger"
                className={validatorChip}
              >
                <Image
                  wrapperProps={{ hw: "5", flexShrink: 0 }}
                  imgProps={{ borderRadius: "full" }}
                  src={sv.logoURI}
                  fallbackName={nameOrAddress}
                />

                <Text
                  className={validatorChipName}
                  variant={{ weight: "bold" }}
                >
                  {nameOrAddress}
                </Text>

                {sv.preferred ? <PreferredIcon /> : null}

                {selectedValidatorsArr.length > 1 ? (
                  <Box
                    aria-label={`Remove ${nameOrAddress}`}
                    as="button"
                    className={validatorChipRemoveButton}
                    onClick={() => onRemoveValidator(sv)}
                    type="button"
                  >
                    <XIcon hw={12} strokeWidth={4.9} />
                  </Box>
                ) : null}
              </Box>
            );
          })}

          <Trigger asChild>
            <Box
              aria-label={t("shared.manage_validators")}
              as="button"
              className={validatorChipAddButton}
              data-rk="select-validator-plus"
              type="button"
            >
              <PlusIcon hw={12} strokeWidth={4.9} />
            </Box>
          </Trigger>
        </Box>

        <Box marginTop="3">
          <Divider />
        </Box>
      </>
    );
  }

  return (
    <>
      <Box
        data-rk="select-validator-trigger-container"
        className={addValidatorContainer}
      >
        {!hasSelectedValidators && !multiSelect && (
          <Box
            data-rk="select-validator-trigger"
            className={selectorSummaryCard}
          >
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("details.validator_search_title_one")}
            </Text>

            <Trigger asChild>
              <Box
                as="button"
                data-rk="select-validator-caret-down"
                className={selectorSummaryChangeButton}
              >
                <Text variant={{ weight: "bold" }}>{t("shared.change")}</Text>
                <CaretDownIcon />
              </Box>
            </Trigger>
          </Box>
        )}

        {selectedValidatorsArr.map((sv) => {
          const nameOrAddress = sv.name ?? sv.address;
          const commission = formatCommission(sv.commission);
          const tvl = formatValidatorTvl(sv, selectedStake);
          const statusLabel: string =
            sv.status === "jailed"
              ? t("details.validators_jailed")
              : sv.status && sv.status !== "active"
                ? t("details.validators_inactive")
                : t("position_details.balance_type.active");

          return (
            <Box
              key={sv.address}
              data-rk="select-validator-trigger"
              className={selectorSummaryCard}
            >
              <Box className={selectorSummaryContent}>
                <Image
                  wrapperProps={{ hw: "8", flexShrink: 0 }}
                  imgProps={{ borderRadius: "base" }}
                  src={sv.logoURI}
                  fallbackName={nameOrAddress}
                />

                <Box className={selectorSummaryText}>
                  <Box className={selectorSummaryHeader}>
                    <Text
                      className={overflowEllipsis}
                      variant={{ weight: "bold" }}
                    >
                      {nameOrAddress}
                    </Text>

                    {sv.preferred && (
                      <Text as="span" className={selectorSummaryBadge}>
                        {t("details.validators_preferred")}
                      </Text>
                    )}
                  </Box>

                  <Box className={selectorSummaryMeta}>
                    {commission && (
                      <Text variant={{ type: "muted", weight: "normal" }}>
                        {t("details.validators_comission")} {commission}
                      </Text>
                    )}

                    {tvl && (
                      <Text variant={{ type: "muted", weight: "normal" }}>
                        TVL {tvl}
                      </Text>
                    )}

                    <Text
                      variant={{
                        type:
                          sv.status && sv.status !== "active"
                            ? "muted"
                            : "base",
                        weight: "normal",
                      }}
                      className={
                        sv.status && sv.status !== "active"
                          ? undefined
                          : selectorSummaryActive
                      }
                    >
                      {statusLabel}
                    </Text>
                  </Box>

                  {sv.website && (
                    <Text
                      as="a"
                      href={sv.website}
                      target="_blank"
                      rel="noreferrer"
                      className={selectorSummaryWebsite}
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {getDisplayWebsite(sv.website)}
                    </Text>
                  )}
                </Box>
              </Box>

              {multiSelect && selectedValidatorsArr.length > 1 ? (
                <Box
                  as="button"
                  display="flex"
                  flexShrink={0}
                  onClick={() => onRemoveValidator(sv)}
                >
                  <XIcon hw={12} strokeWidth={4.9} />
                </Box>
              ) : (
                !multiSelect && (
                  <Trigger asChild>
                    <Box
                      as="button"
                      data-rk="select-validator-caret-down"
                      className={selectorSummaryChangeButton}
                    >
                      <Text variant={{ weight: "bold" }}>
                        {t("shared.change")}
                      </Text>
                      <CaretDownIcon />
                    </Box>
                  </Trigger>
                )
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop="3">
        <Divider />
      </Box>
    </>
  );
};
