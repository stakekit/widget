import { Match } from "effect";
import { useTranslation } from "react-i18next";
import { getYieldTypeLabels } from "../../../../../domain/earn/yield";
import {
  formatNumber,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import * as AmountToggle from "../../../../../shared/ui/components/amount-toggle";
import { AmountTokenSection } from "../../../../../shared/ui/components/amount-token-section";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { type PageCta, PageCtaButton } from "../../../../widget-shell/views";
import {
  ConfidentialTokenBalance,
  TronResourceSelection,
} from "../../../../yield-entry/views";
import { KycGateCard, MetaInfo } from "../../../../yield-summary/views";
import { usePositionDetailsStake } from "../hooks/use-position-details-stake";
import { PositionDetailsStakeTokenSelect } from "./position-details-stake-token-select";

type PositionDetailsStakeState = ReturnType<typeof usePositionDetailsStake>;

const StakeKycGateSection = ({
  stake,
}: {
  stake: PositionDetailsStakeState;
}) => {
  if (stake.kycGate.state === "pass" && !stake.kycGateIsChecking) return null;

  return (
    <Box marginTop="3">
      <KycGateCard
        gate={stake.kycGate}
        isChecking={stake.kycGateIsChecking}
        onCheckStatus={stake.onKycStatusRefresh}
        providerName={stake.kycProviderName}
      />
    </Box>
  );
};

const PositionDetailsStakeTokenSection = ({
  stake,
}: {
  stake: PositionDetailsStakeState;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

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
  const errorBalance = stakeAmountGreaterThanAvailableAmount;
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

  if (isLoading) {
    return (
      <Box marginTop="0">
        <ContentLoaderSquare heightPx={112.5} />
      </Box>
    );
  }

  const availableContent = available ? (
    <AmountToggle.Root>
      <AmountToggle.Amount>
        {({ state }) => (
          <span>
            {state === "full"
              ? formatNumber(available.amount, locale)
              : formatTokenAmount(available.amount, locale, "down")}
            &nbsp;{available.symbol}&nbsp;
            {t("shared.available")}
          </span>
        )}
      </AmountToggle.Amount>
    </AmountToggle.Root>
  ) : null;

  return (
    <AmountTokenSection
      value={stake.stakeAmount}
      onChange={stake.onStakeAmountChange}
      isInvalid={errorInput}
      accessory={
        stake.selectedToken ? (
          <PositionDetailsStakeTokenSelect
            onSelect={stake.onTokenSelect}
            options={stake.tokenSelection.options}
            selectable={stake.tokenSelection.selectable}
            token={stake.selectedToken}
          />
        ) : null
      }
      formattedPrice={stake.priceUsd ? formatUsd(stake.priceUsd, locale) : ""}
      balanceError={errorBalance}
      balance={
        stake.hiddenTokenBalance || availableContent ? (
          <ConfidentialTokenBalance
            hidden={stake.hiddenTokenBalance}
            revealed={stake.revealedTokenBalance}
            revealStatus={stake.revealTokenBalanceStatus}
            onReveal={stake.onRevealTokenBalance}
            onHide={stake.onHideTokenBalance}
            symbol={stake.selectedToken?.symbol ?? ""}
          >
            {availableContent}
          </ConfidentialTokenBalance>
        ) : null
      }
      onMaxClick={stake.canUseMax ? stake.onMaxClick : null}
      minMaxLabel={minMaxLabel}
      minMaxError={stakeAmountLessThanMin}
      state={submitted && stakeAmountIsZero ? "danger" : "default"}
      marginTop="0"
    />
  );
};

const PositionDetailsStakeFooter = ({
  stake,
}: {
  stake: PositionDetailsStakeState;
}) => (
  <MetaInfo
    isLoading={stake.appLoading || stake.footerIsLoading}
    selectedStake={stake.selectedStake}
    selectedValidators={stake.selectedValidators}
    selectedToken={stake.selectedToken}
    textSize="small"
  />
);

const PositionDetailsStakeExtraArgs = ({
  stake,
}: {
  stake: PositionDetailsStakeState;
}) => (
  <TronResourceSelection
    selectedYield={stake.selectedStake}
    value={stake.tronResource}
    isError={stake.validation.submitted && stake.validation.errors.tronResource}
    onSelect={(value) => stake.onTronResourceSelect(value)}
  />
);

const PositionDetailsStakePrimaryAction = ({
  stake,
}: {
  readonly stake: PositionDetailsStakeState;
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

export const PositionDetailsStakeActions = () => {
  const stake = usePositionDetailsStake();

  return (
    <>
      <PositionDetailsStakeTokenSection stake={stake} />
      <PositionDetailsStakeFooter stake={stake} />
      <StakeKycGateSection stake={stake} />
      <PositionDetailsStakeExtraArgs stake={stake} />
      <PositionDetailsStakePrimaryAction stake={stake} />
    </>
  );
};
