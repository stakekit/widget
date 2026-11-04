import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { tokenLogo } from "../storybook/images";
import { TokenAvatar } from "./avatar";
import { Badge } from "./badge";
import { ListGroup, ListRow } from "./list-row";

const meta = {
  title: "Components/ListRow",
  component: ListRow,
  args: {
    leading: <TokenAvatar src={tokenLogo} name="ETH" />,
    title: "Ethereum",
    subtitle: "Lido",
    value: "1.2345 ETH",
    subvalue: "$4,012.33",
  },
} satisfies Meta<typeof ListRow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Static: Story = {};

export const StaticDark: Story = { globals: { colorScheme: "dark" } };

export const WithBadges: Story = {
  args: {
    badges: (
      <Badge tone="success" variant="soft">
        Claimable
      </Badge>
    ),
  },
};

export const TitleOnly: Story = {
  render: ({ leading, title }) => <ListRow leading={leading} title={title} />,
};

/** With `onClick` the row is a button: Tab reaches it, Enter presses it. */
export const Interactive: Story = {
  args: { onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole("button", { name: /Ethereum/ });
    await userEvent.tab();
    await expect(row).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Selected: Story = {
  args: { onClick: fn(), selected: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Ethereum/ })
    ).toHaveAttribute("aria-pressed", "true");
  },
};

export const SelectedDark: Story = {
  ...Selected,
  globals: { colorScheme: "dark" },
};

export const Disabled: Story = { args: { onClick: fn(), disabled: true } };

/** Rows in a group read as one list under its heading. */
export const Group: Story = {
  render: (args) => (
    <ListGroup label="Your positions">
      <ListRow {...args} />
      <ListRow
        {...args}
        leading={<TokenAvatar name="SOL" />}
        title="Solana"
        subtitle="Native staking"
        value="20 SOL"
        subvalue="$3,100.00"
      />
    </ListGroup>
  ),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", {
      name: "Your positions",
    });
    await expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  },
};

export const GroupDark: Story = { ...Group, globals: { colorScheme: "dark" } };
