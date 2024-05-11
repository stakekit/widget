import { useEarnPageState } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import { MetaInfo } from "../../../../components/meta-info";
import { useEarnPageContext } from "../../state/earn-page-context";

export const Footer = () => {
  const { appLoading, footerIsLoading } = useEarnPageContext();
  const { selectedStake, selectedValidators, selectedToken } =
    useEarnPageState();

  return (
    <MetaInfo
      isLoading={appLoading || footerIsLoading}
      selectedStake={selectedStake}
      selectedValidators={selectedValidators}
      selectedToken={selectedToken}
    />
  );
};
