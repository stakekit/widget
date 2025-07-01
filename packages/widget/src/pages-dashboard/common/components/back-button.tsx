import { type PropsWithChildren, createContext, useContext } from "react";
import { Box } from "../../../components/atoms/box";
import { CaretLeftIcon } from "../../../components/atoms/icons/caret-left";
import { useHeader } from "../../../components/molecules/header/use-header";

export const BackButtonContext = createContext<boolean>(false);

export const BackButtonProvider = ({ children }: PropsWithChildren) => {
  return (
    <BackButtonContext.Provider value>{children}</BackButtonContext.Provider>
  );
};

const useBackButton = () => {
  return useContext(BackButtonContext);
};

export const BackButton = () => {
  const { onLeftIconPress } = useHeader();
  const showBack = useBackButton();

  if (!showBack) return null;

  return (
    <Box
      as="button"
      onClick={onLeftIconPress}
      display="flex"
      alignItems="center"
      justifyContent="flex-start"
    >
      <CaretLeftIcon />
    </Box>
  );
};
