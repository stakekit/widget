import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import {
  isWithin,
  outlineWithin,
  shareLine,
  viewportBox,
} from "../storybook/geometry";
import { networkLogo, tokenLogo } from "../storybook/images";
import { SelectSheet } from "./select-sheet";
import { TokenTrigger } from "./token-trigger";

const symbols = [
  "ETH",
  "USDC",
  "USDT",
  "DAI",
  "WBTC",
  "stETH",
  "MATIC",
  "SOL",
  "ATOM",
  "DOT",
  "AVAX",
  "NEAR",
];

const tokens = Array.from({ length: 60 }, (_, index) => {
  const symbol = symbols[index % symbols.length] ?? "ETH";
  const round = Math.floor(index / symbols.length);
  const id = round === 0 ? symbol : `${symbol}-${round}`;
  return {
    id,
    title: id,
    subtitle: round === 0 ? "Ethereum" : `Network ${round}`,
    value: `${(index * 1.5).toFixed(2)} ${symbol}`,
    subvalue: `$${(index * 3.25).toFixed(2)}`,
    logo: { name: symbol, src: tokenLogo, networkSrc: networkLogo },
  };
});

type SheetProps = ComponentProps<typeof SelectSheet>;

/** Filters the options by the query and holds the choice, as a Feature would. */
const TokenSheet = ({
  onSelect,
  searchable = true,
  initialId = "ETH",
  ...rest
}: Omit<
  SheetProps,
  "options" | "groups" | "search" | "selectedId" | "multiple"
> & {
  readonly searchable?: boolean;
  readonly initialId?: string;
}) => {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialId);
  const selected = tokens.find((token) => token.id === selectedId);
  const options = tokens.filter((token) =>
    token.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <SelectSheet
      {...rest}
      trigger={
        <TokenTrigger
          token={selected?.logo ?? { name: selectedId }}
          aria-label={`Change token, ${selectedId}`}
        />
      }
      options={options}
      selectedId={selectedId}
      onSelect={(id) => {
        setSelectedId(id);
        onSelect(id);
      }}
      {...(searchable
        ? {
            search: {
              value: query,
              onValueChange: setQuery,
              label: "Search tokens",
              placeholder: "Search",
              clearLabel: "Clear search",
            },
          }
        : {})}
    />
  );
};

const meta = {
  title: "Patterns/SelectSheet",
  component: SelectSheet,
  args: {
    title: "Select a token",
    closeLabel: "Close",
    listLabel: "Tokens",
    onSelect: fn(),
    onOpenChange: fn(),
    empty: { title: "No tokens found", body: "Try another name or symbol." },
    options: [],
  },
  render: ({ options: _options, ...args }) => <TokenSheet {...args} />,
} satisfies Meta<typeof SelectSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

const openSheet = async (canvasElement: HTMLElement, current = "ETH") => {
  await userEvent.click(
    within(canvasElement).getByRole("button", {
      name: `Change token, ${current}`,
    })
  );
  const sheet = await screen.findByRole("dialog", { name: "Select a token" });
  await waitFor(() => expect(sheet).toBeVisible());
  return sheet;
};

/** Opens on the search field; the query narrows the options. */
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    const search = within(sheet).getByRole("combobox", {
      name: "Search tokens",
    });
    await waitFor(() => expect(search).toHaveFocus());

    await userEvent.type(search, "usd");
    const listbox = within(sheet).getByRole("listbox", { name: "Tokens" });
    await waitFor(() =>
      expect(
        within(listbox)
          .getAllByRole("option")
          .map((option) => option.textContent)
      ).toEqual([
        expect.stringContaining("USDC"),
        expect.stringContaining("USDT"),
        expect.stringContaining("USDC-1"),
        expect.stringContaining("USDT-1"),
        expect.stringContaining("USDC-2"),
        expect.stringContaining("USDT-2"),
        expect.stringContaining("USDC-3"),
        expect.stringContaining("USDT-3"),
        expect.stringContaining("USDC-4"),
        expect.stringContaining("USDT-4"),
      ])
    );

    await userEvent.type(search, "zzz");
    await expect(
      await within(sheet).findByRole("heading", { name: "No tokens found" })
    ).toBeVisible();
    // Focus stayed in the field, so the status mounted with it announces it.
    await expect(search).toHaveFocus();
    await expect(search).toHaveAttribute("aria-expanded", "false");
    await expect(within(sheet).getByRole("status")).toHaveTextContent(
      "No tokens found. Try another name or symbol."
    );
  },
};

