import * as stylex from "@stylexjs/stylex";
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";

import { TokenAvatar } from "../components/avatar";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { ListRow } from "../components/list-row";
import { Modal } from "../components/modal";
import { SearchInput } from "../components/search-input";
import { Spinner } from "../components/spinner";
import { useCoarsePointer } from "../components/use-media-query";
import { VirtualList } from "../components/virtual-list";
import { Box } from "../primitives/box";
import { Stack } from "../primitives/stack";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { listRowHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import type { Tone } from "../tone";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import type { TokenLogo } from "./token";

/** One choice of a select sheet, drawn as a `ListRow`. */
type SelectSheetOption = {
  /** Unique within the sheet; `onSelect` receives it. */
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string | undefined;
  /** The trailing figure, such as a formatted balance. */
  readonly value?: string | undefined;
  /** Under the value, such as its fiat equivalent. */
  readonly subvalue?: string | undefined;
  /** `accent` marks the subvalue as an incentive, such as a campaign's rate. */
  readonly subvalueTone?: "muted" | "accent" | undefined;
  /** The leading logo, with its network badge. */
  readonly logo?: TokenLogo;
  /**
   * A leading element in place of `logo`, such as a network's icon that loads
   * on demand.
   */
  readonly leading?: ReactNode;
  readonly badges?:
    | ReadonlyArray<{
        readonly label: string;
        readonly tone?: Tone;
        /** Announces the badge as it appears, such as a pending state. */
        readonly announce?: boolean;
      }>
    | undefined;
  /**
   * Label-value rows under the option, such as a validator's commission and
   * staked balance, already formatted. A detail with `copy` shows a copy
   * control that copies without choosing the option.
   */
  readonly details?: ComponentProps<typeof ListRow>["details"] | undefined;
  readonly disabled?: boolean;
  /** Renders as the option row's `data-testid`. */
  readonly testId?: string | undefined;
};

/** A button under a select sheet's options. */
export type SelectSheetAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant?: "primary" | "secondary";
  readonly loading?: boolean;
  readonly disabled?: boolean;
};

type OptionsOrGroups =
  | {
      readonly options: ReadonlyArray<SelectSheetOption>;
      readonly groups?: never;
    }
  | {
      /**
       * Titled runs of options, such as "Your tokens" and "All tokens". A
       * group with `logo`, such as a market's token, heads its run with the
       * avatar and its label in normal case; `caption`, such as
       * "from 0.02%", ends over its options' values.
       */
      readonly groups: ReadonlyArray<{
        readonly key: string;
        readonly label: string;
        readonly logo?: TokenLogo;
        readonly caption?: string;
        readonly options: ReadonlyArray<SelectSheetOption>;
      }>;
      readonly options?: never;
    };

type Selection =
  | {
      /** The current choice's id, marked selected. */
      readonly selectedId?: string | undefined;
      readonly multiple?: never;
    }
  | {
      /**
       * Takes several choices: each option shows a check, choosing one
       * toggles it through `onSelect`, and the sheet stays open.
       */
      readonly multiple: { readonly selectedIds: ReadonlySet<string> };
      readonly selectedId?: never;
    };

