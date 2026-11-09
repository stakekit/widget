import { useTranslation } from "react-i18next";
import { ChipGroup } from "../../../../../../ui/index";
import type {
  ActivityFilter,
  ActivityFilterOption,
} from "../../../../model/filters";

type Props = {
  readonly options: ReadonlyArray<ActivityFilterOption>;
  readonly selectedFilter: ActivityFilter;
  readonly onSelect: (filter: ActivityFilter) => void;
};

/** One filter is always on: choosing a chip switches to it. */
export const ActivityFilters = ({
  options,
  selectedFilter,
  onSelect,
}: Props) => {
  const { t } = useTranslation();

  if (options.length === 0) return null;

  return (
    <ChipGroup
      label={t("activity.filters.label")}
      options={options.map(({ filter, count }) => ({
        value: filter,
        label: t(`activity.filters.${filter}`),
        count: String(count),
      }))}
      value={[selectedFilter]}
      onValueChange={(next) =>
        onSelect(
          next.find((filter) => filter !== selectedFilter) ?? selectedFilter
        )
      }
    />
  );
};
