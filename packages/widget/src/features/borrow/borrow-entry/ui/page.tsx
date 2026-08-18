import { useAtomSet } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ContentLoaderSquare } from "../../../../shared/ui/primitives/content-loader";
import { useTrackPage } from "../../../tracking/index";
import { ConnectButton } from "../../../wallet/views";
import { PageCtaButton } from "../../../widget-shell/views";
import { BorrowNotice } from "../../action-feedback/views";
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
import { AmountField, BorrowBalanceLabel } from "./components/amount-field";
import { CollateralSelectModal } from "./components/collateral-select-modal";
import { BorrowFormDetails } from "./components/form-details";
import { MarketSelectModal } from "./components/market-select-modal";

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

      <ConnectButton
        variant={{
          animation: "press",
          color: "primary",
          size: "compact",
        }}
      />
    </>
  ) : (
    <>
      <BorrowNotice title={t("dashboard.borrow.unsupported_network")}>
        {t("dashboard.borrow.unsupported_network_description")}
      </BorrowNotice>

      <PageCtaButton
        cta={{
          disabled: true,
          isLoading: false,
          label: t("dashboard.borrow.unsupported_network"),
          onClick: () => undefined,
        }}
      />
    </>
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
    hasAmounts,
    hasValidationError,
    ltvGreaterThanMax,
    projectedDebtBelowMinimum,
  } = validation;
  const onReviewClick = () => startReview(undefined);
  const integrations = AsyncResult.getOrElse(integrationsResult, () => []);
  const getBorrowAmountValidationText = () => {
    if (borrowAmountGreaterThanAvailable) {
      return t("dashboard.borrow.form.validation.available_liquidity");
    }
    if (projectedDebtBelowMinimum) {
      return t("dashboard.borrow.form.validation.minimum_loan");
    }
    return null;
  };
  const borrowAmountValidationText = getBorrowAmountValidationText();

  const getFormContent = (): ReactNode => {
    if (
      AsyncResult.isInitial(marketsResult) ||
      AsyncResult.isWaiting(marketsResult)
    ) {
      return <ContentLoaderSquare heightPx={340} />;
    }
    if (AsyncResult.isFailure(marketsResult)) {
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
        <AmountField
          amount={borrowAmount}
          balanceLabel={null}
          isInvalid={
            borrowAmountGreaterThanAvailable || projectedDebtBelowMinimum
          }
          label={t("dashboard.borrow.form.borrow")}
          highlight
          onMaxClick={null}
          onAmountChange={setBorrowAmount}
          tokenSelector={
            <MarketSelectModal
              integrations={integrations}
              markets={markets}
              selectedMarketId={selectedMarketId}
            />
          }
          usdValue={borrowAmount.multipliedBy(selectedMarket.loanTokenPriceUsd)}
          validationText={borrowAmountValidationText}
        />

        <AmountField
          amount={collateralAmount}
          balanceLabel={
            <BorrowBalanceLabel
              amount={selectedCollateralBalance?.amount ?? "0"}
              symbol={selectedCollateralToken.token.symbol}
            />
          }
          isInvalid={collateralAmountGreaterThanBalance}
          label={t("dashboard.borrow.form.collateral")}
          onMaxClick={
            canSelectCollateralMaxAmount
              ? () => setCollateralMaxAmount(undefined)
              : null
          }
          onAmountChange={setCollateralAmount}
          tokenSelector={
            <CollateralSelectModal
              collateralTokens={selectedMarket.collateralTokens}
              marketNetwork={selectedMarket.network}
              selectedCollateralTokenId={selectedCollateralTokenId}
            />
          }
          usdValue={collateralAmount.multipliedBy(
            selectedCollateralToken.priceUsd
          )}
          validationText={
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
    if (isActionReady) return t("dashboard.borrow.review");
    if (hasValidationError) return t("dashboard.borrow.fix_errors");
    return t("dashboard.borrow.enter_amounts");
  };
  const ctaLabel = getCtaLabel();

  return (
    <>
      {catalogResetNotice ? (
        <BorrowNotice title={t("dashboard.borrow.form_reset.title")}>
          {t("dashboard.borrow.form_reset.description")}
        </BorrowNotice>
      ) : null}

      {projection.riskStatus === "unavailable" && hasAmounts ? (
        <BorrowNotice title={t("dashboard.borrow.risk_unavailable.title")}>
          {t("dashboard.borrow.risk_unavailable.description")}
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
