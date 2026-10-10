import { createContext, type PropsWithChildren, useContext } from "react";
import { Box } from "../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../shared/ui/primitives/icons/caret-left";
import { useHeader } from "../../header/use-header";

const BackButtonContext = createContext<boolean>(false);

/**
 * Shows nested `BackButton`s while `enabled`. Toggle `enabled` instead of
 * conditionally wrapping, so the subtree below keeps its identity.
 */
export const BackButtonProvider = ({
  children,
  enabled = true,
}: PropsWithChildren<{ readonly enabled?: boolean }>) => {
  return (
    <BackButtonContext.Provider value={enabled}>
      {children}
    </BackButtonContext.Provider>
  );
};

const useBackButton = () => {
  return useContext(BackButtonContext);
};

type BackButtonProps = {
  readonly "aria-label"?: string;
  readonly "data-rk"?: string;
  readonly "data-testid"?: string;
  readonly onClick?: () => void;
};

export const BackButton = ({ onClick, ...rest }: BackButtonProps) => {
  const { onLeftIconPress } = useHeader();
  const showBack = useBackButton();

  if (!showBack) return null;

  return (
    <Box
      as="button"
      onClick={onClick ?? onLeftIconPress}
      display="flex"
      alignItems="center"
      justifyContent="flex-start"
      type="button"
      {...rest}
    >
      <CaretLeftIcon />
    </Box>
  );
};
