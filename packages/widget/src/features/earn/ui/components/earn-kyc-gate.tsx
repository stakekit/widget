import { Box } from "../../../../shared/ui/primitives/box";
import { useEarnEntry } from "../../react/use-earn-facades";
import { KycGateCard } from "./kyc-gate-card";

export const EarnKycGate = () => {
  const { refreshKyc, view } = useEarnEntry();
  const { gate, isChecking, providerName } = view.kyc;
  if (gate.state === "pass" && !isChecking) return null;

  return (
    <Box marginTop="3">
      <KycGateCard
        gate={gate}
        isChecking={isChecking}
        onCheckStatus={() => refreshKyc(undefined)}
        providerName={providerName}
      />
    </Box>
  );
};
