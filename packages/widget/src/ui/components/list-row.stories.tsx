import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ContainerFrame, narrowAndWide } from "../storybook/container-frame";
import {
  isOneLine,
  isTruncated,
  isWithin,
  outlineBox,
  outlineWithin,
  shareLine,
} from "../storybook/geometry";
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

/** A rate of zero or none reads muted, like the subtitle, not as a gain. */
export const WithMutedFigure: Story = {
  args: { figure: { text: "—", tone: "muted" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const colorOf = (text: string) =>
      getComputedStyle(canvas.getByText(text)).color;
    await expect(colorOf("—")).toBe(colorOf("Lido"));
  },
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

const longRow = {
  title: "Liquid staked Ether by a provider with a long name",
  subtitle: "via Lido",
  value: "12,345,678.1234 ETH",
  subvalue: "$40,123,456.78",
};

/**
 * At the `sm` container size a long title truncates while a long value and
 * the figure before it stay on one line, inside the row.
 */
export const LongTitleAndValue: Story = {
  args: { ...longRow, figure: { text: "3.21%", tone: "success" } },
  render: (args) => (
    <ContainerFrame width={400}>
      <ListRow {...args} testId="row" />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByTestId("row").getBoundingClientRect();
    const title = canvas.getByText(longRow.title);
    const value = canvas.getByText(longRow.value);
    const figure = canvas.getByText("3.21%");

    await expect(isTruncated(title)).toBe(true);
    await expect(isOneLine(value)).toBe(true);
    await expect(isOneLine(canvas.getByText(longRow.subvalue))).toBe(true);
    await expect(isOneLine(figure)).toBe(true);
    await expect(shareLine(figure, value)).toBe(true);
    await expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(
      figure.getBoundingClientRect().left
    );
    await expect(isWithin(value.getBoundingClientRect(), row)).toBe(true);
  },
};

export const LongTitleAndValueDark: Story = {
  ...LongTitleAndValue,
  globals: { colorScheme: "dark" },
};

/**
 * Below the `sm` container size badges move to the second line, so the
 * title keeps the first; from `sm` they follow the title.
 */
export const BadgesBelowSm: Story = {
  args: {
    ...longRow,
    badges: (
      <Badge tone="warning" variant="soft">
        Pending
      </Badge>
    ),
  },
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
    const canvas = within(canvasElement);
    const [narrowTitle, wideTitle] = narrowAndWide(
      canvas.getAllByText(longRow.title)
    );
    const [narrowBadge, wideBadge] = narrowAndWide(
      canvas.getAllByText("Pending")
    );
    const [narrowSubtitle] = narrowAndWide(canvas.getAllByText("via Lido"));
    const [narrowValue, wideValue] = narrowAndWide(
      canvas.getAllByText(longRow.value)
    );

    await expect(
      narrowBadge.getBoundingClientRect().top
    ).toBeGreaterThanOrEqual(narrowTitle.getBoundingClientRect().bottom);
    await expect(shareLine(narrowBadge, narrowSubtitle)).toBe(true);
    await expect(shareLine(wideBadge, wideTitle)).toBe(true);
    await expect(wideBadge.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      wideTitle.getBoundingClientRect().right
    );
    await expect(isOneLine(narrowValue)).toBe(true);
    await expect(isOneLine(wideValue)).toBe(true);
  },
};

/**
 * `status` follows the subtitle on the second line as colored text with an
 * icon, not a chip.
 */
export const WithStatus: Story = {
  args: {
    ...rowContent,
    subtitle: "via Lido",
    status: { text: "Action required", tone: "warning", icon: "WarningIcon" },
  },
  render: (args) => (
    <ContainerFrame width={400}>
      <ListRow {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const subtitle = canvas.getByText("via Lido");
    const status = canvas.getByText("Action required");
    await expect(shareLine(subtitle, status)).toBe(true);
    await expect(status.getBoundingClientRect().left).toBeGreaterThan(
      subtitle.getBoundingClientRect().right
    );
    await expect(isOneLine(status)).toBe(true);
  },
};

export const WithStatusDark: Story = {
  ...WithStatus,
  globals: { colorScheme: "dark" },
};

/** Every status tone, for review in both schemes. */
export const StatusTones: Story = {
  render: () => (
    <ContainerFrame width={400}>
      <ListGroup>
        <ListRow
          {...rowContent}
          status={{ text: "Completed", tone: "success", icon: "CheckIcon" }}
        />
        <ListRow
          {...rowContent}
          status={{ text: "Pending", tone: "warning", icon: "WarningIcon" }}
        />
        <ListRow
          {...rowContent}
          status={{ text: "Failed", tone: "danger", icon: "XIcon" }}
        />
        <ListRow
          {...rowContent}
          status={{ text: "Unstaking", tone: "info", icon: "InfoIcon" }}
        />
      </ListGroup>
    </ContainerFrame>
  ),
};

export const StatusTonesDark: Story = {
  ...StatusTones,
  globals: { colorScheme: "dark" },
};

const networks = [
  { name: "Ethereum", subtitle: "Connected" },
  { name: "Arbitrum One", subtitle: "Layer 2" },
  { name: "Base", subtitle: "Layer 2" },
];

const onPickNetwork = fn();

/**
 * Condensed rows for a picker, through their group: shorter rows with no
 * surface of their own, and a trailing check, not a ring, on the choice.
 */
export const Condensed: Story = {
  render: () => (
    <ContainerFrame width={400}>
      <ListGroup density="condensed">
        {networks.map((network, index) => (
          <ListRow
            key={network.name}
            leading={
              <TokenAvatar src={tokenLogo} name={network.name} size="control" />
            }
            title={network.name}
            subtitle={network.subtitle}
            onClick={onPickNetwork}
            selected={index === 0}
          />
        ))}
      </ListGroup>
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chosen = canvas.getByRole("button", { name: /Ethereum/ });
    const other = canvas.getByRole("button", { name: /Base/ });

    await expect(chosen).toHaveAttribute("aria-pressed", "true");
    await expect(outlineBox(chosen)).toBeUndefined();
    await expect(chosen.querySelectorAll("svg")).toHaveLength(1);
    await expect(other.querySelectorAll("svg")).toHaveLength(0);
    await expect(chosen.getBoundingClientRect().height).toBeLessThanOrEqual(56);

    await userEvent.click(other);
    await expect(onPickNetwork).toHaveBeenCalled();
  },
};

export const CondensedDark: Story = {
  ...Condensed,
  globals: { colorScheme: "dark" },
};

/**
 * A comfortable row in a picker is `flat`: no surface of its own until
 * hovered, and the accent tint with a trailing check, not a ring, on the
 * choice, so hover and selection read apart.
 */
export const Flat: Story = {
  render: () => (
    <ContainerFrame width={400}>
      <ListGroup>
        {networks.map((network, index) => (
          <ListRow
            key={network.name}
            variant="flat"
            leading={<TokenAvatar src={tokenLogo} name={network.name} />}
            title={network.name}
            subtitle={network.subtitle}
            value="1.25 ETH"
            subvalue="≈ $4,120.50"
            onClick={onPickNetwork}
            selected={index === 0}
          />
        ))}
      </ListGroup>
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chosen = canvas.getByRole("button", { name: /Ethereum/ });
    const other = canvas.getByRole("button", { name: /Base/ });

    await expect(outlineBox(chosen)).toBeUndefined();
    await expect(chosen.querySelectorAll("svg")).toHaveLength(1);
    await expect(getComputedStyle(other).backgroundColor).toMatch(
      /^rgba\(\d+, \d+, \d+, 0\)$/
    );
    await expect(getComputedStyle(chosen).backgroundColor).not.toMatch(
      /^rgba\(\d+, \d+, \d+, 0\)$/
    );
  },
};

export const FlatDark: Story = {
  ...Flat,
  globals: { colorScheme: "dark" },
};

/** The selection ring and the focus ring draw inside the row's edge. */
export const RingsInside: Story = {
  args: { onClick: fn(), selected: true, testId: "row" },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByTestId("row");
    await expect(outlineWithin(row, row.getBoundingClientRect())).toBe(true);
    await userEvent.tab();
    await expect(row).toHaveFocus();
    await expect(outlineWithin(row, row.getBoundingClientRect())).toBe(true);
  },
};
