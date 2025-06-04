import { Box } from "@sk-widget/components/atoms/box";
import { tabPageContainer } from "@sk-widget/pages-dashboard/common/components/styles.css";

export const TabPageContainer = ({
  children,
}: { children: React.ReactNode }) => {
  return <Box className={tabPageContainer()}>{children}</Box>;
};
