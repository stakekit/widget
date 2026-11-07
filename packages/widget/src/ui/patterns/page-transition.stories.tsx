import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { PageTransition } from "./page-transition";

const pages = ["Earn", "Positions", "Activity"] as const;

/** Route content that changes page on a button press. */
const Pages = ({
  variant,
  waitForExit,
  onExitComplete,
}: {
  readonly variant: "rise" | "fade";
  readonly waitForExit?: boolean;
  readonly onExitComplete?: () => void;
}) => {
  const [index, setIndex] = useState(0);
  const page = pages[index % pages.length] ?? "Earn";
  return (
    <Stack gap={16} align="start">
      <Button variant="secondary" onClick={() => setIndex(index + 1)}>
        Next page
      </Button>
      <div style={{ width: 320 }}>
        <PageTransition
          pageKey={page}
          variant={variant}
          {...(waitForExit === undefined ? {} : { waitForExit })}
          {...(onExitComplete === undefined ? {} : { onExitComplete })}
        >
          <Card>
            <Text variant="heading" as="h2">
              {page}
            </Text>
          </Card>
        </PageTransition>
      </div>
    </Stack>
  );
};

const meta = {
  title: "Patterns/PageTransition",
  component: Pages,
  args: { variant: "rise", onExitComplete: fn() },
} satisfies Meta<typeof Pages>;
export default meta;

type Story = StoryObj<typeof meta>;

const nextPage = async (canvasElement: HTMLElement) =>
  userEvent.click(
    within(canvasElement).getByRole("button", { name: "Next page" })
  );

/** Waits until the page holding `heading` has finished entering. */
const settled = (heading: HTMLElement) =>
  waitFor(() => {
    const page = heading.closest<HTMLElement>("[style*='opacity']");
    return expect(page?.style.opacity).toBe("1");
  });

/** The next page rises in while the last one leaves, blurred and shrinking. */
export const Rise: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Earn" })).toBeVisible()
    );

    await nextPage(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Positions" })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(canvas.queryByRole("heading", { name: "Earn" })).toBeNull()
    );
    await waitFor(() => expect(args.onExitComplete).toHaveBeenCalled());
    await settled(canvas.getByRole("heading", { name: "Positions" }));
  },
};

/**
 * The first page rises in too. The accessibility check runs once play ends,
 * so play waits for the page to settle: mid-fade, the heading's colour is
 * still blending into the canvas.
 */
export const RiseDark: Story = {
  args: { variant: "rise" },
  globals: { colorScheme: "dark" },
  play: async ({ canvasElement }) => {
    await settled(
      await within(canvasElement).findByRole("heading", { name: "Earn" })
    );
  },
};

/** With `waitForExit`, the next page enters only after the last one left. */
export const FadeAfterExit: Story = {
  args: { variant: "fade", waitForExit: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Earn" })).toBeVisible()
    );
    await nextPage(canvasElement);
    // The next page waits while the last one leaves.
    await expect(
      canvas.queryByRole("heading", { name: "Positions" })
    ).toBeNull();

    await waitFor(() =>
      expect(canvas.queryByRole("heading", { name: "Earn" })).toBeNull()
    );
    await waitFor(() => expect(args.onExitComplete).toHaveBeenCalled());
    await settled(
      await canvas.findByRole(
        "heading",
        { name: "Positions" },
        { timeout: 2000 }
      )
    );
  },
};
