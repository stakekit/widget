import type { YieldPendingActionType } from "../../domain/action/pending-action";
import type { MarketId } from "../../domain/borrow/ids";
import type { YieldCategory } from "../../domain/earn/contract";
import type {
  ValidatorAddress,
  YieldId,
} from "../../domain/identity/identifiers";

export const trackPageMap = {
  earn: "Earn",
  borrow: "Borrow",
  borrowReview: "Borrow review",
  borrowSteps: "Borrow steps",
  borrowComplete: "Borrow complete",
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

export const trackEventMap = {
  tabClicked: "Tab clicked",
  connectWalletClicked: "Connect wallet clicked",
  addLedgerAccountClicked: "Add ledger account clicked",
  selectTokenModalOpened: "Select token modal opened",
  exitReceiveTokenModalOpened: "Exit receive token modal opened",
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
  borrowPageMaxClicked: "Borrow page max clicked",
  borrowMarketSelected: "Borrow market selected",
  borrowCollateralSelected: "Borrow collateral selected",
  borrowReviewClicked: "Borrow review clicked",
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

export type TrackEventKey = keyof typeof trackEventMap;

type TabTrackingProperties = {
  readonly selected:
    | "activity"
    | "borrow"
    | "earn"
    | "manage"
    | "positions"
    | YieldCategory;
};

type ValidatorTrackingProperties = {
  readonly validatorAddress: ValidatorAddress;
  readonly validatorName: string | undefined;
};

type BorrowCollateralTrackingProperties = {
  readonly collateralTokenAddress: string | undefined;
  readonly collateralTokenSymbol: string | undefined;
  readonly marketId: MarketId | undefined;
};

type TransactionTrackingProperties = {
  readonly network: string;
  readonly txId: string;
  /** The Yield ID, or a borrow integration ID. */
  readonly yieldId: string;
};

/**
 * What each event sends to the host alongside its name; `undefined` for
 * events sent without properties.
 */
type TrackEventProperties = {
  readonly tabClicked: TabTrackingProperties;
  readonly connectWalletClicked: undefined;
  readonly addLedgerAccountClicked: undefined;
  readonly selectTokenModalOpened: undefined;
  readonly exitReceiveTokenModalOpened: undefined;
  readonly tokenSelected: { readonly token: string };
  readonly selectYieldModalOpened: undefined;
  readonly yieldSelected: undefined;
  readonly selectValidatorModalOpened: undefined;
  readonly selectValidatorModalClosed: undefined;
  readonly selectValidatorViewMoreClicked: undefined;
  readonly validatorSelected: ValidatorTrackingProperties;
  readonly validatorRemoved: ValidatorTrackingProperties;
  readonly widgetDisconnectClicked: undefined;
  readonly backClicked: undefined;
  readonly helpModalOpened: { readonly modal: string };
  readonly termsModalOpened: undefined;
  readonly termsModalAccepted: undefined;
  readonly termsModalDeclined: undefined;
  readonly earnPageMaxClicked: undefined;
  readonly borrowPageMaxClicked: BorrowCollateralTrackingProperties & {
    readonly field: "collateral";
  };
  readonly borrowMarketSelected: { readonly marketId: MarketId };
  readonly borrowCollateralSelected: BorrowCollateralTrackingProperties;
  readonly borrowReviewClicked: BorrowCollateralTrackingProperties & {
    readonly borrowAmount: string;
    readonly collateralAmount: string;
  };
  readonly connectedWallet: {
    readonly address: string;
    readonly network: string;
  };
  readonly importValidatorModalOpened: undefined;
  readonly chainModalOpened: undefined;
  readonly accountModalOpened: undefined;
  readonly termsClicked: undefined;
  readonly txSigned: TransactionTrackingProperties;
  readonly txSubmitted: TransactionTrackingProperties;
  readonly txNotConfirmed: undefined;
  readonly positionDetailsPageMaxClicked: {
    readonly yieldId: YieldId | undefined;
  };
  readonly unstakeClicked: {
    readonly amount?: string;
    readonly yieldId: YieldId;
  };
  readonly pendingActionClicked: {
    readonly type: YieldPendingActionType;
    readonly yieldId: YieldId;
  };
  readonly validatorsSubmitted: {
    readonly type: YieldPendingActionType;
    readonly validators: ReadonlyArray<ValidatorAddress>;
    readonly yieldId: YieldId;
  };
  readonly validatorImported: undefined;
  readonly viewTxClicked: undefined;
  readonly actionStepsCancelled: undefined;
  readonly initYield: undefined;
  readonly initToken: undefined;
};

/**
 * What each page view sends alongside its name; a union with `undefined`
 * marks properties some views of the page omit.
 */
type TrackPageProperties = {
  readonly [Page in Exclude<TrackPageKey, "positionDetails">]: undefined;
} & {
  readonly positionDetails: { readonly yield: string | undefined } | undefined;
};

/** Properties of any tracked event. */
export type AnyTrackEventProperties = Exclude<
  TrackEventProperties[TrackEventKey],
  undefined
>;

/** Properties of any tracked page view. */
export type AnyTrackPageProperties = Exclude<
  TrackPageProperties[TrackPageKey],
  undefined
>;

type TrackingArgs<Properties> = undefined extends Properties
  ? [properties?: Exclude<Properties, undefined>]
  : [properties: Properties];

/** `trackEvent` arguments after the event name: its properties, if any. */
export type TrackEventArgs<Event extends TrackEventKey> = TrackingArgs<
  TrackEventProperties[Event]
>;

/** `trackPageView` arguments after the page name: its properties, if any. */
export type TrackPageArgs<Page extends TrackPageKey> = TrackingArgs<
  TrackPageProperties[Page]
>;
