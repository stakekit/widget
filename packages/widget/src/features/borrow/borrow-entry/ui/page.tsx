import { useAtomSet } from "@effect/atom-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  formatNumber,
  formatTokenAmount,
} from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Notice } from "../../../../ui/index";
import { useTrackPage } from "../../../tracking/index";
import { PageCtaButton } from "../../../widget-shell/views";
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
import { CollateralSelectSheet } from "./components/collateral-select-sheet";
import { BorrowFormDetails } from "./components/form-details";
import { MarketSelectSheet } from "./components/market-select-sheet";
import {
  BorrowConnectCta,
  BorrowNetworkRecoveryPanel,
} from "./components/network-recovery";
import { BorrowFormSkeleton } from "./components/skeletons";

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

  if (walletView.status === "connecting") {
    return <BorrowFormSkeleton />;
  }

  if (walletView.status === "connection-required") {
    return (
      <>
        <Notice title={t("dashboard.borrow.connect_title")}>
          {t("dashboard.borrow.connect_description")}
        </Notice>

        <BorrowConnectCta />
      </>
    );
  }

  return <BorrowNetworkRecoveryPanel recovery={walletView.recovery} />;
};

const BorrowFormPanel = ({ view }: { readonly view: BorrowEntryView }) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
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
    integrations,
    isActionReady,
    markets,
    marketsView,
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
    projectedDebtBelowMinimum,
    riskBlock,
    riskWarning,
  } = validation;
  const onReviewClick = () => startReview(undefined);
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
    if (marketsView._tag === "Loading") {
      return <BorrowFormSkeleton />;
    }
    if (marketsView._tag === "Failed") {
      return (
        <Notice tone="danger" title={t("dashboard.borrow.error_title")}>
          {t("dashboard.borrow.error_description")}
        </Notice>
      );
    }
    if (!selectedMarket || !selectedCollateralToken) {
      return (
        <Notice title={t("dashboard.borrow.empty_title")}>
          {t("dashboard.borrow.empty_description")}
        </Notice>
      );
    }

    const collateralBalance = selectedCollateralBalance?.amount ?? "0";
    const collateralSymbol = selectedCollateralToken.token.symbol;

    return (
      <>
        <BorrowAmountField
          testId="borrow-amount-section"
          accessory={
            <MarketSelectSheet
              integrations={integrations}
              markets={markets}
              selectedMarketId={selectedMarketId}
            />
          }
          amount={borrowAmount}
          label={t("dashboard.borrow.form.borrow")}
          onAmountChange={setBorrowAmount}
          usdValue={borrowAmount.multipliedBy(selectedMarket.loanTokenPriceUsd)}
          warning={borrowAmountWarningText}
        />

        <BorrowAmountField
          accessory={
            <CollateralSelectSheet
              collateralOptions={collateralOptions}
              marketNetwork={selectedMarket.network}
              selectedCollateralTokenId={selectedCollateralTokenId}
            />
          }
          amount={collateralAmount}
          balance={{
            short: t("dashboard.borrow.form.wallet_balance", {
              amount: formatTokenAmount(collateralBalance, locale, "down"),
              symbol: collateralSymbol,
            }),
            full: t("dashboard.borrow.form.wallet_balance", {
              amount: formatNumber(collateralBalance, locale),
              symbol: collateralSymbol,
            }),
          }}
          balanceError={collateralAmountGreaterThanBalance}
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
          market={selectedMarket}
          projection={projection}
          riskBlock={riskBlock}
          riskWarning={riskWarning}
          walletBalances={walletBalances}
        />
      </>
    );
  };
  const formContent = getFormContent();

  const getCtaLabel = () => {
    if (!isActionReady && riskBlock === null) {
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
        <Notice title={t("dashboard.borrow.form_reset.title")}>
          {t("dashboard.borrow.form_reset.description")}
        </Notice>
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
