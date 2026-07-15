import { useAtom } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import { borrowActionFormAtom, currentBorrowDashboardAtom } from "../core";
import { useBorrowConnectedWalletBridge } from "./connected-wallet";

export const useBorrowDashboard = () => {
  useBorrowConnectedWalletBridge();
  const [view, dispatchFormAction] = useAtom(currentBorrowDashboardAtom);
  const [, dispatchActionForm] = useAtom(borrowActionFormAtom);

  if (!view) {
    throw new Error("Borrow dashboard requires a connected borrow wallet");
  }

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
    validation: view.validation,
    walletBalances: view.walletBalances,
  };
};
