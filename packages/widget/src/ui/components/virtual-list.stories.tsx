import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ContainerFrame } from "../storybook/container-frame";
import {
  isOneLine,
  isTruncated,
  outlineWithin,
  shareLine,
  viewportBox,
} from "../storybook/geometry";
import { tokenLogo } from "../storybook/images";
import { TokenAvatar } from "./avatar";
import { ListRow } from "./list-row";
import { VirtualList, type VirtualListGroup } from "./virtual-list";

type Validator = { readonly id: string; readonly name: string };

const validators = (from: number, count: number): ReadonlyArray<Validator> =>
  Array.from({ length: count }, (_, offset) => ({
    id: `validator-${from + offset}`,
    name: `Validator ${from + offset + 1}`,
  }));

const groups: ReadonlyArray<VirtualListGroup<Validator>> = [
  { key: "preferred", label: "Preferred", items: validators(0, 30) },
  { key: "active", label: "Active", items: validators(30, 60) },
  { key: "jailed", label: "Jailed", items: validators(90, 30) },
];

const renderRow = (validator: Validator) => (
  <ListRow title={validator.name} subtitle="Commission 5%" value="4.20%" />
);

/** The list with a fixed set of items, at the height of a select sheet. */
const FlatList = ({ activeIndex }: { readonly activeIndex?: number }) => (
  <div style={{ width: 360 }}>
    <VirtualList
      label="Validators"
      items={validators(0, 1000)}
      getKey={(validator) => validator.id}
      renderItem={renderRow}
      maxHeight="md"
      {...(activeIndex === undefined ? {} : { activeIndex })}
    />
  </div>
);

const meta = {
  title: "Components/VirtualList",
  component: FlatList,
} satisfies Meta<typeof FlatList>;
export default meta;

type Story = StoryObj<typeof meta>;

const region = (canvasElement: HTMLElement, name = "Validators") =>
  within(canvasElement).getByRole("region", { name });

/** A thousand items render only the rows in view, in a named region. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const list = within(region(canvasElement)).getByRole("list");
    const rows = within(list).getAllByRole("listitem");

    await expect(rows.length).toBeGreaterThan(0);
    await expect(rows.length).toBeLessThan(50);
    await expect(within(list).getByText("Validator 1")).toBeVisible();
  },
};

export const Dark: Story = { globals: { colorScheme: "dark" } };

/** `activeIndex` scrolls the item arrow keys select into view. */
export const ActiveItem: Story = {
  args: { activeIndex: 500 },
  play: async ({ canvasElement }) => {
    const scroller = region(canvasElement);
    await waitFor(async () => {
      const row = within(scroller).getByText("Validator 501");
      const rowBox = row.getBoundingClientRect();
      const box = scroller.getBoundingClientRect();
      await expect(rowBox.top).toBeGreaterThanOrEqual(box.top);
      await expect(rowBox.bottom).toBeLessThanOrEqual(box.bottom);
    });
  },
};

/** Items in titled groups; the titles scroll with their items. */
export const Groups: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Validators"
        groups={groups}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const scroller = region(canvasElement);
    await expect(within(scroller).getByText("Preferred")).toBeVisible();

    scroller.scrollTop = scroller.scrollHeight / 2;
    await waitFor(() =>
      expect(within(scroller).queryByText("Preferred")).toBeNull()
    );
  },
};

/** With `stickyHeaders`, the current group's title stays at the top. */
export const StickyHeaders: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Validators"
        groups={groups}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        stickyHeaders
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const scroller = region(canvasElement);
    // Halfway down is deep in the "Active" group, far below its title.
    scroller.scrollTop = scroller.scrollHeight / 2;
    await waitFor(() =>
      expect(within(scroller).queryByText("Validator 31")).toBeNull()
    );

    await waitFor(async () => {
      const title = within(scroller).getByText("Active");
      await expect(
        Math.round(title.getBoundingClientRect().top)
      ).toBeGreaterThanOrEqual(
        Math.round(scroller.getBoundingClientRect().top)
      );
      await expect(title.getBoundingClientRect().top).toBeLessThan(
        scroller.getBoundingClientRect().top + 48
      );
    });
  },
};