export const SearchDark: Story = {
  ...Search,
  globals: { colorScheme: "dark" },
};

/** In a bottom sheet below a 520px viewport. */
export const Sheet: Story = {
  ...Search,
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

/**
 * Under the dialog's height cap, the list scrolls and gives way; the search
 * field over it keeps a control's height, its icon inside it.
 */
export const SearchUnderHeightCap: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    // The listbox's parent scrolls it.
    const scroller = within(sheet).getByRole("listbox", {
      name: "Tokens",
    }).parentElement;
    if (!scroller) throw new Error("The listbox has no scroller.");
    await waitFor(() =>
      expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    );
    const search = within(sheet).getByRole("combobox", {
      name: "Search tokens",
    });
    const box = search.parentElement;
    const icon = box?.querySelector("svg");
    if (!box || !icon) throw new Error("The search field has no box or icon.");

    await expect(box.getBoundingClientRect().height).toBe(40);
    await expect(isWithin(icon.getBoundingClientRect(), viewportBox(box))).toBe(
      true
    );
  },
};

export const SearchUnderHeightCapDark: Story = {
  ...SearchUnderHeightCap,
  globals: { colorScheme: "dark" },
};

/**
 * The arrow keys move through the options while focus stays in the search
 * field; Enter chooses one, closes the sheet and returns focus to the trigger.
 */
