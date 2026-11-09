import { Match } from "effect";
import { useTranslation } from "react-i18next";
import { getYieldTypeLabels } from "../../../../../domain/earn/yield";
import { widgetRoutes } from "../../../../../services/navigation/widget-routes";
import {
  amountSeparators,
  fromAmountValue,
  toAmountValue,
} from "../../../../../shared/lib/amount-value";
import {
  formatNumber,
  formatTokenAmount,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { AmountPanel, Skeleton } from "../../../../../ui/index";
import { useWidgetRouteMatch } from "../../../../navigation/index";
import { useWalletScopeRoute } from "../../../../wallet/index";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import { type PageCta, PageCtaButton } from "../../../../widget-shell/views";
import { useNetworkFeeNotes } from "../../../../yield-entry/index";
import {
  TronResourceSelection,
  useConfidentialTokenBalance,
} from "../../../../yield-entry/views";
import { KycGateCard, MetaInfo } from "../../../../yield-summary/views";
import { getPricedFiat } from "../../../model/priced-fiat";
import { PositionDetailsEnterKey } from "../../../state/enter-entry";
import { PositionDetailsLoadFailed } from "../../components/position-details-load-failed";
import { usePositionDetailsEnter } from "../hooks/use-position-details-enter";
import { PositionDetailsEnterTokenSelect } from "./position-details-enter-token-select";

type PositionDetailsEnterState = ReturnType<typeof usePositionDetailsEnter>;

const EnterKycGateSection = ({
  stake,
}: {
  stake: PositionDetailsEnterState;
}) => {
  if (stake.kycGate.state === "pass" && !stake.kycGateIsChecking) return null;

  return (
    <KycGateCard
      gate={stake.kycGate}
      isChecking={stake.kycGateIsChecking}
      onCheckStatus={stake.onKycStatusRefresh}
      providerName={stake.kycProviderName}
    />
  );
};

const PositionDetailsEnterTokenSection = ({
  stake,
}: {
  stake: PositionDetailsEnterState;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const disableResizingInputFontSize = useWidgetConfig(
    "disableResizingInputFontSize"
  );

  const isLoading = stake.status._tag === "Loading";
  const {
    submitted,
    errors: {
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
    },
  } = stake.validation;
  const errorInput =
    (submitted && stakeAmountIsZero) ||
    stakeAmountGreaterThanAvailableAmount ||
    stakeAmountGreaterThanMax ||
    stakeAmountLessThanMin;
  const available = stake.selectedTokenAvailableAmount;
  const min =
    stake.stakeMinAmount === null
      ? null
      : `${t("shared.min")} ${formatTokenAmount(stake.stakeMinAmount, locale, "up")} ${stake.symbol}`;
  const max =
    stake.stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${formatTokenAmount(stake.stakeMaxAmount, locale, "down")} ${stake.symbol}`;
  const minMaxLabel = min && max ? `${min} / ${max}` : (min ?? max);

  const availableBalance = available
    ? {
        short: `${formatTokenAmount(available.amount, locale, "down")} ${available.symbol} ${t("shared.available")}`,
        full: `${formatNumber(available.amount, locale)} ${available.symbol} ${t("shared.available")}`,
      }
    : null;
  const balance = useConfidentialTokenBalance({
    balance: availableBalance,
    hidden: stake.hiddenTokenBalance,
    revealed: stake.revealedTokenBalance,
    revealStatus: stake.revealTokenBalanceStatus,
    onReveal: stake.onRevealTokenBalance,
    onHide: stake.onHideTokenBalance,
    symbol: stake.selectedToken?.symbol ?? "",
  });
  const notes = useNetworkFeeNotes({
    fee: stake.networkFee,
    maxGasReserve: stake.maxGasReserveNote,
  });

  if (isLoading) return <Skeleton shape="rect" height="lg" />;

  // The limits stay the muted helper beside the token; a missed limit or the
  // balance says so under the amount.
  const getError = (): string | null => {
    if (stakeAmountGreaterThanAvailableAmount) {
      return t("shared.insufficient_balance");
    }
    if (stakeAmountGreaterThanMax && stake.stakeMaxAmount !== null) {
      return t("details.amount_error.above_maximum", {
        amount: formatTokenAmount(stake.stakeMaxAmount, locale, "down"),
        symbol: stake.symbol,
      });
    }
    if (stakeAmountLessThanMin && stake.stakeMinAmount !== null) {
      return t("details.amount_error.below_minimum", {
        amount: formatTokenAmount(stake.stakeMinAmount, locale, "up"),
        symbol: stake.symbol,
      });
    }
    return null;
  };
  const error = getError();
  const limitProps = {
    ...(minMaxLabel ? { limits: minMaxLabel } : {}),
    ...(error === null ? {} : { error }),
  };

  // The card names what it holds; the action's button and the call to
  // action name the verb.
  return (
    <AmountPanel
      shrink={!disableResizingInputFontSize}
      label={t("shared.amount")}
      value={toAmountValue(stake.stakeAmount)}
      onValueChange={(next) => stake.onStakeAmountChange(fromAmountValue(next))}
      separators={amountSeparators(locale)}
      invalid={errorInput}
      token={
        stake.selectedToken ? (
          <PositionDetailsEnterTokenSelect
            onSelect={stake.onTokenSelect}
            options={stake.tokenSelection.options}
            selectable={stake.tokenSelection.selectable}
            token={stake.selectedToken}
          />
        ) : null
      }
      {...getPricedFiat({
        amountUsd: stake.priceUsd,
        locale,
        status: stake.priceUsdStatus,
      })}
      testIds={{ root: "position-details-enter-amount" }}
      {...(balance ? { balance } : {})}
      {...limitProps}
      {...(stake.canUseMax
        ? {
            max: {
              label: t("shared.max"),
              onClick: stake.onMaxClick,
              disabled: stake.maxFillsNothing,
            },
          }
        : {})}
      notes={notes}
    />
  );
};

const PositionDetailsEnterFooter = ({
  stake,
}: {
  stake: PositionDetailsEnterState;
}) => (
  <MetaInfo
    isLoading={stake.appLoading || stake.footerIsLoading}
    selectedStake={stake.selectedStake}
    selectedValidators={stake.selectedValidators}
    selectedToken={stake.selectedToken}
    textSize="small"
  />
);

const PositionDetailsEnterExtraArgs = ({
  stake,
}: {
  stake: PositionDetailsEnterState;
}) => (
  <TronResourceSelection
    selectedYield={stake.selectedStake}
    value={stake.tronResource}
    isError={stake.validation.submitted && stake.validation.errors.tronResource}
    onSelect={(value) => stake.onTronResourceSelect(value)}
  />
);

const PositionDetailsEnterPrimaryAction = ({
  ctaVariant,
  stake,
}: {
  readonly ctaVariant: "primary" | "secondary";
  readonly stake: PositionDetailsEnterState;
}) => {
  const { t } = useTranslation();
  const yieldAction = ({
    disabled,
    loading,
  }: {
    readonly disabled: boolean;
    readonly loading: boolean;
  }): PageCta => ({
    disabled,
    isLoading: loading,
    label: stake.selectedStake
      ? getYieldTypeLabels(stake.selectedStake, t).cta
      : "",
    onClick: stake.onPrimaryAction,
    variant: ctaVariant,
  });
  const cta = Match.value(stake.cta).pipe(
    Match.tag("Hidden", () => null),
    Match.tag("AddLedgerAccount", ({ disabled, loading }) => ({
      disabled,
      isLoading: loading,
      label: t("init.ledger_add_account"),
      onClick: stake.onPrimaryAction,
      variant: ctaVariant,
    })),
    Match.tag("ConnectWallet", yieldAction),
    Match.tag("Submit", yieldAction),
    Match.exhaustive
  );

  return <PageCtaButton cta={cta} />;
};

const PositionDetailsEnterActionsContent = ({
  ctaVariant,
  stakeKey,
}: {
  readonly ctaVariant: "primary" | "secondary";
  readonly stakeKey: PositionDetailsEnterKey;
}) => {
  const stake = usePositionDetailsEnter(stakeKey);

  if (stake.status._tag === "Failed") {
    return <PositionDetailsLoadFailed onRetry={stake.onRetry} />;
  }

  return (
    <>
      <PositionDetailsEnterTokenSection stake={stake} />
      <PositionDetailsEnterFooter stake={stake} />
      <EnterKycGateSection stake={stake} />
      <PositionDetailsEnterExtraArgs stake={stake} />
      <PositionDetailsEnterPrimaryAction
        ctaVariant={ctaVariant}
        stake={stake}
      />
    </>
  );
};

/** Entering further needs the position the route names; without one, nothing. */
export const PositionDetailsEnterActions = ({
  ctaVariant,
}: {
  /**
   * `secondary` when another action leads the page, such as a withdrawal
   * that is ready, so entering steps down beside it.
   */
  readonly ctaVariant: "primary" | "secondary";
}) => {
  const walletScope = useWalletScopeRoute();
  const match = useWidgetRouteMatch(widgetRoutes.positionDetails);

  if (!match) return null;

  return (
    <PositionDetailsEnterActionsContent
      ctaVariant={ctaVariant}
      stakeKey={
        new PositionDetailsEnterKey({
          balanceId: match.balanceId,
          integrationId: match.integrationId,
          walletScope,
        })
      }
    />
  );
};
