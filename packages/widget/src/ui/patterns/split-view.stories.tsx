import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Card } from "../components/card";
import { Text } from "../primitives/text";
import { ContainerFrame } from "../storybook/container-frame";
import { SplitView } from "./split-view";

const meta = {
  title: "Patterns/SplitView",
  component: SplitView,
  args: {
    secondaryLabel: "Details",
    primary: (
      <div data-testid="primary-pane">
        <Card>
          <Text>Choose an amount to stake.</Text>
        </Card>
      </div>
    ),
    secondary: (
      <div data-testid="secondary-pane">
        <Card>
          <Text>Reward rate and provider details.</Text>
        </Card>
      </div>
    ),
  },
  render: (args) => (
    <ContainerFrame width={900}>
      <SplitView {...args} />
    </ContainerFrame>
  ),
} satisfies Meta<typeof SplitView>;
export default meta;

type Story = StoryObj<typeof meta>;

const panes = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  return {
    primary: canvas.getByTestId("primary-pane").getBoundingClientRect(),
    secondary: canvas.getByTestId("secondary-pane").getBoundingClientRect(),
  };
};

/**
 * Narrower than the `split` container size, as at a 900px Dashboard, the
 * panes stack in one column centred in the view and no wider than the `md`
 * container size: the secondary under the primary, both as wide, and no
 * control swaps them.
 */
export const Stacked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { primary, secondary } = panes(canvasElement);
    // The story's 900px container frame.
    const frame = canvas
      .getByTestId("primary-pane")
      .closest('[style*="container-type"]')
      ?.getBoundingClientRect();

    await expect(secondary.top).toBeGreaterThanOrEqual(primary.bottom);
    await expect(secondary.left).toBe(primary.left);
    await expect(primary.width).toBe(520);
    await expect(secondary.width).toBe(520);
    await expect(frame?.width).toBe(900);
    await expect(primary.left - (frame?.left ?? 0)).toBe(190);
    await expect(
      canvas.getByText("Reward rate and provider details.")
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** From the `split` container size up, the panes sit side by side. */
export const Split: Story = {
  render: (args) => (
    <ContainerFrame width={1000}>
      <SplitView {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const { primary, secondary } = panes(canvasElement);

    await expect(secondary.left).toBeGreaterThanOrEqual(primary.right);
    await expect(secondary.top).toBe(primary.top);
  },
};

/** With one pane, the view shows only that pane. */
export const SecondaryOnly: Story = {
  args: { primary: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Reward rate and provider details.")
    ).toBeVisible();
    await expect(canvas.queryByText("Choose an amount to stake.")).toBeNull();
  },
};