type SelectSheetProps = OptionsOrGroups &
  Selection & {
    /** Names the sheet, such as "Select a token". */
    readonly title: string;
    /**
     * `condensed` is for a compact choice, such as a network: 40px rows, with
     * a 24px `leading` icon, in the narrower `picker` dialog.
     */
    readonly density?: "comfortable" | "condensed";
    /**
     * Unset, a choice closes the sheet. Off, the sheet stays open, such as
     * while a chosen network is confirmed in the wallet.
     */
    readonly closesOnSelect?: boolean;
    /** Shown over the search field, such as a warning. */
    readonly notice?: ReactNode;
    /** Names the close button. */
    readonly closeLabel: string;
    /**
     * The element that opens the sheet, such as a `TokenTrigger`. It must
     * forward its ref and props; focus returns to it on close.
     */
    readonly trigger?: ReactElement | undefined;
    /** Open state; leave unset with `trigger` to let the trigger open it. */
    readonly open?: boolean | undefined;
    /** Called on open and close, including the close after a choice. */
    readonly onOpenChange?: (open: boolean) => void;
    /** Hidden, without closing, while another surface asks over it. */
    readonly suspended?: boolean;
    /** Names the list of options, such as "Tokens". */
    readonly listLabel: string;
    /**
     * Called with the chosen option's id; the sheet then closes, unless it
     * takes `multiple` choices or `closesOnSelect` is off.
     */
    readonly onSelect: (id: string) => void;
    /**
     * The search field over the options. Filtering is the caller's: it passes
     * the options that match `value`. Closing the sheet clears the query.
     * With a search field the sheet holds its height, so it never moves as
     * the matches change; with a fine pointer the field takes focus as the
     * sheet opens, and with a touch it waits for a tap, so no on-screen
     * keyboard covers the options.
     */
    readonly search?:
      | {
          readonly value: string;
          readonly onValueChange: (value: string) => void;
          readonly label: string;
          /** Says what the field searches, such as "Search tokens"; unset, `label`. */
          readonly placeholder?: string | undefined;
          readonly clearLabel: string;
        }
      | undefined;
    /**
     * Shown when there are no options, such as for a search with no match;
     * with a search field it is also announced.
     */
    readonly empty?: { readonly title: string; readonly body?: string };
    /** Shown in place of the options when they failed to load. */
    readonly error?: {
      readonly title: string;
      readonly body?: string;
      /** Such as "Try again". */
      readonly action?: {
        readonly label: string;
        readonly onClick: () => void;
        readonly loading?: boolean;
      };
    };
    /**
     * Buttons under the options, such as "View all validators" or the confirm
     * of a `multiple` choice; several stack in the order given.
     */
    readonly footer?:
      | SelectSheetAction
      | ReadonlyArray<SelectSheetAction>
      | undefined;
    /**
     * Shows a spinner, named by `loadingLabel`: in place of the options while
     * there are none, and over them while they are replaced, such as for a
     * new query.
     */
    readonly loading?: boolean;
    readonly loadingLabel?: string;
    /** Called when the last option scrolls into view while `hasMore` is set. */
    readonly onEndReached?: () => void;
    readonly hasMore?: boolean;
    readonly loadingMore?: boolean;
    readonly loadingMoreLabel?: string;
    /** Render as the `data-testid` of the sheet, its title and its search field. */
    readonly testIds?: {
      readonly container?: string;
      readonly title?: string;
      readonly search?: string;
    };
  };

/** The next option from `from` in `direction` that is not disabled. */
const nextEnabled = (
  options: ReadonlyArray<SelectSheetOption>,
  from: number,
  direction: 1 | -1
) => {
  const next =
    direction === 1
      ? options.findIndex(
          (option, index) => index > from && option.disabled !== true
        )
      : options.findLastIndex(
          (option, index) => index < from && option.disabled !== true
        );
  return next === -1 ? from : next;
};

/**
 * A sheet to choose one of many options, such as a token, a yield or a
 * validator: a `Modal` with a search field over a virtualized list of rows.
 * With a search field, focus stays in it while the arrow keys move through
 * the options and Enter chooses one; Escape clears the query, then closes.
 * With a search field it holds its height, so the field and the list's top
 * stay put as the matches change, and a search with no match shows its
 * empty state where the options were. It opens on the current choice,
 * scrolled into view. Choosing an option
 * closes the sheet, unless it takes `multiple` choices or `closesOnSelect` is
 * off. Its rows are `flat`, as every picker's: their content lines up with
 * the title while their tint reaches past it.
 */