const longName = "Validator with a very long name that cannot fit the row";

/**
 * In a 400px container a row's long title truncates and its long value stays
 * on one line; the focus and selection rings draw inside the scrolling
 * region, which would clip a ring drawn outside the row.
 */
export const RingsInsideViewport: Story = {
  render: () => (
    <ContainerFrame width={400}>
      <VirtualList
        label="Validators"
        items={validators(0, 40)}
        getKey={(validator) => validator.id}
        renderItem={(validator, index) => (
          <ListRow
            title={index === 0 ? longName : validator.name}
            subtitle="Commission 5%"
            value="1,234,567.891 ETH"
            onClick={fn()}
            selected={index === 1}
            testId={validator.id}
          />
        )}
        maxHeight="md"
      />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const scroller = region(canvasElement);
    const first = within(scroller).getByTestId("validator-0");
    const selected = within(scroller).getByTestId("validator-1");

    await expect(isTruncated(within(first).getByText(longName))).toBe(true);
    for (const value of within(scroller).getAllByText("1,234,567.891 ETH")) {
      await expect(isOneLine(value)).toBe(true);
    }
    await expect(outlineWithin(selected, viewportBox(scroller))).toBe(true);

    // The region is the first tab stop, its first row the next.
    await userEvent.tab();
    await userEvent.tab();
    await expect(first).toHaveFocus();
    await expect(outlineWithin(first, viewportBox(scroller))).toBe(true);
  },
};

export const RingsInsideViewportDark: Story = {
  ...RingsInsideViewport,
  globals: { colorScheme: "dark" },
};

/**
 * A group with `leading` heads its run with the avatar and its title in
 * normal case, and `caption` at the header's end.
 */
export const GroupHeaderWithAvatar: Story = {
  render: () => (
    <ContainerFrame width={400}>
      <VirtualList
        label="Markets"
        groups={[
          {
            key: "usdc",
            label: "USDC",
            leading: <TokenAvatar src={tokenLogo} name="USDC" size="control" />,
            caption: "from 0.02%",
            items: validators(0, 3),
          },
          {
            key: "eth",
            label: "ETH",
            leading: <TokenAvatar src={tokenLogo} name="ETH" size="control" />,
            caption: "from 1.20%",
            items: validators(3, 3),
          },
        ]}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        stickyHeaders
      />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const scroller = region(canvasElement, "Markets");
    const label = within(scroller).getByText("USDC");
    const caption = within(scroller).getByText("from 0.02%");
    const header = viewportBox(scroller);

    await expect(getComputedStyle(label).textTransform).toBe("none");
    await expect(shareLine(label, caption)).toBe(true);
    // The caption ends the header, past the middle of the list.
    await expect(caption.getBoundingClientRect().left).toBeGreaterThan(
      (header.left + header.right) / 2
    );
    await expect(caption.getBoundingClientRect().right).toBeLessThanOrEqual(
      header.right
    );
  },
};

export const GroupHeaderWithAvatarDark: Story = {
  ...GroupHeaderWithAvatar,
  globals: { colorScheme: "dark" },
};

const onEndReached = fn();

/** A list that fetches another page when its last row scrolls into view. */
const PagedList = () => {
  const [items, setItems] = useState(() => validators(0, 20));
  const [loadingMore, setLoadingMore] = useState(false);
  return (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Validators"
        items={items}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        hasMore={items.length < 60}
        loadingMore={loadingMore}
        loadingMoreLabel="Loading more validators"
        onEndReached={() => {
          onEndReached();
          setLoadingMore(true);
          setTimeout(() => {
            setItems((current) => [
              ...current,
              ...validators(current.length, 20),
            ]);
            setLoadingMore(false);
          }, 200);
        }}
      />
    </div>
  );
};

/** Scrolling to the end asks for more, shows a spinner, then the new rows. */
export const IncrementalLoading: Story = {
  render: () => <PagedList />,
  play: async ({ canvasElement }) => {
    onEndReached.mockClear();
    const scroller = region(canvasElement);
    await expect(onEndReached).not.toHaveBeenCalled();

    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(onEndReached).toHaveBeenCalledTimes(1));
    await expect(
      within(scroller).getByRole("status", { name: "Loading more validators" })
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(
        within(scroller).queryByRole("status", {
          name: "Loading more validators",
        })
      ).toBeNull()
    );
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() =>
      expect(within(scroller).getByText("Validator 40")).toBeVisible()
    );
  },
};

