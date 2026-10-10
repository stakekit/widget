import { Trigger } from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../../domain/earn/models";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { CaretDownIcon } from "../../../../../../shared/ui/primitives/icons/caret-down";
import { PlusIcon } from "../../../../../../shared/ui/primitives/icons/plus";
import { XIcon } from "../../../../../../shared/ui/primitives/icons/x-icon";
import { Image } from "../../../../../../shared/ui/primitives/image";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { YieldSummaryProvider } from "../../../../../yield-summary/index";
import {
  formatCommission,
  formatProviderStatus,
  formatProviderTvl,
  formatProviderWebsite,
  formatProviderWebsiteHref,
} from "../../../../../yield-summary/index";
import { useEarnEntry } from "../../../../react/use-earn-facades";
import type { EarnProviderOption } from "../../../../state/earn-selection/types";
import { EarnProviderOptionSelection } from "../../../components/earn-provider-option-selection";
import { EarnValidatorSelection } from "../../../components/earn-validator-selection";
import * as styles from "../styles.css";
import { ExternalLinkIcon } from "./external-link-icon";

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
  const { view: entry } = useEarnEntry();
  const providersDetails = entry.providers;

  return (
    <>
      <EarnProviderOptionSelection
        renderTrigger={({ canSelect, selectedOption, title }) => (
          <Box className={styles.providerCardList}>
            <ProviderCard
              action={canSelect ? <ProviderChangeTrigger /> : null}
              item={getProviderOptionCardItem(selectedOption, title)}
              meta={null}
            />
          </Box>
        )}
      />

      <EarnValidatorSelection
        renderTrigger={({
          multiSelect,
          onRemoveValidator,
          selectedStake,
          selectedValidators,
        }) => (
          <ProviderCardsTrigger
            items={getProviderCardItems({
              providerDetailsArr: providersDetails ?? [],
              selectedValidatorsArr: selectedValidators,
              yieldDto: selectedStake,
            })}
            multiSelect={multiSelect}
            onRemoveValidator={onRemoveValidator}
            tokenSymbol={selectedStake.token.symbol}
          />
        )}
      />
    </>
  );
};

const ProviderChangeTrigger = () => {
  const { t } = useTranslation();

  return (
    <Trigger asChild>
      <Box as="button" className={styles.providerChangeButton} type="button">
        <Text variant={{ weight: "bold", size: "small" }}>
          {t("shared.change")}
        </Text>
        <CaretDownIcon />
      </Box>
    </Trigger>
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
          return <ProviderChangeTrigger />;
        };

        return (
          <ProviderCard
            action={getProviderAction()}
            item={item}
            key={item.key}
            meta={<ProviderMetaLine item={item} tokenSymbol={tokenSymbol} />}
          />
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

const ProviderCard = ({
  action,
  item,
  meta,
}: {
  action: ReactNode;
  item: ProviderCardItem;
  meta: ReactNode;
}) => {
  const { t } = useTranslation();

  return (
    <Box className={styles.providerCard}>
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

          {meta}
        </Box>

        {action}
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
};

const getProviderOptionCardItem = (
  option: EarnProviderOption | null,
  placeholder: string
): ProviderCardItem => ({
  key: option?.value ?? placeholder,
  commission: undefined,
  logo: option?.provider?.logoURI,
  name: option?.provider?.name ?? option?.value ?? placeholder,
  preferred: undefined,
  stakedBalance: undefined,
  status: undefined,
  validator: undefined,
  website: option?.provider?.website,
});

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
