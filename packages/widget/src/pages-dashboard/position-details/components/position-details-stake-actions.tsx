import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { Box } from "../../../components/atoms/box";
import { Spinner } from "../../../components/atoms/spinner";
import { Text } from "../../../components/atoms/typography/text";
import { KycGateCard } from "../../../components/molecules/kyc-gate-card";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { PageCtaButton } from "../../../pages/components/page-cta";
import { ExtraArgsSelection } from "../../../pages/details/earn-page/components/extra-args-selection";
import { Footer } from "../../../pages/details/earn-page/components/footer";
import { SelectTokenSection } from "../../../pages/details/earn-page/components/select-token-section";
import { useEarnPageContext } from "../../../pages/details/earn-page/state/earn-page-context";
import { useEarnPageDispatch } from "../../../pages/details/earn-page/state/earn-page-state-context";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { PositionDetailsActionTabs } from "./position-details-action-tabs";
import {
  positionDetailsActionsHasContent,
  positionDetailsStakeHasContent,
} from "./position-details-actions";
import { container } from "./styles.css";

const StakeKycGateSection = () => {
  const { kycGate, kycGateIsChecking, kycProviderName, onKycStatusRefresh } =
    useEarnPageContext();

  if (kycGate.state === "pass" && !kycGateIsChecking) return null;

  return (
    <Box marginTop="3">
      <KycGateCard
        gate={kycGate}
        isChecking={kycGateIsChecking}
        onCheckStatus={onKycStatusRefresh}
        providerName={kycProviderName}
      />
    </Box>
  );
};

const PositionDetailsStakeStateInitializer = ({
  positionDetails,
}: {
  positionDetails: ReturnType<typeof usePositionDetails>;
}) => {
  const dispatch = useEarnPageDispatch();
  const positionYield = positionDetails.integrationData.extractNullable();

  useEffect(() => {
    if (!positionYield) {
      return;
    }

    dispatch({ type: "positionDetails/stake/initialize", data: positionYield });
  }, [dispatch, positionYield]);

  return null;
};

export const PositionDetailsStakeActions = () => {
  const positionDetails = usePositionDetails();
  const { plain } = useUnstakeOrPendingActionParams();
  const { cta } = useEarnPageContext();
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

        <PositionDetailsStakeStateInitializer
          positionDetails={positionDetails}
        />

        <SelectTokenSection canSelectToken={false} sectionMarginTop="0" />

        <Footer textSize="small" />

        <StakeKycGateSection />

        <ExtraArgsSelection />
      </Box>

      <PageCtaButton cta={cta} />
    </Box>
  );
};
