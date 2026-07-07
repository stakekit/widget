import { useAtom } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import {
  BorrowDashboardKey,
  borrowActionFormAtom,
  borrowDashboardAtom,
} from "../../borrow";
import { useTokenBalancesScan } from "../../hooks/api/use-token-balances-scan";
import { useBorrowConnectedWalletBridge } from "./connected-wallet";

export const useBorrowDashboard = () => {
  const walletBridge = useBorrowConnectedWalletBridge();
  const wallet = walletBridge.wallet;
  const tokenBalances = useTokenBalancesScan();
  const [view, dispatchFormAction] = useAtom(
    borrowDashboardAtom(
      new BorrowDashboardKey({
        network: wallet.network,
        scopeId: `${wallet.currentAccount.address}:${wallet.network}`,
        tokenBalances: tokenBalances.data ?? [],
        walletAddress: wallet.currentAccount.address,
      })
    )
  );
  const [, dispatchActionForm] = useAtom(borrowActionFormAtom);

  return {
    borrowAmount: view.borrowAmount,
    collateralAmount: view.collateralAmount,
    integrationsResult: view.integrationsResult,
    isActionReady: view.isActionReady,
    markets: view.markets,
    marketsResult: view.marketsResult,
    preparedReviewState: view.preparedReviewState,
    projection: view.projection,
    selectedCollateralBalance: view.selectedCollateralBalance,
    selectedCollateralToken: view.selectedCollateralToken,
    selectedCollateralTokenAddress: view.selectedCollateralTokenAddress,
    selectedIntegration: view.selectedIntegration,
    selectedMarket: view.selectedMarket,
    selectedMarketId: view.selectedMarketId,
    setBorrowAmount: (amount: BigNumber | number | string) =>
      dispatchFormAction({
        amount,
        type: "borrowAmount/set",
      }),
    setCollateralAmount: (amount: BigNumber | number | string) =>
      dispatchFormAction({
        amount,
        type: "collateralAmount/set",
      }),
    setSelectedCollateralTokenAddress: (tokenAddress: string | null) =>
      dispatchFormAction({
        tokenAddress,
        type: "collateralToken/select",
      }),
    setSelectedMarketId: (marketId: string) =>
      dispatchFormAction({
        marketId,
        type: "market/select",
      }),
    stageReviewState: () => {
      if (view.preparedReviewState) {
        dispatchActionForm({
          reviewState: view.preparedReviewState,
          type: "prepareReview",
        });
      }
    },
    tokenBalances,
    validation: view.validation,
    walletBalances: view.walletBalances,
  };
};
