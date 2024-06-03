import clsx from "clsx";
import type { Variants } from "framer-motion";
import {
  AnimatePresence,
  motion,
  useAnimate,
  usePresence,
} from "framer-motion";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useFirstMountState } from "../../../hooks/use-first-mount-state";
import { useDisableTransitionDuration } from "../../../navigation/containers/animation-layout";
import type { BoxProps } from "../box";
import { Box } from "../box";
import { CaretDownIcon } from "../icons";
import { caretContainer, rotate180deg, triggerContainer } from "./styles.css";

type State = { collapsed: boolean; onClick: () => void };

type Props = PropsWithChildren<State | { collapsed?: never; onClick?: never }>;

const CollapsibleContext = createContext<State | undefined>(undefined);

const useCollapsible = () => {
  const value = useContext(CollapsibleContext);

  if (!value) {
    throw new Error("useCollapsible must be used within a CollapsibleRoot");
  }

  return value;
};

export const CollapsibleRoot = ({ children, ...controlledProps }: Props) => {
  const internalState = useState(true);

  const value = useMemo<State>(
    () =>
      controlledProps.onClick
        ? {
            collapsed: controlledProps.collapsed,
            onClick: controlledProps.onClick,
          }
        : {
            collapsed: internalState[0],
            onClick: () => internalState[1]((prev) => !prev),
          },
    [controlledProps, internalState]
  );

  return (
    <CollapsibleContext.Provider value={value}>
      {children}
    </CollapsibleContext.Provider>
  );
};

export const CollapsibleTrigger = ({
  children,
  ...rest
}: PropsWithChildren<BoxProps>) => {
  const { onClick } = useCollapsible();

  return (
    <Box
      display="flex"
      onClick={onClick}
      justifyContent="space-between"
      alignItems="center"
      className={triggerContainer}
      {...rest}
    >
      {children}
    </Box>
  );
};

export const CollapsibleArrow = () => {
  const { collapsed } = useCollapsible();

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      className={clsx([caretContainer, { [rotate180deg]: !collapsed }])}
    >
      <CaretDownIcon size={20} />
    </Box>
  );
};

export const CollapsibleContent = ({ children }: PropsWithChildren) => {
  const { collapsed } = useCollapsible();

  const isFirstMount = useFirstMountState();

  return (
    <AnimatePresence>
      {!collapsed && (
        <AnimateContent isFirstMount={isFirstMount}>{children}</AnimateContent>
      )}
    </AnimatePresence>
  );
};

const variants = {
  open: { opacity: 1, height: "auto" },
  closed: { opacity: 0, height: 0 },
} satisfies Variants;

const AnimateContent = ({
  isFirstMount,
  children,
}: PropsWithChildren<{ isFirstMount: boolean }>) => {
  const [isPresent, safeToRemove] = usePresence();
  const [scope, animate] = useAnimate();

  const [, setDisableTransitionDuration] = useDisableTransitionDuration();

  useEffect(() => {
    if (isPresent) {
      const enterAnimation = async () => {
        setDisableTransitionDuration(true);
        await animate(scope.current, variants.open);
        setDisableTransitionDuration(false);
      };

      enterAnimation();
    } else {
      const exitAnimation = async () => {
        setDisableTransitionDuration(true);
        await animate(scope.current, variants.closed);
        setDisableTransitionDuration(false);
        safeToRemove();
      };

      exitAnimation();
    }
  }, [animate, isPresent, safeToRemove, scope, setDisableTransitionDuration]);

  return (
    <motion.div
      ref={scope}
      initial={isFirstMount ? variants.open : variants.closed}
      style={{ overflow: "hidden" }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};
