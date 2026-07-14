import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../hooks/api/prices-atoms";
import { useActionPreview } from "../../../hooks/api/use-action-preview";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "../../../hooks/use-reward-token-details/get-reward-token-symbols";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import {
  usePendingActionRequest,
  useSetPendingActionRequest,
} from "../../../providers/pending-action-store";
import { defaultFormattedNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import type { PageCta } from "../../components/page-cta";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const usePendingActionReview = () => {
  const setPendingActionRequest = useSetPendingActionRequest();

  const pendingRequest = usePendingActionRequest()!;

  const actionPreviewQuery = useActionPreview({
    command: pendingRequest.requestDto,
    enabled: !!pendingRequest,
    intent: "manage",
  });

  const pendingTxGas = useMemo(() => {
    const total = actionPreviewQuery.data?.transactions.reduce(
      (acc, transaction) => {
        const decoded = getTransactionGasEstimate(transaction);
        return acc.plus(decoded?.amount ?? 0);
      },
      new BigNumber(0)
    );
    return total && !total.isZero() ? total : null;
  }, [actionPreviewQuery.data]);

  const amount = useMemo(
    () => new BigNumber(pendingRequest.requestDto.arguments?.amount ?? 0),
    [pendingRequest.requestDto.arguments?.amount]
  );

  const interactedToken = pendingRequest.interactedToken;
  const integrationData = pendingRequest.integrationData;

  const prices = AsyncResult.getOrElse(
    useAtomValue(
      pricesAtom(
        new PricesKey({
          request: getTokensPricesRequest({
            token: interactedToken,
            yieldDto: integrationData,
          }),
        })
      )
    ),
    () => null
  );

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: pendingTxGas,
    gasFeeToken: pendingRequest.gasFeeToken,
    address: pendingRequest.addresses.address,
    additionalAddresses: pendingRequest.addresses.additionalAddresses,
    isStake: false,
  });

  const { t } = useTranslation();

  const title = useMemo(
    () =>
      t(
        `position_details.pending_action_button.${
          pendingRequest.requestDto.action.toLowerCase() as Lowercase<YieldPendingActionType>
        }` as const
      ),
    [pendingRequest.requestDto.action, t]
  );

  const navigate = useNavigate();

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingTxGas,
        prices,
        yieldDto: integrationData,
      }),
    [integrationData, pendingTxGas, prices]
  );

  const onClick = () => {
    const action = actionPreviewQuery.data;
    if (!action) {
      actionPreviewQuery.refetch();
      return;
    }

    setPendingActionRequest((request) =>
      request ? { ...request, actionDto: action } : null
    );
    navigate("../steps", { relative: "path" });
  };

  const rewardTokenDetailsProps = useMemo(
    () =>
      integrationData.provider
        ? (() => {
            const rewardToken = {
              logoUri: integrationData.provider.logoURI,
              providerName: integrationData.provider.name,
              symbols: getRewardTokenSymbols([integrationData.token]),
              rewardTokens: [integrationData.token],
            } satisfies ComponentProps<
              typeof RewardTokenDetails
            >["rewardToken"];

            return {
              type: "pendingAction",
              pendingAction: pendingRequest.requestDto.action,
              rewardToken,
            } satisfies ComponentProps<typeof RewardTokenDetails>;
          })()
        : null,
    [integrationData, pendingRequest.requestDto.action]
  );

  const onClickRef = useSavedRef(onClick);

  const cta = useMemo<PageCta>(
    () => ({
      label: t("shared.confirm"),
      onClick: () => onClickRef.current(),
      disabled: false,
      isLoading: actionPreviewQuery.isLoading || actionPreviewQuery.isFetching,
    }),
    [actionPreviewQuery.isFetching, actionPreviewQuery.isLoading, onClickRef, t]
  );

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

  const formattedAmount = useMemo(
    () => defaultFormattedNumber(amount),
    [amount]
  );

  return {
    integrationData,
    title,
    amount: formattedAmount,
    fee,
    rewardTokenDetailsProps,
    token: interactedToken,
    metaInfo,
    isGasCheckWarning: !!gasWarningCheck.data,
    gasCheckLoading:
      actionPreviewQuery.isLoading ||
      actionPreviewQuery.isFetching ||
      gasWarningCheck.isLoading,
    cta,
  };
};
