import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
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
import { VirtualList } from "../components/virtual-list";
import { Box } from "../primitives/box";
import { Stack } from "../primitives/stack";
import { VisuallyHidden } from "../primitives/visually-hidden";
import type { Tone } from "../tone";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import type { TokenLogo } from "./token";

/** One choice of a select sheet, drawn as a `ListRow`. */
type SelectSheetOption = {
  /** Unique within the sheet; `onSelect` receives it. */
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  /** The trailing figure, such as a formatted balance. */
  readonly value?: string;
  /** Under the value, such as its fiat equivalent. */
  readonly subvalue?: string;
  /** The leading logo, with its network badge. */
  readonly logo?: TokenLogo;
  readonly badges?: ReadonlyArray<{
    readonly label: string;
    readonly tone?: Tone;
  }>;
  /**
   * Label-value rows under the option, such as a validator's commission and
   * staked balance, already formatted. A detail with `copy` shows a copy
   * control that copies without choosing the option.
   */
  readonly details?: ComponentProps<typeof ListRow>["details"];
  readonly disabled?: boolean;
  /** Renders as the option row's `data-testid`. */
  readonly testId?: string;
};

/** A button under a select sheet's options. */
type SelectSheetAction = {
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
       * "from 0.02%", aligns to the header's end.
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
      readonly selectedId?: string;
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
    /** Names the close button. */
    readonly closeLabel: string;
    /**
     * The element that opens the sheet, such as a `TokenTrigger`. It must
     * forward its ref and props; focus returns to it on close.
     */
    readonly trigger?: ReactElement;
    /** Open state; leave unset with `trigger` to let the trigger open it. */
    readonly open?: boolean;
    /** Called on open and close, including the close after a choice. */
    readonly onOpenChange?: (open: boolean) => void;
    /** Names the list of options, such as "Tokens". */
    readonly listLabel: string;
    /**
     * Called with the chosen option's id; the sheet then closes, unless it
     * takes `multiple` choices.
     */
    readonly onSelect: (id: string) => void;
    /**
     * The search field over the options. Filtering is the caller's: it passes
     * the options that match `value`.
     */
    readonly search?: {
      readonly value: string;
      readonly onValueChange: (value: string) => void;
      readonly label: string;
      readonly placeholder?: string;
      readonly clearLabel: string;
    };
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
    readonly footer?: SelectSheetAction | ReadonlyArray<SelectSheetAction>;
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
 * It opens on the current choice, scrolled into view. Choosing an option
 * closes the sheet, unless it takes `multiple` choices.
 */
export const SelectSheet = ({
  title,
  closeLabel,
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
  const [ownOpen, setOwnOpen] = useState(false);
  // Unset until the keys or the query move it, the active option is the
  // current choice.
  const [movedIndex, setActiveIndex] = useState<number | undefined>(undefined);

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
    if (multiple === undefined) setOpen(false);
  };

  const renderOption = (option: SelectSheetOption, index: number) => {
    const rowContent = {
      title: option.title,
      ...(option.subtitle === undefined ? {} : { subtitle: option.subtitle }),
      ...(option.value === undefined ? {} : { value: option.value }),
      ...(option.subvalue === undefined ? {} : { subvalue: option.subvalue }),
      ...(option.details === undefined ? {} : { details: option.details }),
      ...(option.testId === undefined ? {} : { testId: option.testId }),
      ...(option.logo === undefined
        ? {}
        : { leading: <TokenAvatar {...option.logo} decorative /> }),
      ...(option.badges === undefined
        ? {}
        : {
            badges: option.badges.map((badge) => (
              <Badge key={badge.label} tone={badge.tone ?? "neutral"}>
                {badge.label}
              </Badge>
            )),
          }),
    };
    const selected = isSelected(option);
    const check = multiple !== undefined;
    const groupLabel = groupLabels[index];

    return (
      <Box paddingBlock={2} role="presentation">
        {search === undefined ? (
          <ListRow
            {...rowContent}
            onClick={() => choose(option)}
            selected={selected}
            check={check}
            disabled={option.disabled === true}
          />
        ) : (
          <ListRow
            {...rowContent}
            option={{
              id: optionId(index),
              selected,
              check,
              active: index === active,
              onSelect: () => choose(option),
              disabled: option.disabled === true,
              position: hasMore ? { index } : { index, count: flat.length },
              ...(groupLabel === undefined ? {} : { groupLabel }),
            }}
          />
        )}
      </Box>
    );
  };

  const listProps = {
    label: listLabel,
    getKey: (option: SelectSheetOption) => option.id,
    renderItem: renderOption,
    maxHeight: "lg",
    listRole: search === undefined ? "list" : "listbox",
    multiselectable: multiple !== undefined,
    listId,
    hasMore,
    loadingMore,
    ...(active === -1 ? {} : { activeIndex: active }),
    ...(onEndReached === undefined ? {} : { onEndReached }),
    ...(loadingMoreLabel === undefined ? {} : { loadingMoreLabel }),
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

  const body = (): ReactNode => {
    if (loading && flat.length === 0) return spinner;
    if (error !== undefined) {
      return (
        <ErrorState
          title={error.title}
          {...(error.body === undefined ? {} : { body: error.body })}
          {...(error.action === undefined ? {} : { action: error.action })}
        />
      );
    }
    if (flat.length === 0) {
      return empty === undefined ? null : (
        <EmptyState
          title={empty.title}
          {...(empty.body === undefined ? {} : { body: empty.body })}
        />
      );
    }
    if (optionsOrGroups.groups === undefined) {
      return <VirtualList {...listProps} items={optionsOrGroups.options} />;
    }
    return (
      <VirtualList
        {...listProps}
        stickyHeaders
        groups={optionsOrGroups.groups.map((group) => ({
          key: group.key,
          label: group.label,
          items: group.options,
          ...(group.logo === undefined
            ? {}
            : {
                leading: (
                  <TokenAvatar {...group.logo} size="control" decorative />
                ),
              }),
          ...(group.caption === undefined ? {} : { caption: group.caption }),
        }))}
      />
    );
  };
  const replacing = loading && flat.length > 0 && error === undefined;

  return (
    <Modal
      open={open ?? ownOpen}
      onOpenChange={setOpen}
      title={title}
      closeLabel={closeLabel}
      {...(testIds?.container === undefined
        ? {}
        : { testId: testIds.container })}
      {...(testIds?.title === undefined ? {} : { titleTestId: testIds.title })}
      {...(trigger === undefined ? {} : { trigger })}
      {...(search === undefined ? {} : { initialFocus: searchRef })}
      {...(footer === undefined
        ? {}
        : {
            footer: ("label" in footer ? [footer] : footer).map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? "secondary"}
                onClick={action.onClick}
                loading={action.loading ?? false}
                disabled={action.disabled ?? false}
              >
                {action.label}
              </Button>
            )),
          })}
    >
      {search !== undefined && (
        <SearchInput
          inputRef={searchRef}
          value={search.value}
          onValueChange={(next) => {
            setActiveIndex(-1);
            search.onValueChange(next);
          }}
          label={search.label}
          {...(testIds?.search === undefined ? {} : { testId: testIds.search })}
          clearLabel={search.clearLabel}
          {...(search.placeholder === undefined
            ? {}
            : { placeholder: search.placeholder })}
          listbox={{
            id: listId,
            expanded: showsOptions,
            ...(active === -1 ? {} : { activeOptionId: optionId(active) }),
            onKey: (key) => {
              if (key === "ArrowDown") {
                setActiveIndex(nextEnabled(flat, active, 1));
              } else if (key === "ArrowUp") {
                setActiveIndex(nextEnabled(flat, active, -1));
              } else {
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