export const SelectSheet = ({
  title,
  density = "comfortable",
  closesOnSelect = true,
  notice,
  closeLabel,
  suspended = false,
  trigger,
  open,
  onOpenChange,
  listLabel,
  selectedId,
  multiple,
  onSelect,
  search,
  empty,
  error,
  footer,
  loading = false,
  loadingLabel,
  onEndReached,
  hasMore = false,
  loadingMore = false,
  loadingMoreLabel,
  testIds,
  ...optionsOrGroups
}: SelectSheetProps) => {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const searchRef = useRef<HTMLInputElement>(null);
  const coarsePointer = useCoarsePointer();
  const [ownOpen, setOwnOpen] = useState(false);
  const shown = open ?? ownOpen;
  // Unset until the keys or the query move it, the active option is the
  // current choice.
  const [movedIndex, setActiveIndex] = useState<number | undefined>(undefined);
  // A sheet its owner reopens starts on the current choice again.
  const [wasShown, setWasShown] = useState(shown);
  if (shown !== wasShown) {
    setWasShown(shown);
    setActiveIndex(undefined);
  }
  // However it closes, by its own controls or by its owner, it reopens with
  // every option listed.
  const clearSearch = useEffectEvent(() => {
    if (search !== undefined && search.value !== "") search.onValueChange("");
  });
  useEffect(() => {
    if (!shown) clearSearch();
  }, [shown]);
  const layout = densityLayouts[density];

  const flat =
    optionsOrGroups.groups === undefined
      ? optionsOrGroups.options
      : optionsOrGroups.groups.flatMap((group) => group.options);
  const groupLabels =
    optionsOrGroups.groups === undefined
      ? []
      : optionsOrGroups.groups.flatMap((group) =>
          group.options.map(() => group.label)
        );
  const isSelected = (option: SelectSheetOption) =>
    multiple === undefined
      ? option.id === selectedId
      : multiple.selectedIds.has(option.id);
  const activeIndex =
    movedIndex ??
    flat.findIndex((option) => isSelected(option) && option.disabled !== true);
  const active = activeIndex < flat.length ? activeIndex : -1;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const showsOptions = error === undefined && flat.length > 0;
  const showsEmpty = !loading && error === undefined && flat.length === 0;

  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    setActiveIndex(undefined);
    onOpenChange?.(next);
  };

  const choose = (option: SelectSheetOption) => {
    if (option.disabled === true) return;
    onSelect(option.id);
    if (multiple === undefined && closesOnSelect) setOpen(false);
  };

  const renderOption = (option: SelectSheetOption, index: number) => {
    const leading =
      option.leading ??
      (option.logo === undefined ? undefined : (
        <TokenAvatar {...option.logo} decorative />
      ));
    const rowContent = {
      title: option.title,
      density,
      subtitle: option.subtitle,
      value: option.value,
      subvalue: option.subvalue,
      subvalueTone: option.subvalueTone ?? "muted",
      details: option.details,
      testId: option.testId,
      leading,
      badges: option.badges?.map((badge) => (
        <Badge
          key={badge.label}
          tone={badge.tone ?? "neutral"}
          {...(badge.announce === true ? { role: "status" } : {})}
        >
          {badge.label}
        </Badge>
      )),
    };
    const selected = isSelected(option);
    const check = multiple !== undefined;
    const groupLabel = groupLabels[index];

    return (
      <Box paddingBlock={optionSpacing} role="presentation">
        {search === undefined ? (
          <ListRow
            {...rowContent}
            variant="flat"
            onClick={() => choose(option)}
            selected={selected}
            check={check}
            disabled={option.disabled === true}
          />
        ) : (
          <ListRow
            {...rowContent}
            variant="flat"
            option={{
              id: optionId(index),
              selected,
              check,
              // The focus ring follows the keys: on open, the current choice
              // is active but reads by its tint and check alone, so the
              // search field's ring is the only one.
              active: index === active && movedIndex !== undefined,
              onSelect: () => choose(option),
              disabled: option.disabled === true,
              position: hasMore ? { index } : { index, count: flat.length },
              groupLabel,
            }}
          />
        )}
      </Box>
    );
  };

  // A sheet that holds its height lets the list fill what the search field
  // leaves; otherwise the list caps itself and the sheet fits it.
  const fixedHeight = search !== undefined;
  const listProps = {
    label: listLabel,
    getKey: (option: SelectSheetOption) => option.id,
    renderItem: renderOption,
    ...(fixedHeight ? {} : ({ maxHeight: "lg" } as const)),
    estimateSize: layout.estimateSize,
    listRole: search === undefined ? "list" : "listbox",
    multiselectable: multiple !== undefined,
    listId,
    hasMore,
    loadingMore,
    ...(active === -1 ? {} : { activeIndex: active }),
    onEndReached,
    loadingMoreLabel,
  } as const;

  const spinner = loading && (
    <Stack align="center">
      {loadingLabel === undefined ? (
        <Spinner />
      ) : (
        <Spinner label={loadingLabel} />
      )}
    </Stack>
  );

  // A state in place of the options sits where they would, centered in the
  // space a sheet that holds its height keeps for them.
  const inListArea = (state: ReactNode) => (
    <div {...stylex.props(styles.state)}>{state}</div>
  );
  const body = (): ReactNode => {
    if (loading && flat.length === 0) return inListArea(spinner);
    if (error !== undefined) {
      return inListArea(
        <ErrorState
          title={error.title}
          body={error.body}
          action={error.action}
        />
      );
    }
    if (flat.length === 0) {
      return empty === undefined
        ? null
        : inListArea(<EmptyState title={empty.title} body={empty.body} />);
    }
    const list =
      optionsOrGroups.groups === undefined ? (
        <VirtualList {...listProps} items={optionsOrGroups.options} />
      ) : (
        <VirtualList
          {...listProps}
          stickyHeaders
          // A single choice's rows keep a check's slot after their values;
          // a group's caption ends where the values do.
          {...(multiple === undefined ? { headerInsetEnd: "checkSlot" } : {})}
          groups={optionsOrGroups.groups.map((group) => ({
            key: group.key,
            label: group.label,
            items: group.options,
            leading:
              group.logo === undefined ? undefined : (
                <TokenAvatar {...group.logo} size="control" decorative />
              ),
            caption: group.caption,
          }))}
        />
      );
    return <div {...stylex.props(styles.list, styles.flatList)}>{list}</div>;
  };
  const replacing = loading && flat.length > 0 && error === undefined;
  // A touch keyboard would cover the options, so a coarse pointer focuses
  // the dialog rather than the search field.
  const searchFocus = coarsePointer ? "dialog" : searchRef;

  return (
    <Modal
      open={shown}
      suspended={suspended}
      onOpenChange={setOpen}
      title={title}
      closeLabel={closeLabel}
      size={layout.dialogSize}
      fixedHeight={fixedHeight}
      contentScrolls
      testId={testIds?.container}
      titleTestId={testIds?.title}
      trigger={trigger}
      initialFocus={search === undefined ? undefined : searchFocus}
      footer={
        footer === undefined
          ? undefined
          : ("label" in footer ? [footer] : footer).map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? "secondary"}
                onClick={action.onClick}
                loading={action.loading ?? false}
                disabled={action.disabled ?? false}
              >
                {action.label}
              </Button>
            ))
      }
    >
      {notice}
      {search !== undefined && (
        <SearchInput
          inputRef={searchRef}
          value={search.value}
          onValueChange={(next) => {
            setActiveIndex(-1);
            search.onValueChange(next);
          }}
          label={search.label}
          testId={testIds?.search}
          clearLabel={search.clearLabel}
          placeholder={search.placeholder}
          listbox={{
            id: listId,
            expanded: showsOptions,
            ...(active === -1 ? {} : { activeOptionId: optionId(active) }),
            onKey: (key) => {
              if (key === "ArrowDown") {
                setActiveIndex(nextEnabled(flat, active, 1));
              } else if (key === "ArrowUp") {
                setActiveIndex(nextEnabled(flat, active, -1));
              } else if (showsOptions) {
                const option = flat[active];
                if (option !== undefined) choose(option);
              }
            },
          }}
        />
      )}
      {search !== undefined && (
        // Focus stays in the field as the listbox goes, so a search with no
        // match is announced from a status mounted with the field.
        <VisuallyHidden role="status">
          {showsEmpty && empty !== undefined
            ? [empty.title, empty.body].filter(Boolean).join(". ")
            : null}
        </VisuallyHidden>
      )}
      {replacing && spinner}
      {body()}
    </Modal>
  );
};

const styles = stylex.create({
  list: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
  state: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 0,
  },
  // Past the body's inline padding by a row's own, so the rows' content lines
  // up with the title while their tint reaches into the margin.
  flatList: { marginInline: `calc(-1 * ${space[12]})` },
});

/** The spacing above and under each option's row. */
const optionSpacing = 2;

/**
 * What a density sets beyond its rows: the dialog's size and the rows'
 * expected height, unset for the virtualized list's own.
 */
const densityLayouts = {
  comfortable: { dialogSize: "default", estimateSize: undefined },
  condensed: {
    dialogSize: "picker",
    estimateSize:
      Number.parseFloat(listRowHeight.condensed) + 2 * optionSpacing,
  },
} as const;
