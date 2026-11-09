import * as stylex from "@stylexjs/stylex";
import { Spot } from "../artwork/spot";
import { Button } from "../components/button";
import type { FixedIconName } from "../icons/glyphs";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { containerWidth } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";

type StateAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly loading?: boolean;
};

/** The props `EmptyState` and `ErrorState` share. */
export type StateMessageProps = {
  /** The icon over the title. */
  readonly icon?: FixedIconName;
  readonly title: string;
  /** The heading level the page's outline needs. */
  readonly as?: "h2" | "h3" | "h4";
  /** What happened and what to do about it. */
  readonly body?: string | undefined;
  /** The button that resolves it, such as "Try again" or "Start earning". */
  readonly action?: StateAction | undefined;
  /** A second, quieter way out, under the action. */
  readonly secondaryAction?: StateAction;
  /**
   * `md` heads a page section, such as a list that failed to load; `lg`
   * fills the Widget or a dialog, with a larger spot and title.
   */
  readonly size?: "md" | "lg";
  /**
   * Takes the space left in its column and centers in it, so a short state
   * keeps the place of the content it stands in for.
   */
  readonly fill?: boolean;
  /** Renders as the root's `data-testid`. */
  readonly testId?: string | undefined;
  readonly tone: "neutral" | "danger";
  /** `alert` announces it as soon as it shows. */
  readonly role?: "alert";
};

/**
 * A centered spot, title, body and up to two actions, for empty and error
 * states. Its prose keeps a readable measure however wide the column.
 */
export const StateMessage = ({
  icon,
  title,
  as = "h3",
  body,
  action,
  secondaryAction,
  size = "md",
  fill = false,
  testId,
  tone,
  role,
}: StateMessageProps) => (
  <div
    role={role}
    data-testid={testId}
    {...stylex.props(styles.root, fill && styles.fill)}
  >
    <Spot icon={icon ?? "InfoIcon"} tone={tone} size={size} />
    <div {...stylex.props(styles.prose)}>
      <Stack align="center" gap={4}>
        <Text variant={size === "lg" ? "title" : "heading"} as={as}>
          {title}
        </Text>
        {body !== undefined && (
          <Text as="p" tone="muted">
            {body}
          </Text>
        )}
      </Stack>
    </div>
    {(action !== undefined || secondaryAction !== undefined) && (
      <Stack align="center" gap={8}>
        {action !== undefined && (
          <Button
            variant={tone === "danger" ? "secondary" : "primary"}
            onClick={action.onClick}
            loading={action.loading ?? false}
          >
            {action.label}
          </Button>
        )}
        {secondaryAction !== undefined && (
          <Button
            variant="ghost"
            onClick={secondaryAction.onClick}
            loading={secondaryAction.loading ?? false}
          >
            {secondaryAction.label}
          </Button>
        )}
      </Stack>
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
  fill: { flexGrow: 1, justifyContent: "center" },
  prose: { maxWidth: containerWidth.sm, width: "100%" },
});
