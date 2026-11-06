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
import {
  TronResourceSelection,
  useConfidentialTokenBalance,
} from "../../../../yield-entry/views";
import { KycGateCard, MetaInfo } from "../../../../yield-summary/views";
import { getPricedFiat } from "../../../model/priced-fiat";
import { PositionDetailsEnterKey } from "../../../state/enter-entry";
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

  const isLoading = stake.appLoading;
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

  if (isLoading) return <Skeleton shape="rect" height="lg" />;

  // The limits stay beside the token, red when missed; a balance error
  // shows under the amount beside them.
  const limitProps = {
    ...(minMaxLabel
      ? { limits: minMaxLabel, limitsMissed: stakeAmountLessThanMin }
      : {}),
    ...(stakeAmountGreaterThanAvailableAmount
      ? { error: t("shared.insufficient_balance") }
      : {}),
  };

  return (
    <AmountPanel
      shrink={!disableResizingInputFontSize}
      label={
        stake.selectedStake
          ? getYieldTypeLabels(stake.selectedStake, t).cta
          : t("shared.balance")
      }
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
        ? { max: { label: t("shared.max"), onClick: stake.onMaxClick } }
        : {})}
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
  stake,
}: {
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
  });
  const cta = Match.value(stake.cta).pipe(
    Match.tag("Hidden", () => null),
    Match.tag("AddLedgerAccount", ({ disabled, loading }) => ({
      disabled,
      isLoading: loading,
      label: t("init.ledger_add_account"),
      onClick: stake.onPrimaryAction,
    })),
    Match.tag("ConnectWallet", yieldAction),
    Match.tag("Submit", yieldAction),
    Match.exhaustive
  );

  return <PageCtaButton cta={cta} />;
};

const PositionDetailsEnterActionsContent = ({
  stakeKey,
}: {
  stakeKey: PositionDetailsEnterKey;
}) => {
  const stake = usePositionDetailsEnter(stakeKey);

  return (
    <>
      <PositionDetailsEnterTokenSection stake={stake} />
      <PositionDetailsEnterFooter stake={stake} />
      <EnterKycGateSection stake={stake} />
      <PositionDetailsEnterExtraArgs stake={stake} />
      <PositionDetailsEnterPrimaryAction stake={stake} />
    </>
  );
};

/** Entering further needs the position the route names; without one, nothing. */
export const PositionDetailsEnterActions = () => {
  const walletScope = useWalletScopeRoute();
  const match = useWidgetRouteMatch(widgetRoutes.positionDetails);

  if (!match) return null;

  return (
    <PositionDetailsEnterActionsContent
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