export const ArrowKeySelection: Story = {
  play: async ({ args, canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    const search = within(sheet).getByRole("combobox", {
      name: "Search tokens",
    });
    await waitFor(() => expect(search).toHaveFocus());
    // It opens on the current choice, ETH.
    await expect(
      sheet.ownerDocument.getElementById(
        search.getAttribute("aria-activedescendant") ?? ""
      )
    ).toHaveTextContent("ETH");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await userEvent.keyboard("{ArrowUp}");
    const activeId = search.getAttribute("aria-activedescendant") ?? "";
    const active = sheet.ownerDocument.getElementById(activeId);
    await expect(active).toHaveTextContent("USDC");
    await expect(search).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith("USDC");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const trigger = within(canvasElement).getByRole("button", {
      name: "Change token, USDC",
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** Moving past the visible rows scrolls the active one into view. */
export const ArrowKeysScroll: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    const search = within(sheet).getByRole("combobox", {
      name: "Search tokens",
    });
    await waitFor(() => expect(search).toHaveFocus());

    // From ETH, the first option, to the thirtieth.
    for (let presses = 0; presses < 29; presses++) {
      await userEvent.keyboard("{ArrowDown}");
    }
    await waitFor(() => {
      const active = sheet.ownerDocument.getElementById(
        search.getAttribute("aria-activedescendant") ?? ""
      );
      return expect(active).toHaveTextContent("stETH-2");
    });
  },
};

/** Escape first clears the query, then closes the sheet. */
export const Escape: Story = {
  play: async ({ args, canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    const search = within(sheet).getByRole("combobox", {
      name: "Search tokens",
    });
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.type(search, "dai");

    await userEvent.keyboard("{Escape}");
    await expect(search).toHaveValue("");
    await expect(sheet).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

/** A pointer chooses an option directly. */
export const PointerSelection: Story = {
  play: async ({ args, canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await userEvent.click(
      within(sheet).getByRole("option", { name: /^DAI Ethereum/ })
    );
    await expect(args.onSelect).toHaveBeenCalledWith("DAI");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/** The current choice reads as selected. */
export const Selected: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await expect(
      within(sheet).getByRole("option", { name: /^ETH Ethereum/ })
    ).toHaveAttribute("aria-selected", "true");
  },
};

/** It opens on the current choice, deep in the list, scrolled into view. */
export const SelectedInView: Story = {
  render: ({ options: _options, ...args }) => (
    <TokenSheet {...args} initialId="SOL-3" />
  ),
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement, "SOL-3");
    const search = within(sheet).getByRole("combobox", {
      name: "Search tokens",
    });
    const listbox = within(sheet).getByRole("listbox", { name: "Tokens" });
    await waitFor(async () => {
      const option = within(listbox).getByRole("option", {
        name: /^SOL-3 Network 3/,
      });
      await expect(option).toHaveAttribute("aria-selected", "true");
      await expect(search).toHaveAttribute("aria-activedescendant", option.id);
      const scroller = listbox.parentElement ?? listbox;
      const box = scroller.getBoundingClientRect();
      const optionBox = option.getBoundingClientRect();
      await expect(optionBox.top).toBeGreaterThanOrEqual(box.top);
      await expect(optionBox.bottom).toBeLessThanOrEqual(box.bottom);
    });
  },
};

/** Without a search field, each option is a button in a list. */
export const WithoutSearch: Story = {
  render: ({ options: _options, ...args }) => (
    <TokenSheet {...args} searchable={false} />
  ),
  play: async ({ args, canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    await expect(within(sheet).queryByRole("combobox")).toBeNull();
    await userEvent.click(within(sheet).getByRole("button", { name: /^SOL/ }));
    await expect(args.onSelect).toHaveBeenCalledWith("SOL");
  },
};

/** Options in titled groups, with disabled options skipped by the keys. */
export const Groups: Story = {
  render: (args) => (
    <SelectSheet
      title="Select a validator"
      closeLabel="Close"
      listLabel="Validators"
      onSelect={args.onSelect}
      trigger={<TokenTrigger token={{ name: "Validators" }} />}
      search={{
        value: "",
        onValueChange: fn(),
        label: "Search validators",
        clearLabel: "Clear search",
      }}
      groups={[
        {
          key: "preferred",
          label: "Preferred",
          options: [
            { id: "figment", title: "Figment", subtitle: "Commission 5%" },
            {
              id: "full",
              title: "Full validator",
              subtitle: "Not accepting stake",
              disabled: true,
            },
          ],
        },
        {
          key: "all",
          label: "All validators",
          options: [
            {
              id: "chorus",
              title: "Chorus One",
              badges: [{ label: "Top", tone: "accent" }],
            },
            { id: "p2p", title: "P2P" },
          ],
        },
      ]}
    />
  ),
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Validators" })
    );
    const sheet = await screen.findByRole("dialog", {
      name: "Select a validator",
    });
    const search = within(sheet).getByRole("combobox");
    await waitFor(() => expect(search).toHaveFocus());
    await waitFor(() =>
      expect(
        // Each option also holds its group's title, hidden, as its description.
        within(sheet).getByText("Preferred", {
          ignore: "script, style, [hidden]",
        })
      ).toBeVisible()
    );
    await expect(
      within(sheet).getByRole("option", { name: /^Full validator/ })
    ).toHaveAttribute("aria-disabled", "true");

    // Each option names its group, and its place in the whole list.
    const figment = within(sheet).getByRole("option", { name: /^Figment/ });
    await expect(figment).toHaveAccessibleDescription("Preferred");
    await expect(figment).toHaveAttribute("aria-posinset", "1");
    await expect(figment).toHaveAttribute("aria-setsize", "4");
    const p2p = within(sheet).getByRole("option", { name: /^P2P/ });
    await expect(p2p).toHaveAccessibleDescription("All validators");
    await expect(p2p).toHaveAttribute("aria-posinset", "4");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith("chorus");
  },
};

/** While the options load, a spinner names what is loading. */
export const Loading: Story = {
  render: ({ options: _options, groups: _groups, ...args }) => (
    <SelectSheet
      {...args}
      open
      loading
      loadingLabel="Loading tokens"
      options={[]}
    />
  ),
  play: async () => {
    const sheet = await screen.findByRole("dialog", { name: "Select a token" });
    await expect(
      within(sheet).getByRole("status", { name: "Loading tokens" })
    ).toBeVisible();
  },
};

/** More options load as the last one scrolls into view. */
export const LoadMore: Story = {
  args: { onEndReached: fn() },
  render: ({ options: _options, groups: _groups, ...args }) => (
    <SelectSheet
      {...args}
      open
      options={tokens.slice(0, 4)}
      hasMore
      loadingMoreLabel="Loading more tokens"
    />
  ),
  play: async ({ args }) => {
    await screen.findByRole("dialog", { name: "Select a token" });
    await waitFor(() => expect(args.onEndReached).toHaveBeenCalled());
    // The caller loads nothing more, so it isn't asked again for the same rows.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(args.onEndReached).toHaveBeenCalledOnce();
  },
};

/** While more options load, a spinner shows and no more are asked for. */
export const LoadingMore: Story = {
  args: { onEndReached: fn() },
  render: ({ options: _options, groups: _groups, ...args }) => (
    <SelectSheet
      {...args}
      open
      options={tokens.slice(0, 4)}
      hasMore
      loadingMore
      loadingMoreLabel="Loading more tokens"
      search={{
        value: "",
        onValueChange: fn(),
        label: "Search tokens",
        clearLabel: "Clear search",
      }}
    />
  ),
  play: async ({ args }) => {
    const sheet = await screen.findByRole("dialog", { name: "Select a token" });
    await expect(
      within(sheet).getByRole("status", { name: "Loading more tokens" })
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(args.onEndReached).not.toHaveBeenCalled();
    // While more may load, the options' set size is unknown.
    await expect(
      within(sheet).getByRole("option", { name: /^ETH/ })
    ).toHaveAttribute("aria-setsize", "-1");
  },
};

const onRetry = fn();

/** When the options failed to load, an error with a retry shows instead. */
export const LoadError: Story = {
  render: ({ options: _options, groups: _groups, ...args }) => (
    <SelectSheet
      {...args}
      open
      options={[]}
      error={{
        title: "Couldn't load tokens",
        body: "Check your connection and try again.",
        action: { label: "Try again", onClick: onRetry },
      }}
    />
  ),
  play: async () => {
    onRetry.mockClear();
    const sheet = await screen.findByRole("dialog", { name: "Select a token" });
    await expect(within(sheet).getByRole("alert")).toHaveTextContent(
      "Couldn't load tokens"
    );
    await expect(
      within(sheet).queryByRole("heading", { name: "No tokens found" })
    ).toBeNull();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Try again" })
    );
    await expect(onRetry).toHaveBeenCalledOnce();
  },
};

const validatorOptions = [
  {
    id: "figment",
    title: "Figment",
    value: "5.10%",
    subvalue: "APY",
    details: [
      { label: "Commission", value: "5%" },
      { label: "Staked", value: "1,204,330 SOL" },
      { label: "Voting power", value: "1.2%" },
    ],
  },
  {
    id: "chorus",
    title: "Chorus One",
    value: "4.90%",
    subvalue: "APY",
    details: [
      { label: "Commission", value: "7%" },
      { label: "Staked", value: "980,112 SOL" },
    ],
  },
  {
    id: "p2p",
    title: "P2P",
    value: "4.80%",
    subvalue: "APY",
    details: [{ label: "Commission", value: "8%" }],
  },
];

/** Holds several choices, as a validator selection taking more than one. */
const ValidatorsSheet = ({
  onSelect,
  onConfirm,
  searchable,
}: {
  readonly onSelect: (id: string) => void;
  readonly onConfirm: () => void;
  readonly searchable: boolean;
}) => {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(["figment"])
  );
  return (
    <SelectSheet
      title="Select validators"
      closeLabel="Close"
      listLabel="Validators"
      trigger={<TokenTrigger token={{ name: "Validators" }} />}
      options={validatorOptions}
      multiple={{ selectedIds }}
      onSelect={(id) => {
        onSelect(id);
        const next = new Set(selectedIds);
        if (!next.delete(id)) next.add(id);
        setSelectedIds(next);
      }}
      footer={{
        label: `Confirm ${selectedIds.size}`,
        variant: "primary",
        onClick: onConfirm,
      }}
      {...(searchable
        ? {
            search: {
              value: "",
              onValueChange: fn(),
              label: "Search validators",
              clearLabel: "Clear search",
            },
          }
        : {})}
    />
  );
};

const onConfirm = fn();

const openValidators = async (canvasElement: HTMLElement) => {
  await userEvent.click(
    within(canvasElement).getByRole("button", { name: "Validators" })
  );
  const sheet = await screen.findByRole("dialog", {
    name: "Select validators",
  });
  await waitFor(() => expect(sheet).toBeVisible());
  return sheet;
};

/**
 * With `multiple`, choosing toggles an option's check and the sheet stays
 * open; the footer confirms. Each option shows its detail rows.
 */
export const MultipleChoices: Story = {
  render: (args) => (
    <ValidatorsSheet
      onSelect={args.onSelect}
      onConfirm={onConfirm}
      searchable
    />
  ),
  play: async ({ args, canvasElement }) => {
    onConfirm.mockClear();
    const sheet = await openValidators(canvasElement);
    const listbox = within(sheet).getByRole("listbox", { name: "Validators" });
    await expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    await expect(
      within(listbox).getByRole("option", { name: /^Figment/ })
    ).toHaveAccessibleName(/Commission\s*5%/);

    // It opens on the first choice; Down then Enter checks Chorus One.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith("chorus");
    await expect(sheet).toBeVisible();
    await expect(
      within(listbox).getByRole("option", { name: /^Chorus One/ })
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      within(listbox).getByRole("option", { name: /^Figment/ })
    ).toHaveAttribute("aria-selected", "true");

    await userEvent.click(
      within(listbox).getByRole("option", { name: /^Figment/ })
    );
    await expect(
      within(listbox).getByRole("option", { name: /^Figment/ })
    ).toHaveAttribute("aria-selected", "false");
    await expect(sheet).toBeVisible();

    await userEvent.click(
      within(sheet).getByRole("button", { name: "Confirm 1" })
    );
    await expect(onConfirm).toHaveBeenCalledOnce();
  },
};

export const MultipleChoicesDark: Story = {
  ...MultipleChoices,
  globals: { colorScheme: "dark" },
};

/** Without a search field, several choices are toggle buttons. */
export const MultipleChoicesWithoutSearch: Story = {
  render: (args) => (
    <ValidatorsSheet
      onSelect={args.onSelect}
      onConfirm={onConfirm}
      searchable={false}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const sheet = await openValidators(canvasElement);
    const p2p = within(sheet).getByRole("button", { name: /^P2P/ });
    await expect(p2p).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(p2p);
    await expect(args.onSelect).toHaveBeenCalledWith("p2p");
    await expect(sheet).toBeVisible();
    await expect(
      within(sheet).getByRole("button", { name: /^P2P/ })
    ).toHaveAttribute("aria-pressed", "true");
  },
};

const onViewAll = fn();

/**
 * Several footer buttons stack in order, and one may be disabled. Test ids
 * name the sheet, its title, its search field and each option.
 */
export const FooterActionsAndTestIds: Story = {
  render: (args) => (
    <SelectSheet
      title="Select validators"
      closeLabel="Close"
      listLabel="Validators"
      trigger={<TokenTrigger token={{ name: "Validators" }} />}
      options={validatorOptions.map((option) => ({
        ...option,
        testId: `validator-${option.id}`,
      }))}
      multiple={{ selectedIds: new Set<string>() }}
      onSelect={args.onSelect}
      search={{
        value: "",
        onValueChange: fn(),
        label: "Search validators",
        clearLabel: "Clear search",
      }}
      testIds={{
        container: "sheet",
        title: "sheet-title",
        search: "sheet-search",
      }}
      footer={[
        { label: "View all", onClick: onViewAll },
        {
          label: "Confirm",
          variant: "primary",
          onClick: onConfirm,
          disabled: true,
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    onViewAll.mockClear();
    const sheet = await openValidators(canvasElement);
    await expect(sheet).toHaveAttribute("data-testid", "sheet");
    await expect(within(sheet).getByTestId("sheet-title")).toHaveTextContent(
      "Select validators"
    );
    await expect(within(sheet).getByTestId("sheet-search")).toHaveRole(
      "combobox"
    );
    await expect(
      within(sheet).getByTestId("validator-figment")
    ).toHaveAttribute("role", "option");

    await expect(
      within(sheet).getByRole("button", { name: "Confirm" })
    ).toBeDisabled();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "View all" })
    );
    await expect(onViewAll).toHaveBeenCalledOnce();
  },
};

const validatorAddress = "cosmosvaloper1abcdefghijklmnopqrstuvwxyz0123456789";

const copyableValidators = [
  {
    id: "figment",
    title: "Figment",
    value: "5.10%",
    details: [
      { label: "Commission", value: "5%" },
      {
        label: "Address",
        value: "cosmosva…23456789",
        copy: {
          value: validatorAddress,
          label: "Copy address",
          copiedLabel: "Copied",
        },
      },
    ],
  },
  { id: "p2p", title: "P2P", value: "4.80%" },
];

/** Replaces the clipboard, so nothing leaves the page. */
const stubClipboard = () => {
  const clipboard = navigator.clipboard;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: fn(async (_text: string) => {}) },
  });

  return () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    });
  };
};

