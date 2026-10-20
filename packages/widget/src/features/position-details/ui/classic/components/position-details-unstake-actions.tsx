import { useTranslation } from "react-i18next";
import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { formatUsd } from "../../../../../shared/lib/number-format";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { type PageCta, PageCtaButton } from "../../../../widget-shell/views";
import { KycGateCard } from "../../../../yield-summary/views";
import { usePositionDetails } from "../hooks/use-position-details";
import { AmountBlock, UnstakeInfo } from "./amount-block";
import { ExitReceiveTokenAccessory } from "./exit-receive-token-accessory";
import { ExitReceiveTokenNote } from "./exit-receive-token-note";

export const PositionDetailsUnstakeActions = () => {
  const {
    integrationData: integrationDataValue,
    unstakeToken: unstakeTokenValue,
    providersDetails,
    unstakeMaxAmount: unstakeMaxAmountValue,
    unstakeMinAmount: unstakeMinAmountValue,
    unstakeIsGreaterOrLessIntegrationLimitError,
    unstakeAmount,
    unstakeAmountUsd,
    exitBalance,
    canChangeUnstakeAmount: canChangeUnstakeAmountValue,
    canUnstake,
    unstakeDisabled,
    onUnstakeClick,
    unstakeAmountError,
    onMaxClick,
    kycGate,
    kycGateIsChecking,
    kycProviderName,
    onKycStatusRefresh,
    exitReceiveTokenSelection,
    onReceiveTokenSelect,
    onUnstakeAmountChange,
    hasHiddenBalances,
    onRevealBalances,
    revealFailed,
    revealing,
  } = usePositionDetails();

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  // Withdrawing encrypts an amount, so reveal first.
  if (hasHiddenBalances && integrationDataValue) {
    return (
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        gap="3"
        px="4"
        py="4"
        borderRadius="2xl"
        borderColor="backgroundMuted"
        borderWidth={1}
        borderStyle="solid"
      >
        <Box display="flex" flexDirection="column" gap="1">
          <Text variant={{ weight: "normal" }}>
            {t("shared.confidential.decrypt_to_withdraw")}
          </Text>
          {revealFailed ? (
            <Text variant={{ type: "danger", weight: "normal" }}>
              {t("shared.confidential.reveal_failed")}
            </Text>
          ) : null}
        </Box>
        <Button
          variant={{ size: "small", color: "smallButtonLight" }}
          disabled={revealing}
          isLoading={revealing}
          onClick={onRevealBalances}
        >
          <Text>{t("shared.confidential.decrypt")}</Text>
        </Button>
      </Box>
    );
  }

  if (
    !exitBalance ||
    canChangeUnstakeAmountValue === null ||
    !unstakeTokenValue ||
    !integrationDataValue
  ) {
    return null;
  }

  const unstakeCta: PageCta = {
    disabled: unstakeDisabled,
    isLoading: false,
    label: t(
      `position_details.unstake_label.${getExtendedYieldType(integrationDataValue)}`
    ),
    onClick: onUnstakeClick,
  };

  return (
    <>
      {(kycGate.state !== "pass" || kycGateIsChecking) && (
        <KycGateCard
          gate={kycGate}
          isChecking={kycGateIsChecking}
          onCheckStatus={onKycStatusRefresh}
          providerName={kycProviderName}
        />
      )}

      <AmountBlock
        unstakeMaxAmount={unstakeMaxAmountValue}
        unstakeMinAmount={unstakeMinAmountValue}
        unstakeIsGreaterOrLessIntegrationLimitError={
          unstakeIsGreaterOrLessIntegrationLimitError
        }
        variant="unstake"
        canUnstake={canUnstake}
        unstakeToken={unstakeTokenValue}
        onAmountChange={onUnstakeAmountChange}
        value={unstakeAmount}
        canChangeAmount={canChangeUnstakeAmountValue}
        disabled={unstakeDisabled}
        onClick={onUnstakeClick}
        unstakeAmountError={unstakeAmountError}
        onMaxClick={onMaxClick}
        label={t(
          `position_details.unstake_label.${getExtendedYieldType(integrationDataValue)}`
        )}
        formattedAmount={
          unstakeAmountUsd ? formatUsd(unstakeAmountUsd, locale) : ""
        }
        balance={exitBalance}
        yieldDto={integrationDataValue}
        validators={providersDetails ?? []}
        showUnstakeInfo={false}
        ctaPlacement="footer"
        tokenAccessory={
          <ExitReceiveTokenAccessory
            integration={integrationDataValue}
            onSelect={onReceiveTokenSelect}
            positionToken={unstakeTokenValue}
            selection={exitReceiveTokenSelection}
          />
        }
      />

      <Box display="flex" flexDirection="column" gap="2">
        <ExitReceiveTokenNote
          integration={integrationDataValue}
          positionToken={unstakeTokenValue}
          selection={exitReceiveTokenSelection}
        />
        {/* The mode note already states confidential timing. */}
        {exitReceiveTokenSelection?.confidentialExit ? null : (
          <UnstakeInfo
            unstakeToken={unstakeTokenValue}
            validators={providersDetails ?? []}
            yieldDto={integrationDataValue}
          />
        )}
      </Box>

      <PageCtaButton cta={unstakeCta} />
    </>
  );
};
