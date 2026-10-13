import { useAtomSet } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ContentLoaderSquare } from "../../../../shared/ui/primitives/content-loader";
import { useTrackPage } from "../../../tracking/index";
import { PageCtaButton } from "../../../widget-shell/views";
import { BorrowNotice } from "../../action-feedback/views";
import { BorrowAmountField } from "../../amount-input/views";
import type { BorrowWalletView } from "../../wallet/index";
import { useBorrowWalletView } from "../../wallet/index";
import type { BorrowEntryView } from "../model/borrow-entry";
import { useBorrowEntryView } from "../react/use-borrow-entry";
import {
  setBorrowAmountAtom,
  setBorrowCollateralAmountAtom,
  setBorrowCollateralMaxAmountAtom,
  startBorrowEntryReviewAtom,
} from "../state/borrow-entry";
import { BorrowBalanceLabel } from "./components/balance-label";
import { CollateralSelectModal } from "./components/collateral-select-modal";
import { BorrowFormDetails } from "./components/form-details";
import { MarketSelectModal } from "./components/market-select-modal";
import {
  BorrowConnectCta,
  BorrowNetworkRecoveryPanel,
} from "./components/network-recovery";

type BorrowEntryWalletView = Exclude<
  BorrowWalletView,
  { readonly status: "ready" }
>;

export const BorrowFormPage = () => {
  useTrackPage("borrow");

  const walletView = useBorrowWalletView();

  return walletView.status === "ready" ? (
    <BorrowConnectedFormPage />
  ) : (
    <BorrowEntryFormPage walletView={walletView} />
  );
};

const BorrowConnectedFormPage = () => {
  const view = useBorrowEntryView();

  return <BorrowFormPanel view={view} />;
};

const BorrowEntryFormPage = ({
  walletView,
}: {
  readonly walletView: BorrowEntryWalletView;
}) => {
  const { t } = useTranslation();

  return walletView.status === "connection-required" ? (
    <>
      <BorrowNotice title={t("dashboard.borrow.connect_title")}>
        {t("dashboard.borrow.connect_description")}
      </BorrowNotice>

      <BorrowConnectCta />
    </>
  ) : (
    <BorrowNetworkRecoveryPanel recovery={walletView.recovery} />
  );
};

const BorrowFormPanel = ({ view }: { readonly view: BorrowEntryView }) => {
  const { t } = useTranslation();
  const setBorrowAmount = useAtomSet(setBorrowAmountAtom);
  const setCollateralAmount = useAtomSet(setBorrowCollateralAmountAtom);
  const setCollateralMaxAmount = useAtomSet(setBorrowCollateralMaxAmountAtom);
  const startReview = useAtomSet(startBorrowEntryReviewAtom);
  const {
    borrowAmount,
    canSelectCollateralMaxAmount,
    catalogResetNotice,
    collateralAmount,
    collateralOptions,
    integrationsResult,
    isActionReady,
    markets,
    marketsResult,
    projection,
    selectedCollateralBalance,
    selectedCollateralToken,
    selectedCollateralTokenId,
    selectedMarket,
    selectedMarketId,
    validation,
    walletBalances,
  } = view;
  const {
    borrowAmountGreaterThanAvailable,
    collateralAmountGreaterThanBalance,
    ltvGreaterThanMax,
    projectedDebtBelowMinimum,
  } = validation;
  const onReviewClick = () => startReview(undefined);
  const integrations = AsyncResult.getOrElse(integrationsResult, () => []);
  const getBorrowAmountWarningText = () => {
    if (borrowAmountGreaterThanAvailable) {
      return t("dashboard.borrow.form.validation.available_liquidity");
    }
    if (projectedDebtBelowMinimum) {
      return t("dashboard.borrow.form.validation.minimum_loan");
    }
    return null;
  };
  const borrowAmountWarningText = getBorrowAmountWarningText();

  const getFormContent = (): ReactNode => {
    if (
      markets.length === 0 &&
      (AsyncResult.isInitial(marketsResult) ||
        AsyncResult.isWaiting(marketsResult))
    ) {
      return <ContentLoaderSquare heightPx={340} />;
    }
    if (markets.length === 0 && AsyncResult.isFailure(marketsResult)) {
      return (
        <BorrowNotice tone="error" title={t("dashboard.borrow.error_title")}>
          {t("dashboard.borrow.error_description")}
        </BorrowNotice>
      );
    }
    if (!selectedMarket || !selectedCollateralToken) {
      return (
        <BorrowNotice title={t("dashboard.borrow.empty_title")}>
          {t("dashboard.borrow.empty_description")}
        </BorrowNotice>
      );
    }

    return (
      <>
        <BorrowAmountField
          accessory={
            <MarketSelectModal
              integrations={integrations}
              markets={markets}
              selectedMarketId={selectedMarketId}
            />
          }
          amount={borrowAmount}
          dataRk="borrow-amount-section"
          label={t("dashboard.borrow.form.borrow")}
          onAmountChange={setBorrowAmount}
          usdValue={borrowAmount.multipliedBy(selectedMarket.loanTokenPriceUsd)}
          warning={borrowAmountWarningText}
        />

        <BorrowAmountField
          accessory={
            <CollateralSelectModal
              collateralOptions={collateralOptions}
              marketNetwork={selectedMarket.network}
              selectedCollateralTokenId={selectedCollateralTokenId}
            />
          }
          amount={collateralAmount}
          balance={
            <BorrowBalanceLabel
              amount={selectedCollateralBalance?.amount ?? "0"}
              symbol={selectedCollateralToken.token.symbol}
            />
          }
          balanceError={collateralAmountGreaterThanBalance}
          dataRk="borrow-amount-section"
          label={t("dashboard.borrow.form.collateral")}
          onAmountChange={setCollateralAmount}
          onMaxClick={
            canSelectCollateralMaxAmount
              ? () => setCollateralMaxAmount(undefined)
              : null
          }
          usdValue={collateralAmount.multipliedBy(
            selectedCollateralToken.priceUsd
          )}
          warning={
            collateralAmountGreaterThanBalance
              ? t("dashboard.borrow.form.validation.wallet_balance")
              : null
          }
        />

        <BorrowFormDetails
          borrowAmount={borrowAmount}
          collateralAmount={collateralAmount}
          ltvGreaterThanMax={ltvGreaterThanMax}
          market={selectedMarket}
          projection={projection}
          walletBalances={walletBalances}
        />
      </>
    );
  };
  const formContent = getFormContent();

  const getCtaLabel = () => {
    if (!isActionReady && !validation.ltvBlocksBorrow) {
      return t("dashboard.borrow.enter_amounts");
    }
    // Collateral without a borrow amount opens a supply-only action.
    if (borrowAmount.isZero()) {
      return t("dashboard.borrow.review_actions.supply");
    }
    return t("dashboard.borrow.review_actions.borrow");
  };
  const ctaLabel = getCtaLabel();

  return (
    <>
      {catalogResetNotice ? (
        <BorrowNotice title={t("dashboard.borrow.form_reset.title")}>
          {t("dashboard.borrow.form_reset.description")}
        </BorrowNotice>
      ) : null}

      {formContent}

      <PageCtaButton
        cta={{
          disabled: !isActionReady,
          isLoading: false,
          label: ctaLabel,
          onClick: onReviewClick,
        }}
      />
    </>
  );
};
