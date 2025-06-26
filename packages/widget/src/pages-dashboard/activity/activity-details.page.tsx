import { Box } from "@sk-widget/components/atoms/box";
import { Divider } from "@sk-widget/components/atoms/divider";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { config } from "@sk-widget/config";
import { usePrices } from "@sk-widget/hooks/api/use-prices";
import { useYieldOpportunity } from "@sk-widget/hooks/api/use-yield-opportunity";
import { useBaseToken } from "@sk-widget/hooks/use-base-token";
import { getPositionBalanceByTypeWithPrices } from "@sk-widget/hooks/use-position-balance-by-type";
import { usePositionData } from "@sk-widget/hooks/use-position-data";
import { useActivityComplete } from "@sk-widget/pages/complete/hooks/use-activity-complete.hook";
import { useComplete } from "@sk-widget/pages/complete/hooks/use-complete.hook";
import { CompletePageComponent } from "@sk-widget/pages/complete/pages/common.page";
import { CompleteCommonContextProvider } from "@sk-widget/pages/complete/state";
import { ActionReviewPage } from "@sk-widget/pages/review/pages/action-review.page";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { defaultFormattedNumber } from "@sk-widget/utils";
import {
  ActionStatus,
  ActionTypes,
  type PriceRequestDto,
  type TransactionType,
  type YieldDto,
} from "@stakekit/api-hooks";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PositionBalances } from "./position-balances";

export const ActivityDetailsPage = () => {
  const activityContext = useActivityContext();

  const selectedAction = useSelector(
    activityContext,
    (state) => state.context.selectedAction
  ).extractNullable();

  const selectedYield = useSelector(
    activityContext,
    (state) => state.context.selectedYield
  ).extractNullable();

  if (!selectedYield || !selectedAction) {
    return null;
  }

  if (
    selectedAction.status === ActionStatus.SUCCESS ||
    selectedAction.status === ActionStatus.PROCESSING
  ) {
    return (
      <Box flex={1} px="4">
        <ActivityCompletePage key={selectedAction.id} />

        <Divider />

        <Box marginTop="4">
          <ActivityPosition integrationId={selectedAction.integrationId} />
        </Box>
      </Box>
    );
  }

  if (
    selectedAction.status === ActionStatus.CREATED ||
    selectedAction.status === ActionStatus.WAITING_FOR_NEXT ||
    selectedAction.status === ActionStatus.FAILED
  ) {
    return (
      <Box flex={1} px="4">
        <ActionReviewPage key={selectedAction.id} />

        <Divider />

        <Box marginTop="4">
          <ActivityPosition integrationId={selectedAction.integrationId} />
        </Box>
      </Box>
    );
  }

  return null;
};

const ActivityCompletePage = () => {
  const {
    amount,
    yieldType,
    inputToken,
    metadata,
    network,
    providerDetails,
    selectedAction,
  } = useActivityComplete();

  const { onViewTransactionClick } = useComplete();

  const urls = selectedAction.transactions
    .map((val) => ({ type: val.type, url: val.explorerUrl }))
    .filter((val): val is { type: TransactionType; url: string } => !!val.url);

  return (
    <CompleteCommonContextProvider
      value={{
        urls,
        onViewTransactionClick,
        unstakeMatch: selectedAction.type === ActionTypes.UNSTAKE,
        pendingActionMatch:
          selectedAction.type !== ActionTypes.STAKE &&
          selectedAction.type !== ActionTypes.UNSTAKE,
      }}
    >
      <CompletePageComponent
        yieldType={yieldType}
        providersDetails={providerDetails}
        token={inputToken}
        metadata={metadata}
        network={network}
        amount={amount}
        pendingActionType={selectedAction.type}
      />
    </CompleteCommonContextProvider>
  );
};

const ActivityPosition = ({
  integrationId,
}: {
  integrationId: YieldDto["id"];
}) => {
  const yieldOpportunity = useYieldOpportunity(integrationId);

  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const baseToken = useBaseToken(integrationData);

  const position = usePositionData({ integrationId });

  const positionBalancePrices = usePrices(
    useMemo(
      () =>
        Maybe.fromRecord({
          position: position.data,
          baseToken,
        })
          .map<PriceRequestDto>((val) => ({
            currency: config.currency,
            tokenList: [
              val.baseToken,
              ...[...val.position.balanceData.values()].flatMap((v) =>
                v.balances.map((b) => b.token)
              ),
            ],
          }))
          .extractNullable(),
      [position.data, baseToken]
    )
  );

  const positionBalancesByType = useMemo(
    () =>
      Maybe.fromRecord({
        prices: Maybe.fromNullable(positionBalancePrices.data),
        position: position.data,
        baseToken,
      })
        .map((val) =>
          getPositionBalanceByTypeWithPrices({
            baseToken: val.baseToken,
            prices: val.prices,
            pvd: [...val.position.balanceData.values()].flatMap(
              (bd) => bd.balances
            ),
          })
        )
        .map((val) =>
          [...val.values()].map((b) => ({
            ...b[0],
            amount: defaultFormattedNumber(
              b.reduce(
                (acc, curr) => acc.plus(curr.amount ?? 0),
                new BigNumber(0)
              )
            ),
          }))
        ),
    [positionBalancePrices.data, position.data, baseToken]
  );

  const { t } = useTranslation();

  return Maybe.fromRecord({ integrationData, positionBalancesByType })
    .map((val) => (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="stretch"
        justifyContent="space-between"
        gap="1"
      >
        <Text variant={{ size: "large" }} textAlign="center">
          {t("dashboard.activity_details.your_position")}
        </Text>

        <Box py="3" gap="2" display="flex" flexDirection="column">
          {val.positionBalancesByType.map((yieldBalance) => (
            <PositionBalances
              key={`${yieldBalance.type}-${yieldBalance.amount}`}
              integrationData={val.integrationData}
              yieldBalance={yieldBalance}
            />
          ))}
        </Box>
      </Box>
    ))
    .extractNullable();
};
