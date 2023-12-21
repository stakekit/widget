import { Box, SelectModal } from "../../../../../components";
import { useTranslation } from "react-i18next";
import { ValidatorDto } from "@stakekit/api-hooks";
import { useMemo, useState } from "react";
import { useDetailsContext } from "../../state/details-context";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { Maybe } from "purify-ts";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { SelectValidatorTrigger } from "./select-validator-trigger";
import { GroupedItem, SelectValidatorList } from "./select-validator-list";

export const SelectValidatorSection = () => {
  const { t } = useTranslation();

  const {
    appLoading,
    tokenBalancesScanLoading,
    yieldOpportunityLoading,
    stakeTokenAvailableAmountLoading,
    multiYieldsLoading,
    onValidatorSelect,
    onValidatorRemove,
    selectedValidators,
    selectedStake,
    defaultTokensIsLoading,
  } = useDetailsContext();

  const isLoading =
    appLoading ||
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    stakeTokenAvailableAmountLoading;

  const [viewMore, setViewMore] = useState(false);

  const data = useMemo<
    Maybe<{
      tableData: ValidatorDto[];
      groupedItems: GroupedItem[];
      groupCounts: number[];
      canViewMore: boolean;
    }>
  >(
    () =>
      selectedStake.map((ss) => {
        if (!ss.validators.length) {
          return {
            tableData: [],
            groupedItems: [],
            groupCounts: [],
            canViewMore: false,
          };
        }

        const groupedItems = ss.validators.reduce<{
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
        if (!groupedItems.preferred.items.length && ss.validators.length) {
          return {
            tableData: ss.validators,
            groupedItems: [
              { items: ss.validators, label: t("details.validators_other") },
            ],
            groupCounts: [ss.validators.length],
            canViewMore: false,
          };
        }

        const canViewMore =
          !viewMore &&
          groupedItems.preferred.items.length !== ss.validators.length;

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
      }),
    [selectedStake, t, viewMore]
  );

  const trackEvent = useTrackEvent();

  const onViewMoreClick = () => {
    trackEvent("selectValidatorViewMoreClicked");
    setViewMore(true);
  };

  const onItemClick = (item: ValidatorDto) => {
    trackEvent("validatorSelected", {
      validatorName: item.name,
      validatorAddress: item.address,
    });
    onValidatorSelect(item);
  };

  const onRemoveValidator = (item: ValidatorDto) => {
    trackEvent("validatorRemoved", {
      validatorName: item.name,
      validatorAddress: item.address,
    });
    onValidatorRemove(item);
  };

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : (
    Maybe.fromRecord({ selectedStake })
      .filter((val) => !!val.selectedStake.validators.length)
      .map(({ selectedStake }) => {
        const selectedValidatorsArr = [...selectedValidators.values()];

        const supportsMultiVal =
          !!selectedStake.args.enter.args?.validatorAddresses?.required;

        return (
          <SelectModal
            title={t("details.validator_search_title")}
            onClose={() => setViewMore(false)}
            onOpen={() => trackEvent("selectValidatorModalOpened")}
            trigger={
              <SelectValidatorTrigger
                onRemoveValidator={onRemoveValidator}
                selectedValidatorsArr={selectedValidatorsArr}
                supportsMultiVal={supportsMultiVal}
              />
            }
          >
            {data
              .map((val) => (
                <SelectValidatorList
                  {...val}
                  selectedValidators={selectedValidators}
                  supportsMultiVal={supportsMultiVal}
                  onItemClick={onItemClick}
                  onViewMoreClick={onViewMoreClick}
                  selectedStake={selectedStake}
                />
              ))
              .extract()}
          </SelectModal>
        );
      })
      .extractNullable()
  );
};
