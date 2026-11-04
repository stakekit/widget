import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PageHeader } from "./page-header";

const meta = {
  title: "Patterns/PageHeader",
  component: PageHeader,
  args: {
    title: "Lido Staked ETH",
    parent: "Positions",
    back: { label: "Back", onClick: fn() },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <PageHeader {...args} />
    </div>
  ),
} satisfies Meta<typeof PageHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The breadcrumb from the parent page to this one is the page's heading, at
 * one size throughout.
 */
export const Breadcrumb: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("heading", { level: 2 });
    await expect(heading).toHaveTextContent("Positions / Lido Staked ETH");
    await expect(
      getComputedStyle(canvas.getByText("/ Lido Staked ETH")).fontSize
    ).toBe(getComputedStyle(heading).fontSize);
  },
};

export const BreadcrumbDark: Story = {
  ...Breadcrumb,
  globals: { colorScheme: "dark" },
};

/** The back button activates by pointer and by keyboard. */
export const BackActivation: Story = {
  play: async ({ args, canvasElement }) => {
    const back = within(canvasElement).getByRole("button", { name: "Back" });

    await userEvent.click(back);
    await expect(args.back?.onClick).toHaveBeenCalledTimes(1);

    await expect(back).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.back?.onClick).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(" ");
    await expect(args.back?.onClick).toHaveBeenCalledTimes(3);
  },
};

/** A title alone, without a parent page or a back button. */
export const TitleOnly: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <PageHeader title="Activity" as="h1" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Activity" })
    ).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** While the page's name loads, the trail shows only its parent. */
export const LoadingTitle: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <PageHeader parent="Positions" back={{ label: "Back", onClick: fn() }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("heading", { level: 2 })
    ).toHaveTextContent(/^Positions$/);
  },
};

/** A long name truncates to one line. */
export const LongTitle: Story = {
  args: {
    title: "Ethereum Liquid Staking via a provider with a very long name",
  },
};
