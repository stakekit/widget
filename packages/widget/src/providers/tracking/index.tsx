import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { SettingsContextType } from "../settings/types";
import { useTrackingProps } from "./use-tracking-props";

const trackPageMap = {
  earn: "Earn",
  positions: "Positions",
  activity: "Activity",
  positionDetails: "Position details",
  stakeReview: "Stake review",
  unstakeReview: "Unstake review",
  pendingActionReview: "Pending action review",
  stakingSteps: "Staking steps",
  unstakeSteps: "Unstake steps",
  activitySteps: "Activity steps",
  pendingActionSteps: "Pending action steps",
  stakeComplete: "Stake complete",
  activityComplete: "Activity complete",
  unstakeComplete: "Unstake complete",
  pendingActionCompelete: "Pending action complete",
} as const;

export type TrackPageKey = keyof typeof trackPageMap;
export type TrackPageVal = (typeof trackPageMap)[TrackPageKey];

const trackEventMap = {
  tabClicked: "Tab clicked",
  connectWalletClicked: "Connect wallet clicked",
  addLedgerAccountClicked: "Add ledger account clicked",
  selectTokenModalOpened: "Select token modal opened",
  tokenSelected: "Token selected",
  selectYieldModalOpened: "Select yield modal opened",
  yieldSelected: "Yield selected",
  selectValidatorModalOpened: "Select validator modal opened",
  selectValidatorModalClosed: "Select validator modal closed",
  selectValidatorViewMoreClicked: "Select validator view more clicked",
  validatorSelected: "Validator selected",
  validatorRemoved: "Validator removed",
  widgetDisconnectClicked: "Widget disconnect clicked",
  backClicked: "Back clicked",
  helpModalOpened: "Help modal opened",
  termsModalOpened: "Terms modal opened",
  termsModalAccepted: "Terms modal accepted",
  termsModalDeclined: "Terms modal declined",
  earnPageMaxClicked: "Earn page max clicked",
  connectedWallet: "Connected wallet",
  importValidatorModalOpened: "Import validator modal opened",
  chainModalOpened: "Chain modal opened",
  accountModalOpened: "Account modal opened",
  termsClicked: "Terms clicked",
  txSigned: "Transaction signed",
  txSubmitted: "Transaction submitted",
  txNotConfirmed: "Transaction not confirmed",
  positionDetailsPageMaxClicked: "Position details page max clicked",
  unstakeClicked: "Unstake clicked",
  pendingActionClicked: "Pending action clicked",
  validatorsSubmitted: "Validators submitted",
  validatorImported: "Validator imported",
  viewTxClicked: "View transaction clicked",
  actionStepsCancelled: "Action steps cancelled",
  initYield: "system/initYield",
  initToken: "system/initToken",
} as const;

type TrackEventKey = keyof typeof trackEventMap;
export type TrackEventVal = (typeof trackEventMap)[TrackEventKey];

export type Properties = Record<string, unknown>;

type TrackingContextType = {
  trackEvent: (event: TrackEventKey, properties?: Properties) => void;
  trackPageView: (page: TrackPageKey, properties?: Properties) => void;
};

export const TrackingContext = createContext<TrackingContextType | undefined>(
  undefined
);

export const TrackingContextProvider = ({
  children,
  tracking,
  variantTracking,
}: PropsWithChildren<{
  tracking: SettingsContextType["tracking"];
  variantTracking?: SettingsContextType["tracking"];
}>) => {
  const trackEvent = useCallback<TrackingContextType["trackEvent"]>(
    (event, props) => {
      tracking?.trackEvent?.(trackEventMap[event], ...(props ? [props] : []));
      variantTracking?.trackEvent?.(
        trackEventMap[event],
        ...(props ? [props] : [])
      );
    },
    [tracking, variantTracking]
  );

  const trackPageView = useCallback<TrackingContextType["trackPageView"]>(
    (page, props) => {
      tracking?.trackPageView?.(trackPageMap[page], ...(props ? [props] : []));
      variantTracking?.trackPageView?.(
        trackPageMap[page],
        ...(props ? [props] : [])
      );
    },
    [tracking, variantTracking]
  );

  const value = useMemo(
    () => ({ trackEvent, trackPageView }),
    [trackEvent, trackPageView]
  );

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const context = useContext(TrackingContext);

  if (context === undefined) {
    throw new Error("useTracking must be used within a TrackingContext");
  }

  return context;
};

export const TrackingContextProviderWithProps = ({
  children,
}: PropsWithChildren) => (
  <TrackingContextProvider {...useTrackingProps()}>
    {children}
  </TrackingContextProvider>
);
