import type { ComponentProps } from "react";
import { MetaInfo } from "../../../../components/meta-info";
import { useEarnPageContext } from "../../state/earn-page-context";

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
  } = useEarnPageContext();

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
