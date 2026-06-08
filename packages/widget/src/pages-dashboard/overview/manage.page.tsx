import { Box } from "../../components/atoms/box";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { PositionsPage } from "./positions/positions.page";
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
