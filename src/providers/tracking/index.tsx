import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { SettingsContextType } from "../settings";

const trackPageMap = {
  earn: "Earn",
  positions: "Positions",
  positionDetails: "Position details",
  stakeReview: "Stake review",
  unstakeReview: "Unstake review",
  pendingActionReview: "Pending action review",
  stakingSteps: "Staking steps",
  unstakeSteps: "Unstake steps",
  pendingActionSteps: "Pending action steps",
  stakeCompelete: "Stake complete",
  unstakeCompelete: "Unstake complete",
  pendingActionCompelete: "Pending action complete",
} as const;

export type TrackPageKey = keyof typeof trackPageMap;
export type TrackPageVal = (typeof trackPageMap)[TrackPageKey];

const trackEventMap = {
  tabClicked: "Tab clicked",
  connectWalletClicked: "Connect wallet clicked",
  selectTokenModalOpened: "Select token modal opened",
  tokenSelected: "Token selected",
  selectYieldModalOpened: "Select yield modal opened",
  yieldSelected: "Yield selected",
  selectValidatorModalOpened: "Select validator modal opened",
  selectValidatorViewMoreClicked: "Select validator view more clicked",
  validatorSelected: "Validator selected",
  widgetDisconnectClicked: "Widget disconnect clicked",
  backClicked: "Back clicked",
  helpModalOpened: "Help modal opened",
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
  validatorImported: "Validator imported",
  viewTxClicked: "View transaction clicked",
} as const;

type TrackEventKey = keyof typeof trackEventMap;
export type TrackEventVal = (typeof trackEventMap)[TrackEventKey];

export type Properties = Record<string, any>;

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
}: PropsWithChildren<{ tracking: SettingsContextType["tracking"] }>) => {
  const trackEvent = useCallback<TrackingContextType["trackEvent"]>(
    (event, props) =>
      tracking?.trackEvent(trackEventMap[event], ...(props ? [props] : [])),
    [tracking]
  );

  const trackPageView = useCallback<TrackingContextType["trackPageView"]>(
    (page, props) =>
      tracking?.trackPageView(trackPageMap[page], ...(props ? [props] : [])),
    [tracking]
  );

  const value = useMemo(() => {
    return {
      trackEvent,
      trackPageView,
    };
  }, [trackEvent, trackPageView]);

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
