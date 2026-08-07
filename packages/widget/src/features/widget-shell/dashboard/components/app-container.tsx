import type { PropsWithChildren } from "react";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { Box } from "../../../../shared/ui/primitives/box";
import { appContainer } from "../../ui/layout.css";

type AppContainerVariant = "widget" | "dashboard";

/**
 * Inline size of the app container, or `null` while it is not measurable yet.
 * Layout decisions taken in JS must use this instead of the window size, since
 * the app can be embedded in a host that gives it less room than the viewport.
 */
const AppContainerWidthContext = createContext<number | null | undefined>(
  undefined
);

export const AppContainerProvider = ({
  variant,
  children,
}: PropsWithChildren<{ variant: AppContainerVariant }>) => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") {
      setWidth(null);
      return;
    }

    setWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return (
    <AppContainerWidthContext.Provider value={width}>
      <Box
        ref={setElement}
        data-sk-layout={variant}
        className={appContainer({ variant })}
      >
        {children}
      </Box>
    </AppContainerWidthContext.Provider>
  );
};

export const useAppContainerWidth = () => {
  const value = useContext(AppContainerWidthContext);

  if (value === undefined) {
    throw new Error("AppContainerProvider not found in the tree");
  }

  return value;
};
