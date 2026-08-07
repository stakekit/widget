import clsx from "clsx";
import type { Variants } from "motion/react";
import { AnimatePresence, motion, useAnimate, usePresence } from "motion/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useDisableTransitionDuration } from "../../../react/layout-transition";
import type { BoxProps } from "../../primitives/box";
import { Box } from "../../primitives/box";
import { CaretDownIcon } from "../../primitives/icons/caret-down";
import { caretContainer, rotate180deg, triggerContainer } from "./styles.css";

type ControlledProps = {
  collapsed: boolean;
  onClick: () => void;
  initial?: never;
};

type Props = PropsWithChildren<
  ControlledProps | { initial?: boolean; collapsed?: never; onClick?: never }
>;

type CollapsibleContextValue = {
  collapsed: boolean;
  onClick: () => void;
  hasToggled: boolean;
};

const CollapsibleContext = createContext<CollapsibleContextValue | undefined>(
  undefined
);

const useCollapsible = () => {
  const value = useContext(CollapsibleContext);

  if (!value) {
    throw new Error("useCollapsible must be used within a CollapsibleRoot");
  }

  return value;
};

export const CollapsibleRoot = ({ children, ...controlledProps }: Props) => {
  const [internalCollapsed, setInternalCollapsed] = useState(
    controlledProps.initial ?? true
  );
  const [hasToggled, setHasToggled] = useState(false);

  const value: CollapsibleContextValue = {
    collapsed: controlledProps.onClick
      ? controlledProps.collapsed
      : internalCollapsed,
    hasToggled,
    onClick: () => {
      setHasToggled(true);

      if (controlledProps.onClick) {
        controlledProps.onClick();
      } else {
        setInternalCollapsed((prev) => !prev);
      }
    },
  };

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
  const { collapsed, hasToggled } = useCollapsible();

  return (
    <AnimatePresence>
      {!collapsed && (
        <AnimateContent skipEnterAnimation={!hasToggled}>
          {children}
        </AnimateContent>
      )}
    </AnimatePresence>
  );
};

const variants = {
  open: { opacity: 1, height: "auto" },
  closed: { opacity: 0, height: 0 },
} satisfies Variants;

const AnimateContent = ({
  skipEnterAnimation,
  children,
}: PropsWithChildren<{ skipEnterAnimation: boolean }>) => {
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
      initial={skipEnterAnimation ? variants.open : variants.closed}
      style={{ overflow: "hidden" }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};
