import type { ReactElement } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  EarnValidator,
  EarnValidatorKey,
  EarnYieldWithProvider,
} from "../../../../../domain/earn/models";
import { getRewardTypeFormatted } from "../../../../../shared/lib/formatters";
import { formatRewardRatePercent } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { SelectSheet } from "../../../../../ui/index";
import { getValidatorMetaInfo } from "./meta-info";

/** A button under the validator list, such as confirming several choices. */
type SelectValidatorAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
};

type SelectValidatorProps = {
  /** Opens the sheet; it must forward its ref and props. */
  readonly trigger?: ReactElement;
  /** Open state; leave unset with `trigger` to let the trigger open it. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly isLoading?: boolean;
  readonly selectedValidators: ReadonlySet<EarnValidatorKey>;
  readonly onItemClick: (item: EarnValidator) => void;
  readonly onViewMoreClick?: () => void;
  readonly onLoadMore?: () => void;
  readonly hasMore?: boolean;
  readonly isLoadingMore?: boolean;
  readonly validators: ReadonlyArray<EarnValidator>;
  readonly selectedStake: EarnYieldWithProvider;
  /** Takes several validators: choosing toggles one and the sheet stays open. */
  readonly multiSelect: boolean;
  /** Confirms several choices, under the list. */
  readonly confirm?: SelectValidatorAction;
  readonly search?: {
    readonly value: string;
    readonly onValueChange: (value: string) => void;
  };
};

/**
 * The validators of a yield to choose from, preferred ones first: one closes
 * the sheet, several stay open until confirmed. Validators past the preferred
 * ones show after "View all", then load page by page.
 */
export const SelectValidator = ({
  trigger,
  open,
  onOpenChange,
  isLoading = false,
  selectedValidators,
  onItemClick,
  onViewMoreClick,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  validators,
  multiSelect,
  selectedStake,
  confirm,
  search,
}: SelectValidatorProps) => {
  const { t } = useTranslation();
  const [viewMore, setViewMore] = useState(false);

  const hasRequestedMore = viewMore || !!search?.value;
  const showsOthers = multiSelect || hasRequestedMore;
  const preferred = validators.filter((validator) => validator.preferred);
  const others = validators.filter((validator) => !validator.preferred);
  const preferredGroup = {
    key: "preferred",
    label: t("details.validators_preferred"),
    items: preferred,
  };
  const otherGroup = (items: ReadonlyArray<EarnValidator>) => ({
    key: "other",
    label: t("details.validators_other"),
    items,
  });
  // Without preferred validators every validator shows.
  const groups = preferred.length
    ? [preferredGroup, ...(showsOthers ? [otherGroup(others)] : [])]
    : [otherGroup(validators)];
  const hiddenOthers =
    !showsOthers && preferred.length > 0 && others.length > 0;
  const selection = () => {
    if (multiSelect) {
      return { multiple: { selectedIds: new Set<string>(selectedValidators) } };
    }
    const [selectedKey] = selectedValidators;
    return selectedKey === undefined ? {} : { selectedId: selectedKey };
  };
  const canViewMore = !hasRequestedMore && (hasMore || hiddenOthers);
  const loadsPages = hasRequestedMore && onLoadMore !== undefined;

  const options = useValidatorOptions(selectedStake);
  const byKey = new Map<string, EarnValidator>(
    validators.map((validator) => [validator.key, validator])
  );

  const viewAll = {
    label: t("details.validators_view_all"),
    onClick: () => {
      onViewMoreClick?.();
      onLoadMore?.();
      setViewMore(true);
    },
  };
  const footer = [
    ...(canViewMore ? [viewAll] : []),
    ...(confirm ? [{ ...confirm, variant: "primary" as const }] : []),
  ];

  return (
    <SelectSheet
      title={t("details.validator_search_title", {
        count: multiSelect ? 2 : 1,
      })}
      closeLabel={t("shared.close")}
      listLabel={t("details.validator_search_title", {
        count: multiSelect ? 2 : 1,
      })}
      {...(trigger === undefined ? {} : { trigger })}
      {...(open === undefined ? {} : { open })}
      onOpenChange={(next) => {
        if (!next) setViewMore(false);
        onOpenChange?.(next);
      }}
      groups={groups
        .filter((group) => group.items.length)
        .map((group) => ({
          key: group.key,
          label: group.label,
          options: group.items.map(options),
        }))}
      {...selection()}
      onSelect={(key) => {
        const validator = byKey.get(key);
        if (validator) onItemClick(validator);
      }}
      {...(search === undefined
        ? {}
        : {
            search: {
              value: search.value,
              onValueChange: search.onValueChange,
              label: t("positions.search_for_validators"),
              placeholder: t("positions.search_for_validators"),
              clearLabel: t("shared.clear_search"),
            },
          })}
      {...(canViewMore && !validators.length
        ? {}
        : {
            empty: {
              title: search?.value.trim().length
                ? t("details.validators_no_results")
                : t("details.validators_empty"),
            },
          })}
      {...(footer.length ? { footer } : {})}
      loading={isLoading}
      loadingLabel={t("details.validators_loading")}
      hasMore={loadsPages && hasMore}
      loadingMore={loadsPages && isLoadingMore}
      {...(loadsPages ? { onEndReached: onLoadMore } : {})}
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
        search: "select-modal__search-input",
      }}
    />
  );
};

/** Maps each validator onto a select sheet option. */
const useValidatorOptions = (selectedStake: EarnYieldWithProvider) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  return (validator: EarnValidator) => {
    const rateType = getRewardTypeFormatted(validator.rewardRate?.rateType);
    const meta = getValidatorMetaInfo(
      {
        address: validator.address,
        commission: validator.commission,
        stakedBalance: validator.tvl,
        votingPower: validator.votingPower,
        nominatorCount: validator.nominatorCount,
        subnetName: validator.subnet?.name,
        marketCap: validator.subnet?.tvl,
        tokenSymbol: validator.subnet?.tokenSymbol,
        rewardRate: undefined,
        rewardType: undefined,
        stakedBalanceToken: selectedStake.token,
        website: undefined,
      },
      t,
      locale
    );
    const details = Object.values(meta).flatMap((entry) => {
      if (!entry) return [];
      const detail = { label: entry.title, value: entry.val };
      if (entry.copyValue === undefined) return [detail];
      return [
        {
          ...detail,
          copy: {
            value: entry.copyValue,
            label: t("position_details.copy_address", { label: entry.title }),
            copiedLabel: t("position_details.copied"),
          },
        },
      ];
    });
    const getStatusBadge = () => {
      if (validator.status === "jailed") {
        return {
          label: t("details.validators_jailed"),
          tone: "warning",
        } as const;
      }
      if (validator.status && validator.status !== "active") {
        return {
          label: t("details.validators_inactive"),
          tone: "warning",
        } as const;
      }
      return null;
    };
    const statusBadge = getStatusBadge();
    const name = validator.name ?? validator.address;

    return {
      id: validator.key,
      testId: validator.key,
      title: name,
      value: formatRewardRatePercent(validator.rewardRate?.total, locale),
      ...(rateType ? { subvalue: rateType } : {}),
      logo: {
        name,
        shape: "square" as const,
        ...(validator.logoURI ? { src: validator.logoURI } : {}),
      },
      // Preferred validators sit under their own "Preferred" header, so
      // only a status worth noticing marks a row.
      badges: statusBadge ? [statusBadge] : [],
      details,
    };
  };
};
