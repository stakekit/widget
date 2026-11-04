import { Collapsible } from "@base-ui/react/collapsible";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Icon } from "../primitives/icon";
import { space } from "../tokens/space.stylex";
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
  /** An avatar before the title, such as the provider's logo. */
  readonly leading?: ReactNode;
  /** Badges or a decorative icon after the title, such as a status. */
  readonly badges?: ReactNode;
  /** Renders as the trigger's `data-testid`. */
  readonly testId?: string;
};

/**
 * A section that shows or hides its content, such as more details. The
 * trigger is a button whose expanded state says whether it is open; it may
 * lead with an avatar and carry badges after its title.
 */
export const Disclosure = ({
  title,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  leading,
  badges,
  testId,
}: DisclosureProps) => (
  <Collapsible.Root
    open={open}
    onOpenChange={(next) => onOpenChange?.(next)}
    defaultOpen={defaultOpen}
  >
    <Collapsible.Trigger
      data-testid={testId}
      {...stylex.props(disclosureStyles.trigger, focusRingStyles.visible)}
    >
      {leading === undefined && badges === undefined ? (
        title
      ) : (
        <span {...stylex.props(styles.title)}>
          {leading}
          <span>{title}</span>
          {badges}
        </span>
      )}
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
  title: {
    gap: space[8],
    alignItems: "center",
    display: "flex",
    minWidth: 0,
  },
  panel: {
    height: {
      default: "var(--collapsible-panel-height)",
      [enteringOrLeaving]: 0,
    },
  },
});
