import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MaybeWindow } from "../../../utils/maybe-window";
import { Box } from "../box";
import { Check } from "../icons/check";
import { Copy } from "../icons/copy";
import { container } from "./styles.css";

type CopyTextContextType = {
  showCopySuccess: boolean;
  onClick: () => void;
};

const CopyTextContext = createContext<CopyTextContextType | undefined>(
  undefined
);

const useCopyText = () => {
  const context = useContext(CopyTextContext);

  if (!context) {
    throw new Error("useCopyText must be used within a CopyTextProvider");
  }

  return context;
};

export const Provider = ({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) => {
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const onClick = useCallback(() => {
    MaybeWindow.ifJust((w) => w.navigator.clipboard.writeText(text));
    setShowCopySuccess(true);
  }, [text]);

  useEffect(() => {
    if (!showCopySuccess) return;

    const timeout = setTimeout(() => setShowCopySuccess(false), 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [showCopySuccess]);

  const value = useMemo<CopyTextContextType>(
    () => ({ showCopySuccess, onClick }),
    [onClick, showCopySuccess]
  );

  return (
    <CopyTextContext.Provider value={value}>
      {children}
    </CopyTextContext.Provider>
  );
};

export const Root = ({
  children,
}: {
  children:
    | ReactNode
    | ((args: Pick<CopyTextContextType, "showCopySuccess">) => ReactNode);
}) => {
  const { onClick, showCopySuccess } = useCopyText();

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      onClick={onClick}
      as="a"
      className={container}
    >
      {typeof children === "function"
        ? children({ showCopySuccess })
        : children}
    </Box>
  );
};

export const AnimatedContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { showCopySuccess, onClick } = useCopyText();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={showCopySuccess ? "check" : "copy"}
        whileTap={{ scale: showCopySuccess ? 1 : 0.9 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3 } }}
        exit={{ opacity: 0, transition: { duration: 0 } }}
        className={className}
      >
        {/* Workaround to animate with previous state */}
        <CopyTextContext.Provider value={{ showCopySuccess, onClick }}>
          {children}
        </CopyTextContext.Provider>
      </motion.div>
    </AnimatePresence>
  );
};

export const Icons = ({
  hw,
  className,
}: {
  hw?: number;
  className?: string;
}) => {
  const { showCopySuccess } = useCopyText();

  return showCopySuccess ? (
    <Check
      className={className}
      hw={hw}
      color="positionsClaimRewardsBackground"
    />
  ) : (
    <Copy className={className} hw={hw} />
  );
};
