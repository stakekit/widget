import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { pressAnimation } from "../../../../../../../shared/ui/primitives/button/styles.css";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import type {
  ActivityFilter,
  ActivityFilterOption,
} from "../../../../../model/filters";
import { filterCount, filterPill, filtersContainer } from "./styles.css";

type Props = {
  options: ActivityFilterOption[];
  selectedFilter: ActivityFilter;
  onSelect: (filter: ActivityFilter) => void;
};

export const ActivityFilters = ({
  options,
  selectedFilter,
  onSelect,
}: Props) => {
  const { t } = useTranslation();

  if (options.length === 0) return null;

  return (
    <Box className={filtersContainer}>
      {options.map(({ filter, count }) => {
        const isSelected = filter === selectedFilter;

        return (
          <Box
            as="button"
            type="button"
            key={filter}
            onClick={() => onSelect(filter)}
            data-state={isSelected ? "selected" : "default"}
            className={clsx([
              pressAnimation,
              filterPill({ state: isSelected ? "active" : "default" }),
            ])}
          >
            <Text
              variant={{
                type: isSelected ? "base" : "regular",
                size: "small",
                weight: "medium",
              }}
            >
              {t(`activity.filters.${filter}`)}
            </Text>

            <Box
              className={filterCount({
                state: isSelected ? "active" : "default",
              })}
            >
              <Text
                variant={{
                  type: isSelected ? "base" : "muted",
                  size: "small",
                  weight: "medium",
                }}
              >
                {count}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
