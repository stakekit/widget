import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Card } from "../components/card";
import { Text } from "../primitives/text";
import { ContainerFrame } from "../storybook/container-frame";
import { SplitView } from "./split-view";

const meta = {
  title: "Patterns/SplitView",
  component: SplitView,
  args: {
    primaryBarLabel: "Earn",
    secondaryBarLabel: "Details",
    onActiveSideChange: fn(),
    primary: (
      <Card>
        <Text>Choose an amount to stake.</Text>
      </Card>
    ),
    secondary: (
      <Card>
        <Text>Reward rate and provider details.</Text>
      </Card>
    ),
  },
  render: (args) => (
    <ContainerFrame width={600}>
      <SplitView {...args} />
    </ContainerFrame>
  ),
} satisfies Meta<typeof SplitView>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Narrower than the `split` container size, one pane shows beside a bar
 * named for the other; the bar swaps them.
 */
export const Collapsed: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Choose an amount to stake.")).toBeVisible();
    await expect(
      canvas.queryByText("Reward rate and provider details.")
    ).not.toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Details" }));

    await expect(args.onActiveSideChange).toHaveBeenCalledWith("secondary");
    // The shown pane slides in from its side.
    await waitFor(() =>
      expect(
        canvas.getByText("Reward rate and provider details.")
      ).toBeVisible()
    );
    await expect(
      canvas.queryByText("Choose an amount to stake.")
    ).not.toBeVisible();
    await expect(canvas.getByRole("button", { name: "Earn" })).toBeVisible();
  },
};

/** From the `split` container size up, both panes show and no bar does. */
export const Split: Story = {
  render: (args) => (
    <ContainerFrame width={900}>
      <SplitView {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Choose an amount to stake.")).toBeVisible();
    await expect(
      canvas.getByText("Reward rate and provider details.")
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};
