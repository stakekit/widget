import { Box } from "@sk-widget/components/atoms/box";
import { CaretLeftIcon } from "@sk-widget/components/atoms/icons/caret-left";
import { useHeader } from "@sk-widget/components/molecules/header/use-header";
import { type PropsWithChildren, createContext, useContext } from "react";

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
