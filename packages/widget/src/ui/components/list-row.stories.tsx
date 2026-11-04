import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ContainerFrame, narrowAndWide } from "../storybook/container-frame";
import { tokenLogo } from "../storybook/images";
import { TokenAvatar } from "./avatar";
import { Badge } from "./badge";
import { ListGroup, ListRow } from "./list-row";

const rowContent = {
  leading: <TokenAvatar src={tokenLogo} name="ETH" />,
  title: "Ethereum",
  subtitle: "Lido",
  value: "1.2345 ETH",
  subvalue: "$4,012.33",
};

const meta = {
  title: "Components/ListRow",
  component: ListRow,
  args: rowContent,
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

const onLinkClick = fn((event: { preventDefault: () => void }) =>
  event.preventDefault()
);

/** With `link` the row is a link: Tab reaches it, Enter follows it. */
export const Link: Story = {
  args: { link: { href: "#position", onClick: onLinkClick } },
  play: async ({ canvasElement }) => {
    onLinkClick.mockClear();
    const row = within(canvasElement).getByRole("link", { name: /Ethereum/ });
    await expect(row).toHaveAttribute("href", "#position");
    await userEvent.tab();
    await expect(row).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(onLinkClick).toHaveBeenCalledTimes(1);
  },
};

export const LinkDark: Story = { ...Link, globals: { colorScheme: "dark" } };

/** A figure, such as a reward rate, before the value column. */
export const WithFigure: Story = {
  args: { figure: { text: "4.2%", tone: "success" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4.2%")).toBeVisible();
    await expect(canvas.getByText("1.2345 ETH").parentElement).not.toBe(
      canvas.getByText("4.2%").parentElement
    );
  },
};

export const WithFigureDark: Story = {
  ...WithFigure,
  globals: { colorScheme: "dark" },
};

/**
 * With `from: "sm"` the figure shows only from the `sm` container size up:
 * a narrow row keeps room for its title.
 */
export const FigureFromSm: Story = {
  args: { figure: { text: "+0.5 ETH", tone: "success", from: "sm" } },
  render: (args) => (
    <>
      <ContainerFrame width={360}>
        <ListRow {...args} />
      </ContainerFrame>
      <ContainerFrame width={480}>
        <ListRow {...args} />
      </ContainerFrame>
    </>
  ),
  play: async ({ canvasElement }) => {
    const [narrow, wide] = narrowAndWide(
      within(canvasElement).getAllByText("+0.5 ETH")
    );
    await expect(narrow).not.toBeVisible();
    await expect(wide).toBeVisible();
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

const onSelectOption = fn();

/**
 * Options of a listbox a combobox owns: the one its keys reached shows the
 * focus ring, the chosen one reads as selected, and a press chooses one.
 */
export const Options: Story = {
  render: () => (
    <div role="listbox" aria-label="Tokens">
      <ListRow
        {...rowContent}
        option={{
          id: "eth",
          selected: false,
          active: true,
          onSelect: onSelectOption,
        }}
      />
      <ListRow
        {...rowContent}
        title="Solana"
        option={{
          id: "sol",
          selected: true,
          active: false,
          onSelect: onSelectOption,
        }}
      />
      <ListRow
        {...rowContent}
        title="Polygon"
        option={{
          id: "pol",
          selected: false,
          active: false,
          onSelect: onSelectOption,
          disabled: true,
        }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onSelectOption.mockClear();
    const listbox = within(canvasElement).getByRole("listbox", {
      name: "Tokens",
    });
    const [eth, sol, pol] = within(listbox).getAllByRole("option");
    await expect(sol).toHaveAttribute("aria-selected", "true");
    await expect(pol).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(eth ?? listbox);
    await expect(onSelectOption).toHaveBeenCalledOnce();
    await userEvent.click(pol ?? listbox);
    await expect(onSelectOption).toHaveBeenCalledOnce();
  },
};

export const OptionsDark: Story = {
  ...Options,
  globals: { colorScheme: "dark" },
};

/** Detail rows under the main line, such as a validator's figures. */
export const WithDetails: Story = {
  args: {
    details: [
      { label: "Commission", value: "5%" },
      { label: "Staked", value: "1,204,330 SOL" },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Commission")).toBeVisible();
    await expect(
      within(canvasElement).getByText("1,204,330 SOL")
    ).toBeVisible();
  },
};

export const WithDetailsDark: Story = {
  ...WithDetails,
  globals: { colorScheme: "dark" },
};

/**
 * Options of a listbox taking several choices: a check box shows each
 * option's selection. Each names its group and its place in the whole list,
 * of which only some rows render.
 */
export const CheckOptions: Story = {
  render: () => (
    <div role="listbox" aria-label="Validators" aria-multiselectable>
      <ListRow
        {...rowContent}
        title="Figment"
        option={{
          id: "figment",
          selected: true,
          active: false,
          check: true,
          groupLabel: "Preferred",
          position: { index: 0, count: 40 },
          onSelect: onSelectOption,
        }}
      />
      <ListRow
        {...rowContent}
        title="Chorus One"
        option={{
          id: "chorus",
          selected: false,
          active: true,
          check: true,
          groupLabel: "All validators",
          position: { index: 1 },
          onSelect: onSelectOption,
        }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [figment, chorus] = within(canvasElement).getAllByRole("option");
    await expect(figment).toHaveAttribute("aria-selected", "true");
    await expect(figment).toHaveAccessibleDescription("Preferred");
    await expect(figment).toHaveAttribute("aria-posinset", "1");
    await expect(figment).toHaveAttribute("aria-setsize", "40");
    await expect(chorus).toHaveAttribute("aria-selected", "false");
    await expect(chorus).toHaveAccessibleDescription("All validators");
    // While more may load, the set size is unknown.
    await expect(chorus).toHaveAttribute("aria-setsize", "-1");
  },
};

export const CheckOptionsDark: Story = {
  ...CheckOptions,
  globals: { colorScheme: "dark" },
};

/** A disabled option takes no press, and doesn't scale as if pressed. */
export const DisabledOption: Story = {
  render: () => (
    <div role="listbox" aria-label="Tokens">
      <ListRow
        {...rowContent}
        option={{
          id: "eth",
          selected: false,
          active: false,
          onSelect: onSelectOption,
          disabled: true,
        }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onSelectOption.mockClear();
    const option = within(canvasElement).getByRole("option");
    await userEvent.pointer({ keys: "[MouseLeft>]", target: option });
    await expect(getComputedStyle(option).transform).toBe("none");
    await userEvent.pointer({ keys: "[/MouseLeft]", target: option });
    await expect(onSelectOption).not.toHaveBeenCalled();
  },
};

/** While `busy`, the row reads as busy and shows a spinner at its end. */
export const Busy: Story = {
  render: ({ leading, title }) => (
    <ListRow
      leading={leading}
      title={title}
      subtitle={rowContent.subtitle}
      busy
      testId="row"
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("row")).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

/** A `link` with `newTab` opens another site's page in a new tab. */
export const NewTabLink: Story = {
  args: { link: { href: "https://example.com", newTab: true } },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: /Ethereum/ });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  },
};
