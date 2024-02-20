import { useSyncElementHeight } from "../../../hooks/use-sync-element-height";
import createStateContext from "../../../utils/create-state-context";
import { useIsPresent } from "framer-motion";
import { useIsomorphicEffect } from "../../../hooks/use-isomorphic-effect";

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

  const isPresent = useIsPresent();

  useIsomorphicEffect(() => {
    if (isPresent) return;
    setFooterButton((prev) => (prev === val ? null : prev));
  }, [isPresent, setFooterButton, val]);

  useIsomorphicEffect(() => {
    setFooterButton(val);

    return () => {
      setFooterButton((prev) => (prev === val ? null : prev));
    };
  }, [setFooterButton, val]);
};
