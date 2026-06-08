import { Trigger } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../components/atoms/box";
import { CaretDownIcon } from "../../../../components/atoms/icons/caret-down";
import { Image } from "../../../../components/atoms/image";
import { Text } from "../../../../components/atoms/typography/text";
import { SelectValidator } from "../../../../components/molecules/select-validator";
import {
  isYieldActionArgRequired,
  isYieldValidatorSelectionRequired,
} from "../../../../domain/types/yields";
import { useSelectValidator } from "../../../../pages/details/earn-page/components/select-validator-section/use-select-validator";
import { useEarnPageContext } from "../../../../pages/details/earn-page/state/earn-page-context";
import {
  formatCommission,
  formatProviderStatus,
  formatProviderTvl,
  formatProviderWebsite,
  formatProviderWebsiteHref,
} from "../earn-details-formatters";
import * as styles from "../styles.css";

type ProviderDetailsItem = NonNullable<
  ReturnType<
    ReturnType<typeof useEarnPageContext>["providersDetails"]["extractNullable"]
  >
>[number];

export const ProviderSelectionCard = () => {
  const {
    hasMoreValidators,
    isLoading,
    isLoadingMoreValidators,
    onClose,
    onItemClick,
    onLoadMoreValidators,
    onOpen,
    onValidatorSearch,
    onViewMoreClick,
    selectedStake,
    selectedValidators,
    validatorSearch,
    validatorsData,
  } = useSelectValidator();
  const { providersDetails } = useEarnPageContext();
  const { t } = useTranslation();

  const yieldDto = selectedStake.extractNullable();

  if (!yieldDto || !isYieldValidatorSelectionRequired(yieldDto)) return null;

  const selectedValidatorsArr = [...selectedValidators.values()];
  const selectedProvider = providersDetails.extractNullable()?.[0];
  const providerName =
    selectedProvider?.name ??
    selectedValidatorsArr[0]?.name ??
    selectedValidatorsArr[0]?.address ??
    yieldDto.provider?.name ??
    yieldDto.providerId;
  const multiSelect = isYieldActionArgRequired(
    yieldDto,
    "enter",
    "validatorAddresses"
  );
  const validators = validatorsData.orDefault([]);

  return (
    <SelectValidator
      trigger={
        <Box className={styles.providerCard}>
          <Box className={styles.providerCardMainRow}>
            <Image
              wrapperProps={{ hw: "8", flexShrink: 0 }}
              imgProps={{ borderRadius: "base" }}
              src={selectedProvider?.logo}
              fallbackName={providerName}
            />

            <Box className={styles.providerCardContent}>
              <Box className={styles.providerCardHeader}>
                <Text
                  className={styles.providerNameText}
                  variant={{ weight: "bold" }}
                >
                  {providerName}
                </Text>

                {selectedProvider?.preferred ? (
                  <Box className={styles.autoBadge}>
                    <Text variant={{ weight: "bold", size: "small" }}>
                      {t("details.validators_preferred")}
                    </Text>
                  </Box>
                ) : null}
              </Box>

              <ProviderMetaLine
                provider={selectedProvider}
                tokenSymbol={yieldDto.token.symbol}
              />
            </Box>

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
          </Box>

          {selectedProvider?.website ? (
            <Text
              as="a"
              className={styles.providerWebsiteText}
              href={formatProviderWebsiteHref(selectedProvider.website)}
              rel="noreferrer"
              target="_blank"
              variant={{ type: "muted", weight: "normal" }}
            >
              {formatProviderWebsite(selectedProvider.website)}
              <ExternalLinkIcon />
            </Text>
          ) : null}
        </Box>
      }
      selectedValidators={new Set(selectedValidatorsArr.map((v) => v.address))}
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

const ProviderMetaLine = ({
  provider,
  tokenSymbol,
}: {
  provider: ProviderDetailsItem | undefined;
  tokenSymbol: string;
}) => {
  const details = [
    formatCommission(provider?.commission),
    formatProviderTvl(provider?.stakedBalance, tokenSymbol),
    provider?.status ? formatProviderStatus(provider.status) : null,
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
            detail.toLowerCase() === "active"
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
