import * as stylex from "@stylexjs/stylex";
import { Button } from "../components/button";
import { toneSoftStyles } from "../components/tone-styles";
import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { radius } from "../tokens/radius.stylex";
import { avatarSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";

/** The props `EmptyState` and `ErrorState` share. */
export type StateMessageProps = {
  /** The icon over the title. */
  readonly icon?: FixedIconName;
  readonly title: string;
  /** The heading level the page's outline needs. */
  readonly as?: "h2" | "h3" | "h4";
  /** What happened and what to do about it. */
  readonly body?: string;
  /** The button that resolves it, such as "Try again". */
  readonly action?: {
    readonly label: string;
    readonly onClick: () => void;
    readonly loading?: boolean;
  };
  readonly tone: "neutral" | "danger";
  /** `alert` announces it as soon as it shows. */
  readonly role?: "alert";
};

/** A centered icon, title, body and action, for empty and error states. */
export const StateMessage = ({
  icon,
  title,
  as = "h3",
  body,
  action,
  tone,
  role,
}: StateMessageProps) => (
  <div role={role} {...stylex.props(styles.root)}>
    <span {...stylex.props(styles.icon, toneSoftStyles[tone])}>
      <Icon name={icon ?? "InfoIcon"} size="lg" />
    </span>
    <Stack align="center" gap={4}>
      <Text variant="heading" as={as}>
        {title}
      </Text>
      {body !== undefined && (
        <Text as="p" tone="muted">
          {body}
        </Text>
      )}
    </Stack>
    {action !== undefined && (
      <Button
        variant="secondary"
        onClick={action.onClick}
        loading={action.loading ?? false}
      >
        {action.label}
      </Button>
    )}
  </div>
);

const styles = stylex.create({
  root: {
    gap: space[16],
    paddingBlock: space[24],
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
  },
  icon: {
    borderRadius: radius.pill,
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    height: avatarSize.lg,
    width: avatarSize.lg,
  },
});
