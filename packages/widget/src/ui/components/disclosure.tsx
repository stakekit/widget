import { Collapsible } from "@base-ui/react/collapsible";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Icon } from "../primitives/icon";
import { disclosureStyles } from "./disclosure-styles";
import { focusRingStyles } from "./focus-ring";

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

type DisclosureProps = {
  /** The trigger's text; it names the content it shows. */
  readonly title: string;
  readonly children: ReactNode;
  /** Open state; leave unset to let the trigger toggle it. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly defaultOpen?: boolean;
};

/**
 * A section that shows or hides its content, such as more details. The
 * trigger is a button whose expanded state says whether it is open.
 */
export const Disclosure = ({
  title,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
}: DisclosureProps) => (
  <Collapsible.Root
    open={open}
    onOpenChange={(next) => onOpenChange?.(next)}
    defaultOpen={defaultOpen}
  >
    <Collapsible.Trigger
      {...stylex.props(disclosureStyles.trigger, focusRingStyles.visible)}
    >
      {title}
      <span {...stylex.props(disclosureStyles.caret)}>
        <Icon name="CaretDownIcon" size="sm" />
      </span>
    </Collapsible.Trigger>
    <Collapsible.Panel {...stylex.props(disclosureStyles.panel, styles.panel)}>
      <div {...stylex.props(disclosureStyles.content)}>{children}</div>
    </Collapsible.Panel>
  </Collapsible.Root>
);

const styles = stylex.create({
  panel: {
    height: {
      default: "var(--collapsible-panel-height)",
      [enteringOrLeaving]: 0,
    },
  },
});
