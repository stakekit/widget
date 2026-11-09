import { useAtomValue } from "@effect/atom-react";
import type { ComponentProps } from "react";

import { HelpModal as PreferencesHelpModal } from "../../features/preferences/views";
import { rejectedWidgetConfigAtom } from "../../runtime/widget-config";
import { ThemeWrapper } from "./providers/theme-wrapper";

/**
 * The public `HelpModal`, which hosts place among `SKApp` children, outside
 * the Widget's theme root. It brings an inline theme root of its own, so its
 * trigger and popup carry the Widget's Appearance, Host Profile and
 * `portalContainer` while the trigger flows in the host's layout. Without a
 * Widget Configuration (the host's was rejected) there is no theme to apply.
 */
export const HelpModal = (
  props: ComponentProps<typeof PreferencesHelpModal>
) => {
  const rejectedConfig = useAtomValue(rejectedWidgetConfigAtom);
  const modal = <PreferencesHelpModal {...props} />;

  if (rejectedConfig) return modal;

  return <ThemeWrapper inline>{modal}</ThemeWrapper>;
};