/**
 * In a listbox, a press on a detail's copy icon copies the full value in
 * place of choosing the option; the option still reads the value it shows.
 */
export const CopyDetail: Story = {
  beforeEach: stubClipboard,
  render: (args) => (
    <SelectSheet
      title="Select a validator"
      closeLabel="Close"
      listLabel="Validators"
      open
      options={copyableValidators}
      selectedId="p2p"
      onSelect={args.onSelect}
      search={{
        value: "",
        onValueChange: fn(),
        label: "Search validators",
        clearLabel: "Clear search",
      }}
    />
  ),
  play: async ({ args }) => {
    const sheet = await screen.findByRole("dialog", {
      name: "Select a validator",
    });
    await expect(
      within(sheet).getByRole("option", { name: /^Figment/ })
    ).toHaveAccessibleName(/Address\s*cosmosva…23456789/);

    await userEvent.click(within(sheet).getByTitle("Copy address"));

    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      validatorAddress
    );
    await expect(args.onSelect).not.toHaveBeenCalled();
    await expect(sheet).toBeVisible();
  },
};

/** Without a search field, a copy button follows the row, outside it. */
export const CopyDetailWithoutSearch: Story = {
  beforeEach: stubClipboard,
  render: (args) => (
    <SelectSheet
      title="Select a validator"
      closeLabel="Close"
      listLabel="Validators"
      open
      options={copyableValidators}
      selectedId="p2p"
      onSelect={args.onSelect}
    />
  ),
  play: async ({ args }) => {
    const sheet = await screen.findByRole("dialog", {
      name: "Select a validator",
    });

    await userEvent.click(
      within(sheet).getByRole("button", { name: "Copy address" })
    );

    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      validatorAddress
    );
    await expect(args.onSelect).not.toHaveBeenCalled();
    await expect(
      within(sheet).getByRole("button", { name: /^Figment/ })
    ).toHaveAttribute("aria-pressed", "false");
  },
};

