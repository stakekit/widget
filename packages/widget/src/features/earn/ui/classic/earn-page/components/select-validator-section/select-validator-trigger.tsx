import { Trigger } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../../../domain/earn/models";
import { formatCompactNumber } from "../../../../../../../shared/lib/formatters";
import { APToPercentage } from "../../../../../../../shared/lib/general";
import { Divider } from "../../../../../../../shared/ui/components/divider";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../../../../shared/ui/primitives/icons/caret-down";
import { PlusIcon } from "../../../../../../../shared/ui/primitives/icons/plus";
import { PreferredIcon } from "../../../../../../../shared/ui/primitives/icons/preferred";
import { XIcon } from "../../../../../../../shared/ui/primitives/icons/x-icon";
import { Image } from "../../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import {
  addValidatorContainer,
  overflowEllipsis,
  selectorSummaryActive,
  selectorSummaryCard,
  selectorSummaryChangeButton,
  selectorSummaryContent,
  selectorSummaryHeader,
  selectorSummaryMetaText,
  selectorSummaryText,
  validatorChip,
  validatorChipAddButton,
  validatorChipName,
  validatorChipRemoveButton,
  validatorChipsContainer,
} from "../../styles.css";

const formatCommission = (commission: number | undefined) =>
  typeof commission === "number" ? `${APToPercentage(commission)}%` : null;

const formatValidatorTvl = (
  validator: EarnValidator,
  selectedStake: EarnYieldWithProvider
) => {
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
  onRemoveValidator: (item: EarnValidator) => void;
  multiSelect: boolean;
  selectedValidatorsArr: EarnValidator[];
  selectedStake: EarnYieldWithProvider;
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
                key={sv.key}
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
    <Box
      data-rk="select-validator-trigger-container"
      className={addValidatorContainer}
    >
      {!hasSelectedValidators && (
        <Box data-rk="select-validator-trigger" className={selectorSummaryCard}>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("details.validator_search_title_one")}
          </Text>

          <Trigger asChild>
            <Box
              as="button"
              data-rk="select-validator-caret-down"
              className={selectorSummaryChangeButton}
              type="button"
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
        const getStatusLabel = () => {
          if (sv.status === "jailed") {
            return t("details.validators_jailed");
          }
          if (sv.status && sv.status !== "active") {
            return t("details.validators_inactive");
          }
          return t("position_details.balance_type.active");
        };
        const statusLabel = getStatusLabel();
        const isActive = !sv.status || sv.status === "active";
        const metaParts = [commission, tvl].filter(
          (part): part is string => !!part
        );

        return (
          <Box
            key={sv.key}
            data-rk="select-validator-trigger"
            className={selectorSummaryCard}
          >
            <Box className={selectorSummaryContent}>
              <Image
                wrapperProps={{ hw: "8", flexShrink: 0 }}
                imgProps={{ borderRadius: "full" }}
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
                    <Box
                      aria-label={t("details.validators_preferred")}
                      display="flex"
                      flexShrink={0}
                    >
                      <PreferredIcon />
                    </Box>
                  )}
                </Box>

                <Text
                  className={selectorSummaryMetaText}
                  variant={{
                    type: "muted",
                    weight: "normal",
                    size: "small",
                  }}
                >
                  {metaParts.map((part) => (
                    <Box as="span" key={part}>
                      {part} ·{" "}
                    </Box>
                  ))}

                  <Box
                    as="span"
                    className={isActive ? selectorSummaryActive : undefined}
                  >
                    {statusLabel}
                  </Box>
                </Text>
              </Box>
            </Box>

            <Trigger asChild>
              <Box
                as="button"
                data-rk="select-validator-caret-down"
                className={selectorSummaryChangeButton}
                type="button"
              >
                <Text variant={{ weight: "bold" }}>{t("shared.change")}</Text>
                <CaretDownIcon />
              </Box>
            </Trigger>
          </Box>
        );
      })}
    </Box>
  );
};
