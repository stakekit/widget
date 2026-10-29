import type BigNumber from "bignumber.js";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import {
  isConfidentialYield,
  isUserRevealableBalance,
} from "../../../domain/earn/confidential";
import {
  type ConfidentialHandle,
  getVisibleShares,
} from "../../../domain/earn/models";
import {
  getRewardRateBreakdown,
  type YieldRewardRate,
} from "../../../domain/earn/reward-rate";
import { isForceMaxAmount } from "../../../domain/earn/stake";
import { getYieldActionArg } from "../../../domain/earn/yield";
import { exactDecimal } from "../../../domain/finance/exact";
import { type TokenString, tokenString } from "../../../domain/token/token";
import { walletScopeOwnerKey } from "../../../domain/wallet/wallet-scope";
import {
  InFlightCancelsKey,
  inFlightCancelsResourceAtom,
} from "../../../resources/in-flight-cancels/index";
import { YieldSummaryKey, yieldSummaryAtom } from "../../yield-summary/index";
import { positionDetailsExitActions } from "./actions/exit";
import {
  loadMorePositionDetailsExitValidatorsAtom,
  PositionDetailsExitResourcesKey,
  positionDetailsExitResourcesViewAtom,
  refreshPositionDetailsExitKycAtom,
} from "./exit-resources";
import type { PositionDetailsWorkflowKey } from "./workflow";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsPricesAtom,
  positionDetailsWorkflowViewAtom,
} from "./workflow-view";

const hasCampaignRewardRate = (
  rewardRate: YieldRewardRate | null | undefined
) => getRewardRateBreakdown(rewardRate).some((item) => item.key === "campaign");

export type PositionDetailsShareConversion = {
  readonly rate: BigNumber;
  readonly shareSymbol: string | undefined;
  readonly symbol: string;
};

/** The share of `value` that `part` of `whole` holds. */
const prorate = ({
  part,
  value,
  whole,
}: {
  readonly part: BigNumber;
  readonly value: BigNumber;
  readonly whole: BigNumber;
}) =>
  whole.isZero() ? exactDecimal(0) : value.dividedBy(whole).multipliedBy(part);

const getExitResourcesKey = (
  view: Atom.Type<ReturnType<typeof positionDetailsWorkflowViewAtom>>
) =>
  new PositionDetailsExitResourcesKey({
    yieldId: view.integrationData?.id ?? null,
  });

export const positionDetailsViewAtom = Atom.family(
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
      const minimum = workflow.minUnstakeAmount;
      const exitResources = get(
        positionDetailsExitResourcesViewAtom(getExitResourcesKey(workflow))
      );
      const providers = get(
        yieldSummaryAtom(
          new YieldSummaryKey({
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
                balances.forEach((balance) => {
                  const shareAmount = getVisibleShares(balance)?.amount;
                  if (!shareAmount || balance.token.isPoints) return;
                  conversions.set(tokenString(balance.token), {
                    rate: shareAmount.dividedBy(balance.amount),
                    shareSymbol: balance.shareToken?.symbol,
                    symbol: balance.token.symbol,
                  });
                });
                return conversions;
              },
              new Map<TokenString, PositionDetailsShareConversion>()
            )
          : null;
      const canUnstake = Boolean(integration?.status.exit);
      const positionBalances = [
        ...(workflow.positionBalancesByType?.values() ?? []),
      ].flat();
      const hasHiddenBalances = positionBalances.some(isUserRevealableBalance);
      // Only a confidential vault's pending balances can be mid-cancel. Read
      // locally: a failed lookup, even after an earlier success, just leaves
      // them looking pending.
      const inFlightCancels =
        integration &&
        isConfidentialYield(integration) &&
        positionBalances.some(
          (balance) => balance.type === "entering" || balance.type === "exiting"
        )
          ? get(
              inFlightCancelsResourceAtom.local(
                new InFlightCancelsKey({
                  scope: walletScopeOwnerKey(key.scope),
                  yieldId: integration.id,
                })
              )
            )
          : null;
      const cancellingHandles: ReadonlySet<ConfidentialHandle> =
        inFlightCancels && AsyncResult.isSuccess(inFlightCancels)
          ? inFlightCancels.value
          : new Set();
      const action = get(positionDetailsExitActions.view(key));
      const submittedBelowMinimum =
        action.submissionError &&
        workflow.unstakeAmount.isLessThan(workflow.minUnstakeAmount);

      return {
        hasHiddenBalances,
        hasRevealedBalances:
          Boolean(integration && isConfidentialYield(integration)) &&
          !hasHiddenBalances &&
          positionBalances.some(
            (balance) => !balance.isEncrypted && balance.type !== "withdrawable"
          ),
        apyCompositionRewardRate: personalizedRewardRate ?? fallbackRewardRate,
        cancellingHandles,
        apyCompositionShowsUpToCampaign:
          !personalizedRewardRate && Boolean(fallbackRewardRate),
        canChangeUnstakeAmount: workflow.canChangeUnstakeAmount,
        canUnstake,
        exitBalance: workflow.exitBalance,
        exitReceiveTokenSelection: workflow.exitReceiveTokenSelection,
        hasMoreValidators: exitResources.hasMoreValidators,
        positionSource:
          workflow.positionBalances?.type === "validators"
            ? ("validator" as const)
            : ("yield" as const),
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
        positionLost:
          AsyncResult.isSuccess(workflow.positionBalancesResult) &&
          !workflow.positionBalancesResult.waiting &&
          workflow.positionBalancesResult.value === null,
        positionBalancesByType: workflow.positionBalancesByType,
        providersDetails: providers,
        shareToAmountConversions,
        unstakeAmount: workflow.unstakeAmount,
        unstakeAmountError:
          action.submissionError || workflow.unstakeAmountError,
        unstakeDisabled:
          AsyncResult.isInitial(workflow.yieldOpportunity) ||
          !canUnstake ||
          exitResources.kyc.isBlocking,
        unstakeAmountUsd: workflow.exitBalance
          ? prorate({
              part: workflow.unstakeAmount,
              value: workflow.exitBalance.amountUsd,
              whole: workflow.exitBalance.amount,
            })
          : null,
        // A confidential exit in shares, restated in the underlying it redeems to.
        unstakeAmountUnderlying: workflow.exitBalance?.underlying
          ? {
              amount: prorate({
                part: workflow.unstakeAmount,
                value: workflow.exitBalance.underlying.amount,
                whole: workflow.exitBalance.amount,
              }),
              token: workflow.exitBalance.underlying.token,
            }
          : null,
        unstakeIsGreaterOrLessIntegrationLimitError:
          workflow.unstakeIsGreaterOrLessIntegrationLimitError ||
          submittedBelowMinimum,
        unstakeMaxAmount:
          amountArgument && !forceMax ? (amountArgument.maximum ?? null) : null,
        unstakeMinAmount:
          amountArgument && !forceMax && minimum.isGreaterThan(0)
            ? minimum
            : null,
        unstakeToken: workflow.unstakeToken,
        validatorsData: exitResources.validators,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsViewAtom"))
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

export const setPositionDetailsExitMaxAmountAtom =
  positionDetailsExitActions.setMaxAmount;
export const setPositionDetailsExitReceiveTokenAtom =
  positionDetailsExitActions.setReceiveToken;
export const submitPositionDetailsExitAtom = positionDetailsExitActions.submit;
