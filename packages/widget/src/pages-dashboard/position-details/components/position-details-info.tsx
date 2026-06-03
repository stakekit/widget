import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { EarnDetailsView } from "../../overview/earn-details";

export const PositionDetailsInfo = () => {
  const { isLoading, integrationData } = usePositionDetails();

  return (
    <EarnDetailsView
      isLoading={isLoading}
      yieldDto={integrationData.extractNullable()}
    />
  );
};
