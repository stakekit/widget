import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KycGate } from "../../../../../domain/earn/kyc";
import { Button, Notice, type Tone } from "../../../../../ui/index";
import { KycVerificationModal } from "./verification-modal";

type KycGateCardProps = {
  readonly gate: KycGate;
  readonly isChecking?: boolean;
  readonly onCheckStatus?: () => void;
  readonly providerName: string | null;
};

type CardState = Exclude<KycGate["state"], "pass"> | "checking";

const cardTones = {
  checking: "neutral",
  start_kyc: "warning",
  pending: "warning",
  rejected: "danger",
  unknown: "neutral",
} as const satisfies Record<CardState, Tone>;

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

    window.open(kycUrl, "_blank", "noopener,noreferrer");
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
      <Notice
        tone={cardTones[cardState]}
        title={t(copy.title)}
        busy={cardState === "checking"}
        testId={`kyc-gate-card-${cardState}`}
        action={
          showVerifyButton || showCheckStatusButton ? (
            <>
              {showVerifyButton && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onVerifyClick}
                  testId="kyc-gate-verify"
                >
                  {t(ctaKey)}
                </Button>
              )}

              {showCheckStatusButton && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onCheckStatus}
                  testId="kyc-gate-check-status"
                >
                  {t("details.kyc_gate.check_status")}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {t(bodyKey, values)}
      </Notice>

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
