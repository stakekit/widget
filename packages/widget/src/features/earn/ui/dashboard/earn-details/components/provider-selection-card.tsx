import { Trigger } from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../../domain/earn/models";
import {
  isYieldActionArgRequired,
  isYieldValidatorSelectionRequired,
} from "../../../../../../domain/earn/yield";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../../../shared/ui/primitives/icons/caret-down";
import { PlusIcon } from "../../../../../../shared/ui/primitives/icons/plus";
import { XIcon } from "../../../../../../shared/ui/primitives/icons/x-icon";
import { Image } from "../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { SelectValidator } from "../../../../../yield-entry/views";
import type { YieldSummaryProvider } from "../../../../../yield-summary/index";
import {
  formatCommission,
  formatProviderStatus,
  formatProviderTvl,
  formatProviderWebsite,
  formatProviderWebsiteHref,
} from "../../../../model/earn-details-formatters";
import { useEarnEntry } from "../../../../react/use-earn-facades";
import { useSelectValidator } from "../../../classic/earn-page/components/select-validator-section/use-select-validator";
import * as styles from "../styles.css";

type ProviderDetailsItem = YieldSummaryProvider;

type ProviderCardItem = {
  key: string;
  commission: ProviderDetailsItem["commission"] | EarnValidator["commission"];
  logo: string | undefined;
  name: string;
  preferred: boolean | undefined;
  stakedBalance: ProviderDetailsItem["stakedBalance"] | EarnValidator["tvlRaw"];
  status: ProviderDetailsItem["status"] | EarnValidator["status"];
  validator: EarnValidator | undefined;
  website: string | undefined;
};

export const ProviderSelectionCard = () => {
  const {
    hasMoreValidators,
    isLoading,
    isLoadingMoreValidators,
    onClose,
    onItemClick,
    onLoadMoreValidators,
    onOpen,
    onRemoveValidator,
    onValidatorSearch,
    onViewMoreClick,
    selectedStake,
    selectedValidators,
    validatorSearch,
    validatorsData,
  } = useSelectValidator();
  const { view: entry } = useEarnEntry();
  const providersDetails = entry.providers;

  const yieldDto = selectedStake;

  if (!yieldDto || !isYieldValidatorSelectionRequired(yieldDto)) return null;

  const selectedValidatorsArr = [...selectedValidators.values()];
  const providerDetailsArr = providersDetails ?? [];
  const providerCardItems = getProviderCardItems({
    providerDetailsArr,
    selectedValidatorsArr,
    yieldDto,
  });
  const multiSelect = isYieldActionArgRequired(
    yieldDto,
    "enter",
    "validatorAddresses"
  );
  const validators = validatorsData ?? [];

  return (
    <SelectValidator
      trigger={
        <ProviderCardsTrigger
          items={providerCardItems}
          multiSelect={multiSelect}
          onRemoveValidator={onRemoveValidator}
          tokenSymbol={yieldDto.token.symbol}
        />
      }
      selectedValidators={new Set(selectedValidatorsArr.map((v) => v.key))}
      multiSelect={multiSelect}
      selectedStake={yieldDto}
      onItemClick={onItemClick}
      onViewMoreClick={onViewMoreClick}
      onClose={onClose}
      onOpen={onOpen}
      onSearch={onValidatorSearch}
      searchValue={validatorSearch}
      isLoading={isLoading}
      validators={validators}
      hasMore={hasMoreValidators}
      isLoadingMore={isLoadingMoreValidators}
      onLoadMore={onLoadMoreValidators}
    />
  );
};