const onEndReachedSorted = fn();

/** The row every sorted page lands above: the lowest rate stays last. */
const lowestRate: Validator = { id: "validator-lowest", name: "Lowest rate" };

/**
 * A list that sorts what it has loaded, as a list by rate does: each page
 * lands before the same last row.
 */
const SortedPagedList = () => {
  const [loaded, setLoaded] = useState(() => validators(0, 20));
  const [loadingMore, setLoadingMore] = useState(false);
  return (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Validators"
        items={[...loaded, lowestRate]}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        hasMore={loaded.length < 60}
        loadingMore={loadingMore}
        loadingMoreLabel="Loading more validators"
        onEndReached={() => {
          onEndReachedSorted();
          setLoadingMore(true);
          setTimeout(() => {
            setLoaded((current) => [
              ...current,
              ...validators(current.length, 20),
            ]);
            setLoadingMore(false);
          }, 200);
        }}
      />
    </div>
  );
};

/** A page landing before the last row still lets the end ask for the next. */
export const SortedPages: Story = {
  render: () => <SortedPagedList />,
  play: async ({ canvasElement }) => {
    onEndReachedSorted.mockClear();
    const scroller = region(canvasElement);
    const loading = () =>
      within(scroller).queryByRole("status", {
        name: "Loading more validators",
      });

    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(onEndReachedSorted).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loading()).not.toBeNull());
    await waitFor(() => expect(loading()).toBeNull());

    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(onEndReachedSorted).toHaveBeenCalledTimes(2));
  },
};

const onEndReachedOnce = fn();

/** A list whose loads fail: `hasMore` stays set and no rows arrive. */
const FailingList = () => {
  const [loadingMore, setLoadingMore] = useState(false);
  return (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Validators"
        items={validators(0, 3)}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        hasMore
        loadingMore={loadingMore}
        onEndReached={() => {
          onEndReachedOnce();
          setLoadingMore(true);
          setTimeout(() => setLoadingMore(false), 50);
        }}
      />
    </div>
  );
};

/** A failed load isn't retried in a loop: only new rows ask again. */
export const FailedLoad: Story = {
  render: () => <FailingList />,
  // The list asks as it mounts, before play runs, so the spy isn't cleared.
  play: async () => {
    await waitFor(() => expect(onEndReachedOnce).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(onEndReachedOnce).toHaveBeenCalledOnce();
  },
};

const onEndReachedHeld = fn();

/** Without `hasMore`, reaching the end asks for nothing. */
export const NoMore: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Validators"
        items={validators(0, 3)}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        hasMore={false}
        onEndReached={onEndReachedHeld}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onEndReachedHeld.mockClear();
    await expect(
      within(region(canvasElement)).getByText("Validator 3")
    ).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(onEndReachedHeld).not.toHaveBeenCalled();
  },
};

/** While `loadingMore` is set, reaching the end asks for nothing more. */
export const LoadingMoreHolds: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Validators"
        items={validators(0, 3)}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        hasMore
        loadingMore
        loadingMoreLabel="Loading more validators"
        onEndReached={onEndReachedHeld}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onEndReachedHeld.mockClear();
    await expect(
      within(region(canvasElement)).getByRole("status", {
        name: "Loading more validators",
      })
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(onEndReachedHeld).not.toHaveBeenCalled();
  },
};

/** Sticky group titles over an active item a button moves up. */
const StickyActiveList = () => {
  const [activeIndex, setActiveIndex] = useState(70);
  return (
    <div style={{ width: 360 }}>
      <button type="button" onClick={() => setActiveIndex(45)}>
        Move up
      </button>
      <VirtualList
        label="Validators"
        groups={groups}
        getKey={(validator) => validator.id}
        renderItem={renderRow}
        maxHeight="md"
        stickyHeaders
        activeIndex={activeIndex}
      />
    </div>
  );
};

