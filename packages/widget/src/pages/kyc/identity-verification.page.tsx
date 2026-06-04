import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../components/atoms/box";
import { ShieldCheckIcon } from "../../components/atoms/icons/shield-check";
import { Heading } from "../../components/atoms/typography/heading";
import { Text } from "../../components/atoms/typography/text";
import { KycStatus, type YieldKycMetadata } from "../../domain/types/kyc";
import { useRegisterFooterButton } from "../components/footer-outlet/context";

const copyByStatus = {
  [KycStatus.NotStarted]: {
    title: "kyc.not_started.title",
    description: "kyc.not_started.description",
    cta: "kyc.not_started.cta",
  },
  [KycStatus.Pending]: {
    title: "kyc.pending.title",
    description: "kyc.pending.description",
    cta: "kyc.pending.cta",
  },
  [KycStatus.Rejected]: {
    title: "kyc.rejected.title",
    description: "kyc.rejected.description",
    cta: "kyc.rejected.cta",
  },
} as const;

type IdentityVerificationScreenProps = {
  status: KycStatus;
  kyc?: YieldKycMetadata;
  // false when no verification url resolved
  canVerify: boolean;
  onVerify: () => void;
};

export const IdentityVerificationScreen = ({
  status,
  kyc,
  canVerify,
  onVerify,
}: IdentityVerificationScreenProps) => {
  const { t } = useTranslation();

  const copy =
    copyByStatus[status as keyof typeof copyByStatus] ??
    copyByStatus[KycStatus.NotStarted];

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: !canVerify,
        isLoading: false,
        label: t(copy.cta),
        onClick: onVerify,
      }),
      [canVerify, copy.cta, onVerify, t]
    )
  );

  return (
    <Box
      data-testid="kyc-verification-screen"
      flex={1}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      my="4"
    >
      <Box my="4">
        <ShieldCheckIcon
          color={status === KycStatus.Rejected ? "textDanger" : "text"}
        />
      </Box>

      <Heading variant={{ level: "h4" }} marginBottom="4">
        {t(copy.title)}
      </Heading>

      <Text variant={{ type: "muted", weight: "normal" }} marginBottom="4">
        {t(copy.description)}
      </Text>

      {kyc?.notes && (
        <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
          {kyc.notes}
        </Text>
      )}
    </Box>
  );
};
