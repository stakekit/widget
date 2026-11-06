import { Stack } from "../../../../ui/index";
import { useSKWallet } from "../../../wallet/index";
import { AnimationPage } from "../../../widget-shell/views";
import { ManageSummary } from "../components/manage-summary";
import { PositionsPage } from "./positions/positions.page.tsx";

export const ManagePage = () => {
  // Without a wallet there is nothing to sum up; the list asks to connect.
  const showsSummary = useSKWallet()?.status === "connected";

  return (
    <AnimationPage>
      <Stack gap={16} grow>
        {showsSummary && <ManageSummary />}
        <PositionsPage />
      </Stack>
    </AnimationPage>
  );
};
