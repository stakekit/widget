import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { getPositionTotalAmount } from "../../../../../../domain/types/positions";
import { getRewardRateFormatted } from "../../../../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../../../../shared/lib/number-format";
import { useProvidersDetails } from "../../../../../earn/react/use-provider-details";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../../../earn/resources/yields";
import type { PositionItem } from "../../../../resources/positions";

export const usePositionListItem = (item: PositionItem) => {
  const yieldOpportunityResult = useAtomValue(
    yieldOpportunityAtom(
      new YieldOpportunityKey({ yieldId: item.integrationId })
    )
  );
  const integrationData = yieldOpportunityResult.pipe(
    AsyncResult.value,
    Option.getOrNull
  );

  const providersDetails = useProvidersDetails({
    integrationData,
    validators: item.type === "validators" ? item.validators : [],
    selectedProviderYieldId: null,
  });

  const rewardRateAverage = useMemo(
    () =>
      providersDetails && integrationData
        ? getRewardRateFormatted({
            rewardRate: providersDetails
              .reduce(
                (acc, val) => acc.plus(new BigNumber(val.rewardRate || 0)),
                new BigNumber(0)
              )
              .dividedBy(providersDetails.length)
              .toNumber(),
          })
        : null,
    [integrationData, providersDetails]
  );

  const inactiveValidator = useMemo(
    () =>
      providersDetails?.find((provider) => provider.status !== "active")
        ?.status as Exclude<
        NonNullable<NonNullable<typeof providersDetails>[number]["status"]>,
        "active"
      > | null,
    [providersDetails]
  );

  const tokenToDisplay = item.token;
  const baseToken = integrationData?.token ?? null;

  const amounts = useMemo(
    () =>
      baseToken
        ? getPositionTotalAmount(item.balancesWithAmount, baseToken)
        : null,
    [item.balancesWithAmount, baseToken]
  );

  const totalAmount = amounts?.amount ?? null;

  const totalAmountUsd = useMemo(() => amounts?.amountUsd ?? null, [amounts]);

  const totalAmountFormatted = useMemo(
    () => (totalAmount ? defaultFormattedNumber(totalAmount) : null),
    [totalAmount]
  );

  const totalAmountPriceFormatted = useMemo(
    () =>
      totalAmountUsd?.isGreaterThan(0)
        ? defaultFormattedNumber(totalAmountUsd)
        : null,
    [totalAmountUsd]
  );

  return {
    integrationData,
    providersDetails,
    rewardRateAverage,
    inactiveValidator,
    totalAmount,
    totalAmountUsd,
    totalAmountFormatted,
    totalAmountPriceFormatted,
    baseToken,
    tokenToDisplay,
  };
};
