import type { PropsWithChildren } from "react";
import { Box } from "../../../../shared/ui/primitives/box";
import { useElementAtomRef } from "../../react/use-element-atom-ref";
import { appContainerElementAtom } from "../../state/app-container";
import { appContainer } from "../../ui/layout.css";

type AppContainerVariant = "widget" | "dashboard";

export const AppContainer = ({
  variant,
  children,
}: PropsWithChildren<{ variant: AppContainerVariant }>) => {
  const appContainerRef = useElementAtomRef(appContainerElementAtom);

  return (
    <Box
      ref={appContainerRef}
      data-sk-layout={variant}
      className={appContainer({ variant })}
    >
      {children}
    </Box>
  );
};
