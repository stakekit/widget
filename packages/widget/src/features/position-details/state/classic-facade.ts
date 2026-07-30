import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { AppToken } from "../../../domain/schema/legacy-models";
import {
  getRewardRateBreakdown,
  type YieldRewardRateDto,
} from "../../../domain/types/reward-rate";
import { isForceMaxAmount } from "../../../domain/types/stake";
import { getYieldActionArg } from "../../../domain/types/yields";
import { formatUsd } from "../../../shared/lib/formatters";
import { defaultFormattedNumber } from "../../../shared/lib/number-format";
import { YieldSummaryKey, yieldSummaryAtom } from "../../yield-summary/state";
import {
  positionDetailsExitActionViewAtom,
  setPositionDetailsExitMaxAmountAtom,
  submitPositionDetailsExitAtom,
} from "./classic-flow-actions";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsPricesAtom,
  positionDetailsWorkflowViewAtom,
} from "./classic-view";
import {
  loadMorePositionDetailsExitValidatorsAtom,
  PositionDetailsExitResourcesKey,
  positionDetailsExitResourcesViewAtom,
  refreshPositionDetailsExitKycAtom,
} from "./exit-resources";
import type { PositionDetailsWorkflowKey } from "./workflow";

const hasCampaignRewardRate = (
  rewardRate: YieldRewardRateDto | null | undefined
) => getRewardRateBreakdown(rewardRate).some((item) => item.key === "campaign");

const getExitResourcesKey = (
  view: Atom.Type<ReturnType<typeof positionDetailsWorkflowViewAtom>>
) =>
  new PositionDetailsExitResourcesKey({
    yieldId: view.integrationData?.id ?? null,
  });

export const positionDetailsClassicViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const workflow = get(positionDetailsWorkflowViewAtom(key));
      const integration = workflow.integrationData;
      const amountArgument = integration
        ? getYieldActionArg(integration, "exit", "amount")
        : null;
      const forceMax = amountArgument
        ? isForceMaxAmount(amountArgument)
        : false;
      const minimum = workflow.minUnstakeAmount.toNumber();
      const exitResources = get(
        positionDetailsExitResourcesViewAtom(getExitResourcesKey(workflow))
      );
      const providers = get(
        yieldSummaryAtom(
          new YieldSummaryKey({
            selectedProviderYieldId: null,
            validators:
              workflow.positionBalances?.type === "validators"
                ? workflow.positionBalances.validators
                : null,
            yield: integration,
          })
        )
      ).providers;
      const personalizedRewardRate =
        workflow.positionBalances &&
        hasCampaignRewardRate(workflow.positionBalances.rewardRate)
          ? workflow.positionBalances.rewardRate
          : null;
      const fallbackRewardRate =
        integration && hasCampaignRewardRate(integration.rewardRate)
          ? integration.rewardRate
          : null;
      const shareToAmountConversions =
        integration && workflow.positionBalancesByType
          ? [...workflow.positionBalancesByType.values()].reduce(
              (conversions, balances) => {
                balances
                  .filter(
                    (balance) =>
                      balance.shareAmount &&
                      balance.amount &&
                      !balance.token.isPoints
                  )
                  .forEach((balance) => {
                    conversions.set(
                      balance.token.symbol,
                      `1 ${balance.token.symbol} = ${defaultFormattedNumber(
                        new BigNumber(balance.shareAmount ?? 0).dividedBy(
                          new BigNumber(balance.amount ?? 0)
                        )
                      )} ${balance.shareToken?.symbol}`
                    );
                  });
                return conversions;
              },
              new Map<AppToken["symbol"], string>()
            )
          : null;
      const canUnstake = Boolean(integration?.status.exit);
      const action = get(positionDetailsExitActionViewAtom(key));

      return {
        apyCompositionRewardRate: personalizedRewardRate ?? fallbackRewardRate,
        apyCompositionShowsUpToCampaign:
          !personalizedRewardRate && Boolean(fallbackRewardRate),
        canChangeUnstakeAmount: workflow.canChangeUnstakeAmount,
        canUnstake,
        hasMoreValidators: exitResources.hasMoreValidators,
        integrationData: integration,
        isLoading:
          AsyncResult.isInitial(workflow.positionBalancesResult) ||
          AsyncResult.isInitial(get(positionDetailsPricesAtom(key))) ||
          AsyncResult.isInitial(workflow.yieldOpportunity) ||
          exitResources.isValidatorsLoading,
        isLoadingMoreValidators: exitResources.isLoadingMoreValidators,
        kycGate: exitResources.kyc.gate,
        kycGateIsChecking: exitResources.kyc.isChecking,
        kycProviderName: exitResources.kyc.providerName,
        personalizedRewardRate,
        positionBalancesByType: workflow.positionBalancesByType,
        providersDetails: providers,
        reducedStakedOrLiquidBalance: workflow.reducedStakedOrLiquidBalance,
        shareToAmountConversions,
        unstakeAmount: workflow.unstakeAmount,
        unstakeAmountError:
          action.submissionError || workflow.unstakeAmountError,
        unstakeDisabled:
          AsyncResult.isInitial(workflow.yieldOpportunity) ||
          !canUnstake ||
          exitResources.kyc.isBlocking,
        unstakeFormattedAmount: workflow.reducedStakedOrLiquidBalance
          ? formatUsd(workflow.reducedStakedOrLiquidBalance.amountUsd)
          : "",
        unstakeIsGreaterOrLessIntegrationLimitError:
          workflow.unstakeIsGreaterOrLessIntegrationLimitError,
        unstakeMaxAmount:
          amountArgument && !forceMax ? (amountArgument.maximum ?? null) : null,
        unstakeMinAmount:
          amountArgument && !forceMax && new BigNumber(minimum).isGreaterThan(0)
            ? minimum
            : null,
        unstakeToken: workflow.unstakeToken,
        validatorsData: exitResources.validators,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsClassicViewAtom"))
);

export const setPositionDetailsExitAmountAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((amount: BigNumber, context) =>
      context.set(dispatchPositionDetailsWorkflowAtom(key), {
        type: "unstake/amount/change",
        data: amount,
      })
    )
);

export const loadMorePositionDetailsValidatorsAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const workflow = context(positionDetailsWorkflowViewAtom(key));
        context.set(
          loadMorePositionDetailsExitValidatorsAtom(
            getExitResourcesKey(workflow)
          ),
          undefined
        );
      },
      { initialValue: undefined }
    )
);

export const refreshPositionDetailsKycAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const workflow = context(positionDetailsWorkflowViewAtom(key));
        context.set(
          refreshPositionDetailsExitKycAtom(getExitResourcesKey(workflow)),
          undefined
        );
      },
      { initialValue: undefined }
    )
);

export { setPositionDetailsExitMaxAmountAtom, submitPositionDetailsExitAtom };
