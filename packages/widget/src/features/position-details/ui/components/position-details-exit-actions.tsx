import { useTranslation } from "react-i18next";
import { getExtendedYieldType } from "../../../../domain/earn/yield";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import { Button, Card, Stack, Text } from "../../../../ui/index";
import { type PageCta, PageCtaButton } from "../../../widget-shell/views";
import { KycGateCard } from "../../../yield-summary/views";
import { usePositionDetails } from "../../react/use-position-details";
import { AmountBlock, ExitInfo } from "./amount-block";
import { ExitReceiveTokenAccessory } from "./exit-receive-token-accessory";
import { ExitReceiveTokenNote } from "./exit-receive-token-note";

export const PositionDetailsExitActions = () => {
  const {
    integrationData: integrationDataValue,
    unstakeToken: unstakeTokenValue,
    providersDetails,
    unstakeMaxAmount: unstakeMaxAmountValue,
    unstakeMinAmount: unstakeMinAmountValue,
    unstakeIsGreaterOrLessIntegrationLimitError,
    unstakeAmountGreaterThanAvailable,
    unstakeAmount,
    unstakeAmountUsd,
    unstakeAmountValue,
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
      <Card variant="outline" padding={16}>
        <Stack direction="row" align="center" justify="between" gap={12}>
          <Stack gap={4}>
            <Text>{t("shared.confidential.decrypt_to_withdraw")}</Text>
            {revealFailed ? (
              <Text tone="danger">
                {t("shared.confidential.reveal_failed")}
              </Text>
            ) : null}
          </Stack>
          <Button size="sm" loading={revealing} onClick={onRevealBalances}>
            {t("shared.confidential.decrypt")}
          </Button>
        </Stack>
      </Card>
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

  const exitCta: PageCta = {
    disabled: unstakeDisabled,
    isLoading: false,
    label: t(
      `position_details.unstake_label.${getExtendedYieldType(integrationDataValue)}`
    ),
    onClick: onUnstakeClick,
  };
  // A confidential exit is typed in its Exit Unit, Shares, so it chooses
  // its Exit Receive Token apart from the amount.
  const confidentialExit = !!exitReceiveTokenSelection?.confidentialExit;
  const receiveTokenAccessory = (
    <ExitReceiveTokenAccessory
      integration={integrationDataValue}
      onSelect={onReceiveTokenSelect}
      positionToken={unstakeTokenValue}
      selection={exitReceiveTokenSelection}
    />
  );
  const getFormattedAmount = () => {
    if (unstakeAmountValue) {
      return t("position_details.underlying_amount", {
        amount: formatTokenAmount(unstakeAmountValue.amount, locale, "down"),
        symbol: unstakeAmountValue.token.symbol,
      });
    }
    return unstakeAmountUsd ? formatUsd(unstakeAmountUsd, locale) : "";
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
        exitMaxAmount={unstakeMaxAmountValue}
        exitMinAmount={unstakeMinAmountValue}
        exitIsGreaterOrLessIntegrationLimitError={
          unstakeIsGreaterOrLessIntegrationLimitError
        }
        exitAmountGreaterThanAvailable={unstakeAmountGreaterThanAvailable}
        variant="exit"
        canExit={canUnstake}
        exitToken={unstakeTokenValue}
        onAmountChange={onUnstakeAmountChange}
        value={unstakeAmount}
        canChangeAmount={canChangeUnstakeAmountValue}
        disabled={unstakeDisabled}
        onClick={onUnstakeClick}
        exitAmountError={unstakeAmountError}
        onMaxClick={onMaxClick}
        label={t(
          `position_details.unstake_label.${getExtendedYieldType(integrationDataValue)}`
        )}
        fiatValue={getFormattedAmount()}
        balance={exitBalance}
        ctaPlacement="footer"
        {...(confidentialExit ? {} : { tokenAccessory: receiveTokenAccessory })}
      />

      {confidentialExit ? (
        <Stack
          testId="position-details-exit-receive-row"
          direction="row"
          align="center"
          justify="between"
          gap={12}
        >
          <Text tone="muted">{t("position_details.receive_token.label")}</Text>
          {receiveTokenAccessory}
        </Stack>
      ) : null}

      <Stack gap={8}>
        <ExitReceiveTokenNote
          integration={integrationDataValue}
          positionToken={unstakeTokenValue}
          selection={exitReceiveTokenSelection}
        />
        {/* The mode note already states confidential timing. */}
        <ExitInfo
          hideWithdrawnTime={!!exitReceiveTokenSelection?.confidentialExit}
          exitToken={unstakeTokenValue}
          validators={providersDetails ?? []}
          yieldDto={integrationDataValue}
        />
      </Stack>

      <PageCtaButton cta={exitCta} />
    </>
  );
};