/**
 * While options load to replace those shown, such as for a new query, a
 * spinner names the work and the current options stay.
 */
export const LoadingWithOptions: Story = {
  render: ({ options: _options, groups: _groups, ...args }) => (
    <SelectSheet
      {...args}
      open
      loading
      loadingLabel="Loading tokens"
      options={tokens.slice(0, 4)}
      search={{
        value: "E",
        onValueChange: fn(),
        label: "Search tokens",
        clearLabel: "Clear search",
      }}
    />
  ),
  play: async () => {
    const sheet = await screen.findByRole("dialog", { name: "Select a token" });
    await expect(
      within(sheet).getByRole("status", { name: "Loading tokens" })
    ).toBeVisible();
    await expect(
      within(sheet).getByRole("option", { name: /^ETH/ })
    ).toBeVisible();
  },
};

/**
 * The option the keys reached draws its focus ring inside the scrolling
 * list, also the first one, at the list's top edge.
 */
export const ActiveRingInside: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await openSheet(canvasElement);
    const listbox = within(sheet).getByRole("listbox", { name: "Tokens" });
    const scroller = listbox.parentElement ?? listbox;
    await waitFor(async () => {
      const first = within(listbox).getByRole("option", {
        name: /^ETH Ethereum/,
      });
      await expect(outlineWithin(first, viewportBox(scroller))).toBe(true);
    });
    await userEvent.keyboard("{ArrowDown}");
    const second = within(listbox).getByRole("option", {
      name: /^USDC Ethereum/,
    });
    await expect(outlineWithin(second, viewportBox(scroller))).toBe(true);
  },
};

