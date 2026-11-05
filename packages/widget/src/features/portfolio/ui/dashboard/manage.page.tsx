import { Stack } from "../../../../ui/index";
import { AnimationPage } from "../../../widget-shell/views";
import { PositionsPage } from "./positions/positions.page.tsx";
import { Summary } from "./summary";

export const ManagePage = () => {
  return (
    <AnimationPage>
      <Stack gap={16}>
        <Summary />
        <PositionsPage />
      </Stack>
    </AnimationPage>
  );
};
