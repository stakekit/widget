import type { ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import type { PropsWithChildren } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SelectModalProps } from "../../atoms/select-modal";
import { SelectModal } from "../../atoms/select-modal";
import type { GroupedItem } from "./select-validator-list";
import { SelectValidatorList } from "./select-validator-list";

type SelectValidatorProps = PropsWithChildren<
  Pick<SelectModalProps, "onClose" | "onOpen" | "state" | "trigger"> & {
    selectedValidators: Set<ValidatorDto["address"]>;
    onItemClick: (item: ValidatorDto) => void;
    onViewMoreClick?: () => void;
    validators: YieldDto["validators"];
    selectedStake: YieldDto;
    multiSelect: boolean;
  } & (
      | { onSearch: (value: string) => void; searchValue: string }
      | {
          onSearch?: never;
          searchValue?: never;
        }
    )
>;

export const SelectValidator = ({
  state,
  onClose,
  onOpen,
  trigger,
  selectedValidators,
  onItemClick,
  onViewMoreClick,
  validators,
  multiSelect,
  selectedStake,
  children,
  ...rest
}: SelectValidatorProps) => {
  const { t } = useTranslation();

  const [_viewMore, setViewMore] = useState(false);

  const _onViewMoreClick = () => {
    onViewMoreClick?.();
    setViewMore(true);
  };

  const viewMore = !!multiSelect || _viewMore;

  const data = useMemo<{
    tableData: ValidatorDto[];
    groupedItems: GroupedItem[];
    groupCounts: number[];
    canViewMore: boolean;
  }>(() => {
    if (!validators.length) {
      return {
        tableData: [],
        groupedItems: [],
        groupCounts: [],
        canViewMore: false,
      };
    }

    const groupedItems = validators.reduce<{
      preferred: GroupedItem;
      other: GroupedItem;
    }>(
      (acc, val) => {
        if (val.preferred) {
          acc.preferred.items.push(val);
        } else if (viewMore) {
          acc.other.items.push(val);
        }

        return acc;
      },
      {
        preferred: {
          items: [] as ValidatorDto[],
          label: t("details.validators_preferred"),
        },
        other: {
          items: [] as ValidatorDto[],
          label: t("details.validators_other"),
        },
      }
    );

    // If we do not have preferred validators, show all other
    if (!groupedItems.preferred.items.length && validators.length) {
      return {
        tableData: validators,
        groupedItems: [
          {
            items: validators,
            label: t("details.validators_other"),
          },
        ],
        groupCounts: [validators.length],
        canViewMore: false,
      };
    }

    const canViewMore =
      !viewMore && groupedItems.preferred.items.length !== validators.length;

    const groupedItemsValues = Object.values(groupedItems);

    return {
      tableData: groupedItemsValues.flatMap((val) => val.items),
      groupedItems: [
        ...groupedItemsValues.filter((val) => !!val.items.length),
        ...(canViewMore ? [{ items: [], label: "view_more" }] : []),
      ],
      groupCounts: [
        ...groupedItemsValues
          .filter((val) => !!val.items.length)
          .map((val) => val.items.length),
        ...(canViewMore ? [1] : []),
      ],
      canViewMore,
    };
  }, [validators, t, viewMore]);

  const searchProps = rest.onSearch
    ? {
        onSearch: rest.onSearch,
        searchValue: rest.searchValue,
      }
    : {};

  return (
    <SelectModal
      title={t("details.validator_search_title", {
        count: multiSelect ? 2 : 1,
      })}
      onClose={onClose}
      onOpen={onOpen}
      trigger={trigger}
      state={state}
      {...searchProps}
    >
      <SelectValidatorList
        {...data}
        selectedValidators={selectedValidators}
        multiSelect={multiSelect}
        onItemClick={onItemClick}
        onViewMoreClick={_onViewMoreClick}
        selectedStake={selectedStake}
      />

      {children}
    </SelectModal>
  );
};
