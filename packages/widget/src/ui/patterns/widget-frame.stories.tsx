import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Disclosure } from "../components/disclosure";
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

/** The frame's and its content's heights, once per frame for `ms`. */
const sampleHeights = async (canvasElement: HTMLElement, ms: number) => {
  const { frame, content } = frameParts(canvasElement);
  const samples: { frame: number; content: number }[] = [];
  const end = performance.now() + ms;
  while (performance.now() < end) {
    const { promise, resolve } = Promise.withResolvers<number>();
    requestAnimationFrame(resolve);
    await promise;
    samples.push({
      frame: frame.getBoundingClientRect().height,
      content: content.getBoundingClientRect().height,
    });
  }
  return samples;
};

const lagging = (samples: { frame: number; content: number }[]) =>
  samples.filter((sample) => Math.abs(sample.frame - sample.content) > 0.5);

/**
 * Renders nothing for a few frames, as a page still loading would; well
 * within the frame's shrink delay.
 */
const LatePage = ({ children }: { readonly children: ReactNode }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(timer);
  }, []);
  return shown ? children : null;
};

/**
 * Two pages, short and long, the long one a card taller and empty for a
 * moment before it shows; each page holds a disclosure that resizes it in
 * place.
 */
const PagedHost = (args: ComponentProps<typeof WidgetFrame>) => {
  const [page, setPage] = useState<"short" | "long">("short");
  const body = (
    <Stack gap="gutter">
      <Button
        variant="primary"
        onClick={() => setPage(page === "short" ? "long" : "short")}
      >
        Next page
      </Button>
      <Disclosure title="More details">
        <Text as="p">Rewards are paid every epoch.</Text>
        <Text as="p">Unstaking takes about a week.</Text>
        <Text as="p">Fees are taken from the rewards.</Text>
      </Disclosure>
      {page === "long" && (
        <Card>
          <Text as="p">A longer page needs more of the frame's height.</Text>
          <Text as="p">The frame eases to it rather than jumping.</Text>
        </Card>
      )}
    </Stack>
  );
  return (
    <div data-testid="host">
      <WidgetFrame {...args} pageKey={page}>
        {page === "short" ? body : <LatePage>{body}</LatePage>}
      </WidgetFrame>
    </div>
  );
};

/**
 * When its `pageKey` changes, the frame eases to the new page's height. While
 * the page area is empty between the two pages it holds the old page's
 * height, so it never dips below the shorter of the two.
 */
export const PageChange: Story = {
  // `full` keeps no least height, so both pages set the frame's height.
  args: { width: "full" },
  render: (args) => <PagedHost {...args} />,
  play: async ({ canvasElement }) => {
    const { frame, content } = frameParts(canvasElement);
    // Let the frame measure the first page, as it has long before a reader
    // can change pages.
    await sampleHeights(canvasElement, 100);
    const before = frame.getBoundingClientRect().height;
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Next page" })
    );
    const samples = await sampleHeights(canvasElement, 800);
    await expect(lagging(samples).length).toBeGreaterThan(2);
    await waitFor(() =>
      expect(frame.getBoundingClientRect().height).toBe(
        content.getBoundingClientRect().height
      )
    );
    const after = frame.getBoundingClientRect().height;
    await expect(after).toBeGreaterThan(before);
    const lowest = Math.min(...samples.map((sample) => sample.frame));
    await expect(lowest).toBeGreaterThanOrEqual(Math.min(before, after) - 0.5);

    // Back to the shorter page: the frame eases down to it.
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Next page" })
    );
    const back = await sampleHeights(canvasElement, 900);
    await expect(lagging(back).length).toBeGreaterThan(2);
    await expect(back.at(-1)?.frame).toBeCloseTo(before, 0);
  },
};

/**
 * Within a page the frame follows its content's height every frame, so a
 * disclosure's own animation is the only one: opening and closing it never
 * eases the frame after it.
 */
export const InPageResize: Story = {
  args: { width: "full" },
  render: (args) => <PagedHost {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "More details",
    });
    const heights = (samples: { content: number }[]) =>
      samples.map((sample) => sample.content);

    await userEvent.click(trigger);
    const opening = await sampleHeights(canvasElement, 400);
    await expect(Math.max(...heights(opening))).toBeGreaterThan(
      Math.min(...heights(opening))
    );
    await expect(lagging(opening)).toEqual([]);

    await userEvent.click(trigger);
    const closing = await sampleHeights(canvasElement, 400);
    await expect(lagging(closing)).toEqual([]);
  },
};

/**
 * `narrow` and `wide` keep a least height: a short page grows into it, and
 * the footer stays at the foot, so the Widget doesn't shrink between states.
 */
export const MinHeight: Story = {
  render: (args) => (
    <div data-testid="host">
      <WidgetFrame {...args}>
        <Text as="p">A short page.</Text>
      </WidgetFrame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { frame } = frameParts(canvasElement);
    await expect(frame.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      640
    );
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
