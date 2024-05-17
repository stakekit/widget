import { MetaInfo } from "../../../../components/meta-info";
import { useEarnPageContext } from "../../state/earn-page-context";

export const Footer = () => {
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
    />
  );
};