const ProviderCardsTrigger = ({
  items,
  multiSelect,
  onRemoveValidator,
  tokenSymbol,
}: {
  items: ProviderCardItem[];
  multiSelect: boolean;
  onRemoveValidator: (item: EarnValidator) => void;
  tokenSymbol: string;
}) => {
  const { t } = useTranslation();

  return (
    <Box className={styles.providerCardList}>
      {items.map((item) => {
        const removableValidator =
          multiSelect && items.length > 1 ? item.validator : undefined;
        const getProviderAction = (): ReactNode => {
          if (removableValidator) {
            return (
              <Box
                aria-label={`Remove ${item.name}`}
                as="button"
                className={styles.providerRemoveButton}
                onClick={() => onRemoveValidator(removableValidator)}
                type="button"
              >
                <XIcon hw={12} strokeWidth={4.9} />
              </Box>
            );
          }
          if (multiSelect) return null;
          return (
            <Trigger asChild>
              <Box
                as="button"
                className={styles.providerChangeButton}
                type="button"
              >
                <Text variant={{ weight: "bold", size: "small" }}>
                  {t("shared.change")}
                </Text>
                <CaretDownIcon />
              </Box>
            </Trigger>
          );
        };
        const providerAction = getProviderAction();

        return (
          <Box className={styles.providerCard} key={item.key}>
            <Box className={styles.providerCardMainRow}>
              <Image
                wrapperProps={{ hw: "8", flexShrink: 0 }}
                imgProps={{ borderRadius: "base" }}
                src={item.logo}
                fallbackName={item.name}
              />

              <Box className={styles.providerCardContent}>
                <Box className={styles.providerCardHeader}>
                  <Text
                    className={styles.providerNameText}
                    variant={{ weight: "bold" }}
                  >
                    {item.name}
                  </Text>

                  {item.preferred ? (
                    <Box className={styles.autoBadge}>
                      <Text
                        className={styles.autoBadgeText}
                        variant={{ weight: "bold", size: "small" }}
                      >
                        {t("details.validators_preferred")}
                      </Text>
                    </Box>
                  ) : null}
                </Box>

                <ProviderMetaLine item={item} tokenSymbol={tokenSymbol} />
              </Box>

              {providerAction}
            </Box>

            {item.website ? (
              <Text
                as="a"
                className={styles.providerWebsiteText}
                href={formatProviderWebsiteHref(item.website)}
                rel="noreferrer"
                target="_blank"
                variant={{ type: "muted", weight: "normal" }}
              >
                {formatProviderWebsite(item.website)}
                <ExternalLinkIcon />
              </Text>
            ) : null}
          </Box>
        );
      })}

      {multiSelect ? (
        <Trigger asChild>
          <Box
            as="button"
            className={styles.providerChangeButton}
            type="button"
          >
            <PlusIcon hw={12} strokeWidth={4.9} />
            <Text variant={{ weight: "bold", size: "small" }}>
              {t("shared.manage_validators")}
            </Text>
          </Box>
        </Trigger>
      ) : null}
    </Box>
  );
};

const getProviderCardItems = ({
  providerDetailsArr,
  selectedValidatorsArr,
  yieldDto,
}: {
  providerDetailsArr: ProviderDetailsItem[];
  selectedValidatorsArr: EarnValidator[];
  yieldDto: EarnYieldWithProvider;
}): ProviderCardItem[] => {
  if (selectedValidatorsArr.length) {
    return selectedValidatorsArr.map((validator, index) => {
      const providerDetails = providerDetailsArr[index];
      const name = validator.name ?? validator.address;

      return {
        key: validator.key,
        commission: providerDetails?.commission ?? validator.commission,
        logo: providerDetails?.logo ?? validator.logoURI,
        name: providerDetails?.name ?? name,
        preferred: providerDetails?.preferred ?? validator.preferred,
        stakedBalance:
          providerDetails?.stakedBalance ?? validator.tvl ?? validator.tvlRaw,
        status: providerDetails?.status ?? validator.status,
        validator,
        website: providerDetails?.website ?? validator.website,
      };
    });
  }

  const providerDetails = providerDetailsArr[0];

  return [
    {
      key: yieldDto.provider?.id ?? yieldDto.providerId ?? yieldDto.id,
      commission: providerDetails?.commission,
      logo: providerDetails?.logo ?? yieldDto.provider?.logoURI ?? undefined,
      name:
        providerDetails?.name ??
        yieldDto.provider?.name ??
        yieldDto.providerId ??
        yieldDto.metadata.name,
      preferred: providerDetails?.preferred,
      stakedBalance: providerDetails?.stakedBalance,
      status: providerDetails?.status,
      validator: undefined,
      website: providerDetails?.website ?? yieldDto.provider?.website,
    },
  ];
};

const ProviderMetaLine = ({
  item,
  tokenSymbol,
}: {
  item: ProviderCardItem;
  tokenSymbol: string;
}) => {
  const { t } = useTranslation();
  const statusLabel = formatProviderStatus(item.status, t);

  const details = [
    formatCommission(item.commission),
    formatProviderTvl(item.stakedBalance, tokenSymbol),
    statusLabel,
  ].filter((item): item is string => !!item);

  if (!details.length) return null;

  return (
    <Text
      className={styles.providerMetaText}
      variant={{ type: "muted", weight: "normal" }}
    >
      {details.map((detail, index) => (
        <Box
          as="span"
          className={
            detail === statusLabel && item.status === "active"
              ? styles.providerStatusText
              : undefined
          }
          key={detail}
        >
          {index > 0 ? "• " : ""}
          {detail}
        </Box>
      ))}
    </Text>
  );
};

const ExternalLinkIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.externalLinkIcon}
    fill="none"
    height="14"
    viewBox="0 0 14 14"
    width="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.25 3.5H3.5C2.5335 3.5 1.75 4.2835 1.75 5.25V10.5C1.75 11.4665 2.5335 12.25 3.5 12.25H8.75C9.7165 12.25 10.5 11.4665 10.5 10.5V8.75"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M8.75 1.75H12.25V5.25"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M6.41699 7.58333L12.2503 1.75"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);
