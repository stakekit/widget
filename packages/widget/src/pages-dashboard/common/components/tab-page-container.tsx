import { Box } from "@sk-widget/components/atoms/box";
import { tabPageContainer } from "@sk-widget/pages-dashboard/common/components/styles.css";
import clsx from "clsx";

export const TabPageContainer = ({
  children,
  className,
}: { children: React.ReactNode; className?: string }) => {
  return <Box className={clsx(tabPageContainer(), className)}>{children}</Box>;
};
