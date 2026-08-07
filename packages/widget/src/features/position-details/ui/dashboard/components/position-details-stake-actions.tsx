import { Match } from "effect";
import { useTranslation } from "react-i18next";
import {
  getYieldActionArg,
  getYieldTypeLabels,
} from "../../../../../domain/types/yields";
import * as AmountToggle from "../../../../../shared/ui/components/amount-toggle";
import { AmountTokenSection } from "../../../../../shared/ui/components/amount-token-section";
import { Dropdown } from "../../../../../shared/ui/components/dropdown";
import { SelectedToken } from "../../../../../shared/ui/components/selected-token";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { KycGateCard, MetaInfo } from "../../../../earn/components";
import {
  type PageCta,
  PageCtaButton,
} from "../../../../widget-shell/components";
import { usePositionDetailsStake } from "../hooks/use-position-details-stake";

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
      : `${t("shared.min")} ${stake.stakeMinAmount} ${stake.symbol}`;
  const max =
    stake.stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${stake.stakeMaxAmount} ${stake.symbol}`;
  const minMaxLabel = min && max ? `${min} / ${max}` : (min ?? max);

  if (isLoading) {
    return (
      <Box marginTop="0">
        <ContentLoaderSquare heightPx={112.5} />
      </Box>
    );
  }

  return (
    <AmountTokenSection
      value={stake.stakeAmount}
      onChange={stake.onStakeAmountChange}
      isInvalid={errorInput}
      accessory={
        stake.selectedToken ? (
          <SelectedToken token={stake.selectedToken} />
        ) : null
      }
      formattedPrice={stake.formattedPrice}
      balanceError={errorBalance}
      balance={
        available ? (
          <AmountToggle.Root>
            <AmountToggle.Amount>
              {({ state }) => (
                <span>
                  {state === "full"
                    ? available.fullFormattedAmount
                    : available.shortFormattedAmount}
                  &nbsp;{available.symbol}&nbsp;
                  {t("shared.available")}
                </span>
              )}
            </AmountToggle.Amount>
          </AmountToggle.Root>
        ) : null
      }
      onMaxClick={stake.isStakeTokenSameAsGasToken ? null : stake.onMaxClick}
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
}) => {
  const { t } = useTranslation();

  const tronResources = stake.selectedStake
    ? getYieldActionArg(stake.selectedStake, "enter", "tronResource")
    : null;
  if (!tronResources) return null;

  const options = (tronResources.options ?? []).map((value) => ({
    label: value,
    value,
  }));
  const selectedOption = stake.tronResource
    ? { value: stake.tronResource, label: stake.tronResource }
    : undefined;
  const isError =
    stake.validation.submitted && stake.validation.errors.tronResource;

  return (
    <Box>
      <Box my="2">
        <Text
          variant={{
            type: isError ? "danger" : "regular",
          }}
        >
          {t("details.tron_resources.label")}
        </Text>
      </Box>

      <Dropdown
        options={options}
        onSelect={(value) => stake.onTronResourceSelect(value)}
        selectedOption={selectedOption}
        placeholder={t("details.tron_resources.placeholder")}
        isError={isError}
      />
    </Box>
  );
};

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
