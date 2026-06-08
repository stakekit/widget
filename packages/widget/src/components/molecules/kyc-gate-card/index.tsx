import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KycGate } from "../../../domain/types/kyc";
import { vars } from "../../../styles/theme/contract.css";
import { MaybeWindow } from "../../../utils/maybe-window";
import { Box } from "../../atoms/box";
import { Button } from "../../atoms/button";
import { Arrow } from "../../atoms/icons/arrow";
import { WarningIcon } from "../../atoms/icons/warning";
import { Spinner } from "../../atoms/spinner";
import { Text } from "../../atoms/typography/text";
import {
  cardStyle,
  iconContainerStyle,
  spinnerContainerStyle,
} from "./styles.css";
import { KycVerificationModal } from "./verification-modal";

type KycGateCardProps = {
  readonly gate: KycGate;
  readonly isChecking?: boolean;
  readonly onCheckStatus?: () => void;
  readonly providerName: string | null;
};

type CardState = Exclude<KycGate["state"], "pass"> | "checking";

const translationKeys = {
  checking: {
    title: "details.kyc_gate.checking.title",
    body: "details.kyc_gate.checking.body",
    bodyFallback: "details.kyc_gate.checking.body_fallback",
  },
  pending: {
    title: "details.kyc_gate.pending.title",
    body: "details.kyc_gate.pending.body",
    bodyFallback: "details.kyc_gate.pending.body_fallback",
  },
  rejected: {
    title: "details.kyc_gate.rejected.title",
    body: "details.kyc_gate.rejected.body",
    bodyFallback: "details.kyc_gate.rejected.body_fallback",
    cta: "details.kyc_gate.rejected.cta",
  },
  start_kyc: {
    title: "details.kyc_gate.start_kyc.title",
    body: "details.kyc_gate.start_kyc.body",
    bodyFallback: "details.kyc_gate.start_kyc.body_fallback",
    cta: "details.kyc_gate.start_kyc.cta",
  },
  unknown: {
    title: "details.kyc_gate.unknown.title",
    body: "details.kyc_gate.unknown.body",
    bodyFallback: "details.kyc_gate.unknown.body_fallback",
  },
} as const satisfies Record<
  CardState,
  {
    readonly title: string;
    readonly body: string;
    readonly bodyFallback: string;
    readonly cta?: string;
  }
>;

const getCardState = ({
  gate,
  isChecking,
}: Pick<KycGateCardProps, "gate" | "isChecking">): CardState | null => {
  if (isChecking) return "checking";
  if (gate.state === "pass") return null;

  return gate.state;
};

const getKycUrl = (gate: KycGate) =>
  gate.state === "pass" ? undefined : gate.kycUrl;

export const KycGateCard = ({
  gate,
  isChecking = false,
  onCheckStatus,
  providerName,
}: KycGateCardProps) => {
  const { t } = useTranslation();
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const refreshOnVerificationClose = useRef(false);
  const cardState = getCardState({ gate, isChecking });

  if (!cardState) return null;

  const kycUrl = getKycUrl(gate);
  const copy = translationKeys[cardState];
  const values = { providerName: providerName ?? "" };
  const hasProviderName = !!providerName;
  const bodyKey = hasProviderName ? copy.body : copy.bodyFallback;
  const ctaKey =
    cardState === "start_kyc" || cardState === "rejected"
      ? translationKeys[cardState].cta
      : null;
  const showVerifyButton = !!ctaKey && !!kycUrl;
  const showCheckStatusButton =
    cardState === "pending" || cardState === "unknown";
  const showEmbeddedVerification =
    showVerifyButton && gate.state !== "pass" && gate.iframeAllowed === true;

  const onVerifyClick = () => {
    if (!kycUrl) return;

    if (showEmbeddedVerification) {
      refreshOnVerificationClose.current = true;
      setVerificationModalOpen(true);
      return;
    }

    MaybeWindow.ifJust((w) => {
      w.open(kycUrl, "_blank", "noopener,noreferrer");
    });
  };

  const onVerificationModalOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      refreshOnVerificationClose.current = true;
      setVerificationModalOpen(true);
      return;
    }

    if (refreshOnVerificationClose.current) {
      refreshOnVerificationClose.current = false;
      onCheckStatus?.();
    }

    setVerificationModalOpen(false);
  };

  return (
    <>
      <Box
        className={cardStyle({ state: cardState })}
        data-testid={`kyc-gate-card-${cardState}`}
      >
        <Box
          display="flex"
          alignItems="center"
          gap="4"
          flexDirection={cardState === "checking" ? "row" : "column"}
        >
          <Box flex={1} width="full">
            <Box marginBottom="2" display="flex" alignItems="center" gap="1">
              <Text variant={{ weight: "semibold" }}>{t(copy.title)}</Text>

              {cardState === "checking" ? (
                <Box className={spinnerContainerStyle}>
                  <Spinner variant={{ size: "small" }} />
                </Box>
              ) : (
                <Box className={iconContainerStyle({ state: cardState })}>
                  <WarningIcon />
                </Box>
              )}
            </Box>

            <Text variant={{ weight: "normal" }}>{t(bodyKey, values)}</Text>

            <Box marginTop="3" display="flex" gap="2" flexWrap="wrap">
              {showVerifyButton && (
                <Button
                  onClick={onVerifyClick}
                  variant={{ size: "small", color: "primary" }}
                  data-testid="kyc-gate-verify"
                >
                  <Text variant={{ type: "inverted" }}>{t(ctaKey)}</Text>
                </Button>
              )}

              {showCheckStatusButton && (
                <Button
                  onClick={onCheckStatus}
                  variant={{ size: "small", color: "primary" }}
                  data-testid="kyc-gate-check-status"
                >
                  <Text variant={{ type: "inverted" }}>
                    {t("details.kyc_gate.check_status")}
                  </Text>
                  <Arrow direction="right" color={vars.color.background} />
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {showEmbeddedVerification && (
        <KycVerificationModal
          isOpen={verificationModalOpen}
          onOpenChange={onVerificationModalOpenChange}
          url={kycUrl}
        />
      )}
    </>
  );
};
