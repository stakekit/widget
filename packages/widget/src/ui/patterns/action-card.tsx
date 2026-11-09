import type { ReactNode } from "react";

import { Button } from "../components/button";
import { Card } from "../components/card";
import type { HostHook } from "../host-hook";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";

type ActionCardProps = {
  /**
   * What the action is about, such as "Claim rewards 1.335 POL" or
   * "84.95 USDC outstanding"; `Text.Strong` marks its figure.
   */
  readonly title: ReactNode;
  /** Context under the title, such as what the action returns. */
  readonly description?: ReactNode;
  /** The action's button: its label names the verb, such as "Claim". */
  readonly action: {
    readonly label: string;
    readonly onClick: () => void;
    readonly loading?: boolean;
    readonly disabled?: boolean;
    readonly testId?: string | undefined;
    readonly hostHook?: HostHook | undefined;
  };
  /**
   * The screen's call to action, such as a withdrawal that is ready on a
   * position's page: the card tints in the accent and its button fills. One
   * per screen; the screen's own call to action then steps down to
   * secondary.
   */
  readonly primary?: boolean;
  /** Renders as the card's `data-testid`. */
  readonly testId?: string | undefined;
};

/**
 * One action a position offers, as a summary beside the button that runs
 * it, such as a position's Claim or Withdraw or a borrow position's Repay: a
 * filled card, the text wrapping beside a small soft button that keeps its
 * row at every width, or with `primary` an accent-tinted card whose button
 * fills. Sibling action cards stack 8px apart.
 */
export const ActionCard = ({
  title,
  description,
  action,
  primary = false,
  testId,
}: ActionCardProps) => (
  <Card padding={16} tone={primary ? "accent" : "neutral"} testId={testId}>
    <Stack direction="row" align="center" justify="between" gap={12}>
      <Stack gap={4} grow>
        <Text breakAnywhere>{title}</Text>
        {description !== undefined && (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        )}
      </Stack>
      <Button
        size="sm"
        variant={primary ? "primary" : "soft"}
        onClick={action.onClick}
        loading={action.loading ?? false}
        disabled={action.disabled ?? false}
        testId={action.testId}
        hostHook={action.hostHook}
      >
        {action.label}
      </Button>
    </Stack>
  </Card>
);
