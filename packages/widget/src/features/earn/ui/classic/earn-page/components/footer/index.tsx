import type { ComponentProps } from "react";
import { MetaInfo } from "../../../../components/meta-info";
import { useEarnPageModel } from "../../state/earn-page-model";

export const Footer = ({
  textSize,
}: {
  textSize?: ComponentProps<typeof MetaInfo>["textSize"];
}) => {
  const {
    appLoading,
    footerIsLoading,
    selectedStake,
    selectedValidators,
    selectedToken,
  } = useEarnPageModel();

  return (
    <MetaInfo
      isLoading={appLoading || footerIsLoading}
      selectedStake={selectedStake}
      selectedValidators={selectedValidators}
      selectedToken={selectedToken}
      textSize={textSize}
    />
  );
};
