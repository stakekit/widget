import clsx from "clsx";
import { Box } from "../../../../shared/ui/primitives/box";
import { tabPageContainer } from "./styles.css";

export const TabPageContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <Box className={clsx(tabPageContainer(), className)}>{children}</Box>;
};
