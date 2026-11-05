import { Stack } from "../../../../ui/index";
import { useSKWallet } from "../../../wallet/index";
import { AnimationPage } from "../../../widget-shell/views";
import { PositionsPage } from "./positions/positions.page.tsx";
import { Summary } from "./summary";

export const ManagePage = () => {
  // Without a wallet there is nothing to sum up; the list asks to connect.
  const showsSummary = useSKWallet()?.status === "connected";

  return (
    <AnimationPage>
      <Stack gap={16} grow>
        {showsSummary && <Summary />}
        <PositionsPage />
      </Stack>
    </AnimationPage>
  );
};
