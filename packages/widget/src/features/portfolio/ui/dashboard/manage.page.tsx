import { Box } from "../../../../shared/ui/primitives/box";
import { AnimationPage } from "../../../widget-shell/components";
import { PositionsPage } from "./positions/positions.page.tsx";
import { Summary } from "./summary";

export const ManagePage = () => {
  return (
    <AnimationPage>
      <Box display="flex" flexDirection="column" gap="8">
        <Summary />
        <PositionsPage />
      </Box>
    </AnimationPage>
  );
};
