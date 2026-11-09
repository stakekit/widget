import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { EarnValidator } from "../../../../../../domain/earn/validator";
import { isYieldValidatorSelectionRequired } from "../../../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../../../../shared/react/widget-presentation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ExternalLink,
  IconButton,
  Stack,
  Text,
} from "../../../../../../ui/index";
import type { YieldSummaryProvider } from "../../../../../yield-summary/index";
import {
  formatCommission,
  formatProviderStatus,
  formatProviderTvl,
  formatProviderWebsite,
  formatProviderWebsiteHref,
} from "../../../../../yield-summary/index";
import {
  useEarnDetails,
  useEarnFlowProviderOption,
} from "../../../../react/use-earn-facades";
import type { EarnProviderOption } from "../../../../state/earn-selection/types";
import { EarnProviderOptionSelection } from "../../../components/earn-provider-option-selection";
import { EarnValidatorSelection } from "../../../components/earn-validator-selection";

type ProviderDetailsItem = YieldSummaryProvider;

type ProviderCardItem = {
  key: string;
  commission: ProviderDetailsItem["commission"] | EarnValidator["commission"];
  logo: string | undefined;
  name: string;
  preferred: boolean | undefined;
  stakedBalance: ProviderDetailsItem["stakedBalance"];
  status: ProviderDetailsItem["status"] | EarnValidator["status"];
  validator: EarnValidator | undefined;
  website: string | undefined;
};

export const ProviderSelectionCard = () => {
  const { view: entry } = useEarnDetails();
  const providersDetails = entry.providers;

  return (
    <>
      <EarnProviderOptionSelection
        renderTrigger={({ canSelect, open, selectedOption, title }) => (
          <ProviderCard
            action={canSelect ? <ProviderChangeTrigger onClick={open} /> : null}
            item={getProviderOptionCardItem(selectedOption, title)}
            meta={null}
          />
        )}
      />

      <EarnValidatorSelection
        renderTrigger={({
          multiSelect,
          onRemoveValidator,
          open,
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
            onOpen={open}
            onRemoveValidator={onRemoveValidator}
            tokenSymbol={selectedStake.token.symbol}
          />
        )}
      />
    </>
  );
};

/**
 * The provider option and validators a started flow executes against. Nothing
 * here is selectable: the flow owns its target until it ends.
 */
export const ProviderSummary = ({
  providerOption,
  selectedValidators,
  yieldDto,
}: {
  readonly providerOption: EarnProviderOption | null;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly yieldDto: EarnYieldWithProvider;
}) => (
  <>
    {providerOption ? (
      <ProviderOptionSummary providerOption={providerOption} />
    ) : null}

    {/* Captured validators are what executes, whatever the live Yield now
        advertises about validator selection. */}
    {selectedValidators.length > 0 ||
    isYieldValidatorSelectionRequired(yieldDto) ? (
      <Stack gap={8}>
        {getProviderCardItems({
          providerDetailsArr: [],
          selectedValidatorsArr: [...selectedValidators],
          yieldDto,
        }).map((item) => (
          <ProviderCard
            action={null}
            item={item}
            key={item.key}
            meta={
              <ProviderMetaLine
                item={item}
                tokenSymbol={yieldDto.token.symbol}
              />
            }
          />
        ))}
      </Stack>
    ) : null}
  </>
);

const ProviderOptionSummary = ({
  providerOption,
}: {
  readonly providerOption: EarnProviderOption;
}) => {
  const { t } = useTranslation();
  const option = useEarnFlowProviderOption(providerOption);

  return (
    <ProviderCard
      action={null}
      item={getProviderOptionCardItem(
        option,
        t("details.provider_search_title")
      )}
      meta={null}
    />
  );
};

const ProviderChangeTrigger = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();

  return (
    <Button variant="ghost" size="sm" iconEnd="CaretDownIcon" onClick={onClick}>
      {t("shared.change")}
    </Button>
  );
};

const ProviderCardsTrigger = ({
  items,
  multiSelect,
  onOpen,
  onRemoveValidator,
  tokenSymbol,
}: {
  items: ProviderCardItem[];
  multiSelect: boolean;
  onOpen: () => void;
  onRemoveValidator: (item: EarnValidator) => void;
  tokenSymbol: string;
}) => {
  const { t } = useTranslation();

  return (
    <Stack gap={8}>
      {items.map((item) => {
        const removableValidator =
          multiSelect && items.length > 1 ? item.validator : undefined;
        const getProviderAction = (): ReactNode => {
          if (removableValidator) {
            return (
              <IconButton
                icon="XIcon"
                label={`Remove ${item.name}`}
                onClick={() => onRemoveValidator(removableValidator)}
              />
            );
          }
          if (multiSelect) return null;
          return <ProviderChangeTrigger onClick={onOpen} />;
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
        <Button
          variant="secondary"
          size="sm"
          iconStart="PlusIcon"
          onClick={onOpen}
        >
          {t("shared.manage_validators")}
        </Button>
      ) : null}
    </Stack>
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
    <Card padding={12}>
      <Stack gap={8}>
        <Stack direction="row" align="center" gap={12}>
          <Avatar
            src={item.logo}
            fallback={item.name}
            shape={item.validator ? "square" : "round"}
          />

          <Stack gap={2} grow>
            {/* The name keeps priority: below `sm` the badge shrinks to its icon. */}
            <Stack direction="row" align="center" gap={6}>
              <Text weight="semibold" truncate>
                {item.name}
              </Text>

              {item.preferred ? (
                <Badge tone="accent" icon="PreferredIcon" collapse="belowSm">
                  {t("details.validators_preferred")}
                </Badge>
              ) : null}
            </Stack>

            {meta}
          </Stack>

          {action}
        </Stack>

        {item.website ? (
          <Text variant="caption">
            <ExternalLink
              href={formatProviderWebsiteHref(item.website)}
              newTabLabel={t("shared.opens_in_new_tab")}
            >
              {formatProviderWebsite(item.website)}
            </ExternalLink>
          </Text>
        ) : null}
      </Stack>
    </Card>
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
        stakedBalance: providerDetails?.stakedBalance ?? validator.tvl,
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
  const { locale } = useWidgetPresentation();
  const statusLabel = formatProviderStatus(item.status, t);

  const details = [
    formatCommission(item.commission, locale),
    formatProviderTvl(item.stakedBalance, tokenSymbol, locale),
    statusLabel,
  ].filter((item): item is string => !!item);

  if (!details.length) return null;

  return (
    <Text variant="caption" tone="muted">
      {details.join(" • ")}
    </Text>
  );
};
