import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import {
  capitalizeFirstLetters,
  dateOlderThen7Days,
} from "@sk-widget/utils/formatters";
import {
  type ActionDto,
  ActionStatus,
  type YieldDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type ActionYieldDto = {
  actionData: ActionDto;
  yieldData: YieldDto;
};

type ListItemContainerType = "claim" | "pending" | "actionRequired" | undefined;

const BADGE_BG_MAP: { [key in ActionStatus]: ListItemContainerType } = {
  SUCCESS: "claim",
  FAILED: "actionRequired",
  CREATED: "pending",
  WAITING_FOR_NEXT: "pending",
  CANCELED: "actionRequired",
  PROCESSING: "claim",
};

export const useActionListItem = (action: ActionYieldDto) => {
  const { t } = useTranslation();

  const integrationData = useMemo(
    () => Maybe.fromNullable(action.yieldData),
    [action.yieldData]
  );

  const providersDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: Maybe.of(action.actionData.validatorAddresses ?? []),
  });

  const actionType = useMemo(
    () =>
      Maybe.of(action.actionData.type)
        .map((t) => t.replaceAll("_", " "))
        .map(capitalizeFirstLetters)
        .extract(),
    [action]
  );

  const actionOlderThan7Days = useMemo(
    () =>
      Maybe.of(action.actionData.createdAt)
        .map(dateOlderThen7Days)
        .orDefault(false),
    [action]
  );

  const badgeLabel = useMemo(
    () =>
      Maybe.fromNullable(action.actionData.status)
        .map((status) => {
          if (status === ActionStatus.WAITING_FOR_NEXT) {
            return actionOlderThan7Days
              ? ActionStatus.FAILED
              : t("activity.review.in_progress");
          }
          return status;
        })
        .map((status) => status.replaceAll("_", " "))
        .map(capitalizeFirstLetters)
        .extract(),
    [action, t, actionOlderThan7Days]
  );

  const badgeColor = useMemo(
    () =>
      Maybe.fromNullable(action.actionData.status)
        .map((status) => {
          if (
            status === ActionStatus.WAITING_FOR_NEXT &&
            actionOlderThan7Days
          ) {
            return ActionStatus.FAILED;
          }
          return status;
        })
        .map((status) => BADGE_BG_MAP[status])
        .extract(),
    [action, actionOlderThan7Days]
  );

  const amount = useMemo(
    () =>
      Maybe.fromNullable(action.actionData.amount)
        .map(BigNumber)
        .map((a) => a.toString(10)),
    [action]
  );

  return {
    integrationData,
    providersDetails,
    actionType,
    amount,
    badgeLabel,
    badgeColor,
  };
};
