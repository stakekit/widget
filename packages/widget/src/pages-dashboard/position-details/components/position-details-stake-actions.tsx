import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { Box } from "../../../components/atoms/box";
import { selectTokenButton } from "../../../components/atoms/button/styles.css";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { Dropdown } from "../../../components/atoms/dropdown";
import { MaxButton } from "../../../components/atoms/max-button";
import { NumberInput } from "../../../components/atoms/number-input";
import { Spinner } from "../../../components/atoms/spinner";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Text } from "../../../components/atoms/typography/text";
import * as AmountToggle from "../../../components/molecules/amount-toggle";
import { KycGateCard } from "../../../components/molecules/kyc-gate-card";
import type { TronResourceType } from "../../../domain/types/tron";
import { getYieldActionArg } from "../../../domain/types/yields";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { MetaInfo } from "../../../pages/components/meta-info";
import { PageCtaButton } from "../../../pages/components/page-cta";
import {
  minMaxContainer,
  priceTxt,
  selectTokenBalance,
  selectTokenSection,
} from "../../../pages/details/earn-page/components/select-token-section/styles.css";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { usePositionDetailsStake } from "../hooks/use-position-details-stake";
import { PositionDetailsActionTabs } from "./position-details-action-tabs";
import {
  positionDetailsActionsHasContent,
  positionDetailsStakeHasContent,
} from "./position-details-actions";
import { container } from "./styles.css";

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

const FixedToken = ({ stake }: { stake: PositionDetailsStakeState }) => {
  const { variant } = useSettings();

  return stake.selectedToken
    .map((token) => {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          borderRadius="2xl"
          px="2"
          py="1"
          gap="2"
          data-testid="select-token"
          className={combineRecipeWithVariant({
            variant,
            rec: selectTokenButton,
          })}
        >
          <TokenIcon token={token} />
          <Text variant={{ weight: "bold" }}>{token.symbol}</Text>
        </Box>
      );
    })
    .extractNullable();
};

const PositionDetailsStakeTokenSection = ({
  stake,
}: {
  stake: PositionDetailsStakeState;
}) => {
  const { t } = useTranslation();
  const { variant } = useSettings();

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
  const min = stake.stakeMinAmount
    .map((value) => `${t("shared.min")} ${value} ${stake.symbol}`)
    .extractNullable();
  const max = stake.stakeMaxAmount
    .map((value) => `${t("shared.max")} ${value} ${stake.symbol}`)
    .extractNullable();
  const minMax = min || max;

  return isLoading ? (
    <Box marginTop="0">
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    <Box
      data-rk="stake-token-section"
      background="stakeSectionBackground"
      marginTop="0"
      py="4"
      px="4"
      borderStyle="solid"
      borderWidth={1}
      className={combineRecipeWithVariant({
        rec: selectTokenSection,
        variant,
        state: submitted && stakeAmountIsZero ? "danger" : "default",
      })}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box minWidth="0" display="flex" flex={1}>
          <NumberInput
            shakeOnInvalid
            isInvalid={errorInput}
            onChange={stake.onStakeAmountChange}
            value={stake.stakeAmount}
          />
        </Box>

        <Box display="flex" justifyContent="center" alignItems="center">
          <FixedToken stake={stake} />
        </Box>
      </Box>

      {minMax ? (
        <Box
          className={combineRecipeWithVariant({
            rec: minMaxContainer,
            variant,
          })}
          data-rk="stake-token-section-min-max"
        >
          <Text
            key="min"
            variant={{ type: stakeAmountLessThanMin ? "danger" : "muted" }}
          >
            {min && max ? `${min} / ${max}` : (min ?? max)}
          </Text>
        </Box>
      ) : null}

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        marginTop="2"
        flexWrap="wrap"
        data-rk="stake-token-section-balance"
        gap="1"
      >
        <Box className={priceTxt} display="flex">
          <Text
            variant={{ type: "muted", weight: "normal" }}
            className={combineRecipeWithVariant({
              rec: selectTokenBalance,
              variant,
            })}
          >
            {stake.formattedPrice}
          </Text>
        </Box>

        <Box
          flexGrow={1}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box display="flex">
            <Text
              variant={{
                weight: "normal",
                type: errorBalance ? "danger" : "muted",
              }}
              data-state={errorBalance ? "error" : "valid"}
              className={combineRecipeWithVariant({
                rec: selectTokenBalance,
                variant,
              })}
            >
              {stake.selectedTokenAvailableAmount
                .map((value) => (
                  <AmountToggle.Root>
                    <AmountToggle.Amount>
                      {({ state }) => (
                        <span>
                          {state === "full"
                            ? value.fullFormattedAmount
                            : value.shortFormattedAmount}
                          &nbsp;{value.symbol}&nbsp;{t("shared.available")}
                        </span>
                      )}
                    </AmountToggle.Amount>
                  </AmountToggle.Root>
                ))
                .extractNullable()}
            </Text>
          </Box>

          {!stake.isStakeTokenSameAsGasToken && (
            <MaxButton onMaxClick={stake.onMaxClick} />
          )}
        </Box>
      </Box>
    </Box>
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

  return stake.selectedStake
    .chainNullable((selectedStake) =>
      getYieldActionArg(selectedStake, "enter", "tronResource")
    )
    .map((tronResources) => {
      const options = (tronResources.options ?? []).map((value) => ({
        label: value,
        value: value as TronResourceType,
      }));
      const selectedOption = stake.tronResource
        .map((value) => ({ value, label: value }))
        .extract();
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
    })
    .extractNullable();
};

export const PositionDetailsStakeActions = () => {
  const stake = usePositionDetailsStake();
  const { positionDetails } = stake;
  const { plain } = useUnstakeOrPendingActionParams();
  const { t } = useTranslation();

  if (positionDetails.isLoading) {
    return (
      <Box
        className={container}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner />
      </Box>
    );
  }

  const canStake = positionDetailsStakeHasContent(positionDetails);
  const canUnstake = positionDetailsActionsHasContent(positionDetails);

  if (!canStake) {
    if (canUnstake) {
      return (
        <Navigate
          replace
          to={`/positions/${plain.integrationId}/${plain.balanceId}/unstake`}
        />
      );
    }

    return (
      <Box
        className={container}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.position_details.no_actions")}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      className={container}
      flex={1}
      display="flex"
      flexDirection="column"
      marginTop="3"
    >
      <Box display="flex" flex={1} flexDirection="column" gap="3">
        <PositionDetailsActionTabs
          canStake={canStake}
          canUnstake={canUnstake}
        />

        <PositionDetailsStakeTokenSection stake={stake} />

        <PositionDetailsStakeFooter stake={stake} />

        <StakeKycGateSection stake={stake} />

        <PositionDetailsStakeExtraArgs stake={stake} />
      </Box>

      <PageCtaButton cta={stake.cta} />
    </Box>
  );
};
