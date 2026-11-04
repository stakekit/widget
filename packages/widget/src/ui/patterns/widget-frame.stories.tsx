import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { PageHeader } from "./page-header";
import { WidgetFrame } from "./widget-frame";

const meta = {
  title: "Patterns/WidgetFrame",
  component: WidgetFrame,
  args: {
    poweredByLabel: "Powered by",
    brandName: "StakeKit",
    header: <PageHeader title="Earn" as="h1" />,
    children: (
      <Stack gap="gutter">
        <Card>
          <Text>Choose an amount to stake.</Text>
        </Card>
        <Button variant="primary" size="cta">
          Continue
        </Button>
      </Stack>
    ),
  },
} satisfies Meta<typeof WidgetFrame>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The shell holds the header and page, and names the brand in its footer. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Earn" })
    ).toBeVisible();
    await expect(canvas.getByText(/Powered by/)).toHaveTextContent(
      "Powered by StakeKit"
    );
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

export const Elevated: Story = {
  ...Default,
  globals: { surfaceStyle: "elevated" },
};

/**
 * `narrow` caps the frame at the `sm` container size; `full` fills its
 * parent, as the split view does.
 */
export const Widths: Story = {
  render: (args) => (
    <Stack gap={24}>
      <div style={{ width: 900 }} data-testid="narrow">
        <WidgetFrame {...args} width="narrow" />
      </div>
      <div style={{ width: 900 }} data-testid="full">
        <WidgetFrame {...args} width="full" />
      </div>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frameWidth = (testId: string) =>
      canvas.getByTestId(testId).firstElementChild?.getBoundingClientRect()
        .width;
    await expect(frameWidth("narrow")).toBe(400);
    await expect(frameWidth("full")).toBe(900);
  },
};

/** Without a header, the page starts at the gutter. */
export const WithoutHeader: Story = {
  args: { header: undefined },
};

/** The frame and its content, the frame's first child. */
const frameParts = (canvasElement: HTMLElement) => {
  const frame = within(canvasElement).getByTestId("host").firstElementChild;
  const content = frame?.firstElementChild;
  if (!(frame instanceof HTMLElement) || !(content instanceof HTMLElement)) {
    throw new Error("Expected the frame and its content");
  }
  return { frame, content };
};

/** Shows a longer page on request, as a page change would. */
const GrowingPage = () => {
  const [long, setLong] = useState(false);
  return (
    <Stack gap="gutter">
      <Button variant="primary" onClick={() => setLong(true)}>
        Show more
      </Button>
      {long && (
        <Card>
          <Text as="p">A longer page needs more of the frame's height.</Text>
          <Text as="p">The frame eases to it rather than jumping.</Text>
        </Card>
      )}
    </Stack>
  );
};

/** With `animateHeight`, the frame eases to a page's new height. */
export const AnimateHeight: Story = {
  args: { animateHeight: true, children: <GrowingPage /> },
  render: (args) => (
    <div data-testid="host">
      <WidgetFrame {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { frame, content } = frameParts(canvasElement);
    const before = frame.getBoundingClientRect().height;
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Show more" })
    );
    await waitFor(() =>
      expect(frame.getBoundingClientRect().height).toBe(
        content.getBoundingClientRect().height
      )
    );
    await expect(frame.getBoundingClientRect().height).toBeGreaterThan(before);
  },
};

/** Holds the reveal until the host says the first page can show. */
const RevealHost = (args: ComponentProps<typeof WidgetFrame>) => {
  const [ready, setReady] = useState(false);
  return (
    <Stack gap={16}>
      <Button variant="secondary" onClick={() => setReady(true)}>
        Ready
      </Button>
      <div data-testid="host">
        <WidgetFrame {...args} reveal={{ ready }} />
      </div>
    </Stack>
  );
};

/** With `reveal`, the frame stays closed until ready, then grows open. */
export const Reveal: Story = {
  render: (args) => <RevealHost {...args} />,
  play: async ({ canvasElement }) => {
    const { frame, content } = frameParts(canvasElement);
    await expect(frame.getBoundingClientRect().height).toBe(0);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Ready" })
    );
    await waitFor(() => {
      const height = frame.getBoundingClientRect().height;
      expect(height).toBeGreaterThan(0);
      expect(height).toBe(content.getBoundingClientRect().height);
    });
  },
};