/**
 * A group with `logo` heads its run with the token's avatar and symbol in
 * normal case, and `caption` at the header's end.
 */
export const GroupHeaderWithLogo: Story = {
  render: ({ options: _options, groups: _groups, ...args }) => (
    <SelectSheet
      {...args}
      open
      title="Select a market"
      listLabel="Markets"
      groups={[
        {
          key: "usdc",
          label: "USDC",
          logo: { name: "USDC", src: tokenLogo },
          caption: "from 0.02%",
          options: [
            { id: "usdc-eth", title: "ETH collateral", value: "0.02%" },
            { id: "usdc-wbtc", title: "WBTC collateral", value: "0.04%" },
          ],
        },
        {
          key: "eth",
          label: "ETH",
          logo: { name: "ETH", src: tokenLogo },
          caption: "from 1.20%",
          options: [
            { id: "eth-usdc", title: "USDC collateral", value: "1.20%" },
          ],
        },
      ]}
    />
  ),
  play: async () => {
    const sheet = await screen.findByRole("dialog", {
      name: "Select a market",
    });
    await waitFor(() => expect(sheet).toBeVisible());
    const label = within(sheet).getByText("USDC");
    const caption = within(sheet).getByText("from 0.02%");
    await expect(getComputedStyle(label).textTransform).toBe("none");
    await expect(shareLine(label, caption)).toBe(true);
    await expect(caption.getBoundingClientRect().left).toBeGreaterThan(
      label.getBoundingClientRect().right
    );
  },
};

export const GroupHeaderWithLogoDark: Story = {
  ...GroupHeaderWithLogo,
  globals: { colorScheme: "dark" },
};
