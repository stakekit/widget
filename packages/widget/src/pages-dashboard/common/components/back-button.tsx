import { createContext, type PropsWithChildren, useContext } from "react";
import { Box } from "../../../components/atoms/box";
import { CaretLeftIcon } from "../../../components/atoms/icons/caret-left";
import { useHeader } from "../../../components/molecules/header/use-header";

const BackButtonContext = createContext<boolean>(false);

export const BackButtonProvider = ({ children }: PropsWithChildren) => {
  return (
    <BackButtonContext.Provider value>{children}</BackButtonContext.Provider>
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
