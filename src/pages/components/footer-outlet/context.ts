import { useLayoutEffect } from "react";
import { useSyncElementHeight } from "../../../hooks/use-sync-element-height";
import createStateContext from "../../../utils/create-state-context";

export const [useFooterHeight, FooterHeightProvider] = createStateContext(0);

export type FooterButtonVal = {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  label: string;
  variant?: "primary" | "secondary";
} | null;

export const [useFooterButton, FooterButtonProvider] =
  createStateContext<FooterButtonVal>(null);

export const useSyncFooterHeight = () =>
  useSyncElementHeight(useFooterHeight()[1]);

export const useRegisterFooterButton = (val: FooterButtonVal) => {
  const [, setFooterButton] = useFooterButton();

  useLayoutEffect(() => {
    setFooterButton(val);

    return () => {
      setFooterButton((prev) => (prev === val ? null : prev));
    };
  }, [setFooterButton, val]);
};
