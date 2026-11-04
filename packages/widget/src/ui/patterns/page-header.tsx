import { IconButton } from "../components/icon-button";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";

type PageHeaderProps = {
  /** The page's name; unset while it loads, the header shows only the trail. */
  readonly title?: string;
  /**
   * The page above this one, as the breadcrumb's root, such as "Positions".
   * The title then follows it after a slash.
   */
  readonly parent?: string;
  /** The back button, which returns to the previous page. */
  readonly back?: {
    /** The button's accessible name, such as "Back". */
    readonly label: string;
    readonly onClick: () => void;
    /** Renders as the back button's `data-testid`. */
    readonly testId?: string;
  };
  /** The heading level the page's outline needs. */
  readonly as?: "h1" | "h2" | "h3";
};

/**
 * The top of a page: a back button, and the breadcrumb from the parent page
 * to this one as the page's heading.
 */
export const PageHeader = ({
  title,
  parent,
  back,
  as = "h2",
}: PageHeaderProps) => (
  <Stack direction="row" align="center" gap={8}>
    {back !== undefined && (
      <IconButton
        icon="CaretLeftIcon"
        label={back.label}
        size="sm"
        onClick={back.onClick}
        data-testid={back.testId}
      />
    )}
    {(parent !== undefined || title !== undefined) && (
      <Stack grow>
        <Text variant="heading" as={as} truncate>
          {parent !== undefined && parent}
          {parent !== undefined && title !== undefined && (
            <Text variant="heading" as="span" tone="muted" weight="regular">
              {` / ${title}`}
            </Text>
          )}
          {parent === undefined && title}
        </Text>
      </Stack>
    )}
  </Stack>
);
