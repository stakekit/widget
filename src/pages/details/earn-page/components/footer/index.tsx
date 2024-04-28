import { MetaInfo } from "../../../../components/meta-info";
import { useDetailsContext } from "../../state/details-context";

export const Footer = () => {
  const { appLoading, footerIsLoading } = useDetailsContext();

  return <MetaInfo isLoading={appLoading || footerIsLoading} />;
};
