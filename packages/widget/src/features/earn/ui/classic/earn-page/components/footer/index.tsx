import type { ComponentProps } from "react";
import { useEarnEntry } from "../../../../../react/use-earn-facades";
import { MetaInfo } from "../../../../components/meta-info";

export const Footer = ({
  textSize,
}: {
  textSize?: ComponentProps<typeof MetaInfo>["textSize"];
}) => {
  const { view } = useEarnEntry();

  return (
    <MetaInfo
      isLoading={view.appLoading || view.footerIsLoading}
      selectedStake={view.selectedStake}
      selectedValidators={view.selectedValidators}
      selectedToken={view.selectedToken}
      textSize={textSize}
    />
  );
};
