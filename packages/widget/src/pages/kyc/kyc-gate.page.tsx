import { useSelector } from "@xstate/store/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { Box } from "../../components/atoms/box";
import { Spinner } from "../../components/atoms/spinner";
import { KycIframeModal } from "../../components/molecules/kyc-iframe-modal";
import {
  getYieldKycRequirement,
  KycStatus,
  kycNeedsVerification,
  resolveKycUrl,
} from "../../domain/types/kyc";
import { useKycStatus } from "../../hooks/api/use-kyc-status";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { useEnterStakeStore } from "../../providers/enter-stake-store";
import { useSKWallet } from "../../providers/sk-wallet";
import { PageContainer } from "../components/page-container";
import { IdentityVerificationScreen } from "./identity-verification.page";

export const KycGatePage = () => {
  const { t } = useTranslation();
  const enterStore = useEnterStakeStore();
  const { address } = useSKWallet();

  const data = useSelector(enterStore, (state) => state.context.data);
  const yieldDto = data.map((d) => d.selectedStake).extractNullable();

  const statusQuery = useKycStatus(yieldDto?.id, address, {
    enabled: !!yieldDto,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const onVerify = useCallback(() => setModalOpen(true), []);

  // no flow context (direct nav) → home
  if (!yieldDto) return <Navigate to="/" replace />;

  if (statusQuery.isLoading) {
    return (
      <AnimationPage>
        <PageContainer>
          <Box
            flex={1}
            display="flex"
            alignItems="center"
            justifyContent="center"
            my="4"
          >
            <Spinner />
          </Box>
        </PageContainer>
      </AnimationPage>
    );
  }

  // fail closed: missing status blocks entry
  const status = statusQuery.data?.kycStatus ?? KycStatus.NotStarted;

  if (!kycNeedsVerification(status)) {
    return <Navigate to="/review" replace />;
  }

  const requirement = getYieldKycRequirement(yieldDto);
  const url = resolveKycUrl({
    statusKycUrl: statusQuery.data?.kycUrl,
    kyc: requirement.kyc,
    legacyKycUrl: requirement.legacyKycUrl,
  });

  return (
    <AnimationPage>
      <PageContainer>
        <IdentityVerificationScreen
          status={status}
          kyc={requirement.kyc}
          canVerify={!!url}
          onVerify={onVerify}
        />

        {url && (
          <KycIframeModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            url={url}
            title={t("kyc.modal_title")}
          />
        )}
      </PageContainer>
    </AnimationPage>
  );
};
