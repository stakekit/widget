import { createContext, type PropsWithChildren, useContext } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "../../../ui/index";
import { useHeader } from "../react/use-header";

const BackButtonContext = createContext<boolean>(false);

/**
 * Shows nested `BackButton`s while `enabled`. Toggle `enabled` instead of
 * conditionally wrapping, so the subtree below keeps its identity.
 */
export const BackButtonProvider = ({
  children,
  enabled = true,
}: PropsWithChildren<{ readonly enabled?: boolean }>) => (
  <BackButtonContext value={enabled}>{children}</BackButtonContext>
);

/**
 * The shell's back button, shown inside an enabled `BackButtonProvider`.
 * Unset, `onClick` goes back in the Widget's history and `label` is "Back".
 */
export const BackButton = ({
  label,
  onClick,
  testId,
}: {
  readonly label?: string;
  readonly onClick?: () => void;
  readonly testId?: string;
}) => {
  const { t } = useTranslation();
  const { onLeftIconPress } = useHeader();
  const showBack = useContext(BackButtonContext);

  if (!showBack) return null;

  return (
    <IconButton
      icon="CaretLeftIcon"
      label={label ?? t("shared.back")}
      onClick={onClick ?? onLeftIconPress}
      testId={testId}
    />
  );
};