/**
 * With sticky headers, the active item is scrolled clear of the title stuck
 * over it.
 */
export const ActiveItemStickyHeaders: Story = {
  render: () => <StickyActiveList />,
  play: async ({ canvasElement }) => {
    const scroller = region(canvasElement);
    const clearOfTitle = async (name: string) => {
      const row = within(scroller).getByText(name);
      const title = within(scroller).getByText("Active");
      await expect(row.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        Math.floor(title.getBoundingClientRect().bottom)
      );
      await expect(row.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        Math.ceil(scroller.getBoundingClientRect().bottom)
      );
    };
    await waitFor(() => clearOfTitle("Validator 71"));

    // Moving up scrolls the item down from under the stuck title.
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Move up" })
    );
    await waitFor(() => clearOfTitle("Validator 46"));
  },
};

const wrappingNames = validators(0, 200).map((validator) => ({
  ...validator,
  name: `${validator.name}, a validator with a long description that wraps onto more lines as the list narrows`,
}));

/**
 * Rows are measured, so they grow as the container narrows: the list reads
 * its own width, not a one-time snapshot of the window's.
 */
export const ContainerWidth: Story = {
  render: () => (
    <ContainerFrame width={520}>
      <VirtualList
        label="Validators"
        items={wrappingNames}
        getKey={(validator) => validator.id}
        renderItem={(validator) => <p>{validator.name}</p>}
        estimateSize={24}
        maxHeight="md"
      />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const scroller = region(canvasElement);
    const frame = scroller.parentElement;
    if (frame === null) throw new Error("Expected the container frame");
    // The second row starts where the first, as measured, ends.
    const secondRowStart = () =>
      within(scroller)
        .getByText(/^Validator 2,/)
        .getBoundingClientRect().top -
      within(scroller)
        .getByText(/^Validator 1,/)
        .getBoundingClientRect().top;
    const wide = secondRowStart();

    frame.style.width = "200px";
    await waitFor(() => expect(secondRowStart()).toBeGreaterThan(wide * 1.5));
  },
};

/**
 * The list is a size container: its rows follow the list's width, not the
 * frame's. A row figure shown from `sm` up hides in a 360px list inside a
 * wide frame, and shows in a 480px one.
 */
export const RowsFollowListWidth: Story = {
  render: () => (
    <ContainerFrame width={800}>
      {[360, 480].map((width) => (
        <div key={width} style={{ width }}>
          <VirtualList
            label={`Validators ${width}`}
            items={validators(0, 3)}
            getKey={(validator) => validator.id}
            renderItem={(validator) => (
              <ListRow
                title={validator.name}
                figure={{ text: "+0.5 ETH", from: "sm" }}
                value="4.20%"
              />
            )}
            maxHeight="sm"
          />
        </div>
      ))}
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const [narrow] = within(
      region(canvasElement, "Validators 360")
    ).getAllByText("+0.5 ETH");
    const [wide] = within(region(canvasElement, "Validators 480")).getAllByText(
      "+0.5 ETH"
    );
    await expect(narrow).not.toBeVisible();
    await expect(wide).toBeVisible();
  },
};

/** As a listbox, the rows are options a combobox owns by `listId`. */
export const Listbox: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <VirtualList
        label="Tokens"
        items={validators(0, 100)}
        getKey={(validator) => validator.id}
        renderItem={(validator, index) => (
          <div
            role="option"
            tabIndex={-1}
            aria-selected={index === 0}
            id={validator.id}
          >
            {validator.name}
          </div>
        )}
        listRole="listbox"
        listId="token-options"
        maxHeight="sm"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // The combobox owning it keeps the keyboard: no named region, no tab stop.
    await expect(within(canvasElement).queryByRole("region")).toBeNull();
    const listbox = within(canvasElement).getByRole("listbox", {
      name: "Tokens",
    });
    await expect(listbox.parentElement).toHaveAttribute("tabindex", "-1");
    await expect(listbox).toHaveAttribute("id", "token-options");
    await expect(
      within(listbox).getByRole("option", { name: "Validator 1" })
    ).toHaveAttribute("aria-selected", "true");
  },
};
