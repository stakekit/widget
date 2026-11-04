import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { disclosureStyles } from "./disclosure-styles";
import { focusRingStyles } from "./focus-ring";

const enteringOrLeaving = ":is([data-starting-style], [data-ending-style])";

/** One section of an `Accordion`. */
type AccordionItem = {
  /** Unique within the accordion. */
  readonly id: string;
  readonly title: string;
  readonly content: ReactNode;
  readonly disabled?: boolean;
};

type AccordionProps = {
  readonly items: ReadonlyArray<AccordionItem>;
} & (
  | {
      /** Lets several sections stay open at once. */
      readonly multiple?: false;
      /** The section open at first. */
      readonly defaultOpen?: string;
    }
  | {
      readonly multiple: true;
      /** The sections open at first. */
      readonly defaultOpen?: ReadonlyArray<string>;
    }
);

/**
 * Stacked sections that each show or hide their content, such as FAQ entries
 * or grouped details. Each header is a button whose expanded state says
 * whether its section is open. Unless `multiple`, opening one closes the
 * others, and one section at most is open at first.
 */
export const Accordion = (props: AccordionProps) => {
  const defaultValue =
    props.multiple === true
      ? [...(props.defaultOpen ?? [])]
      : [props.defaultOpen].filter((id) => id !== undefined);

  return (
    <BaseAccordion.Root
      multiple={props.multiple ?? false}
      defaultValue={defaultValue}
    >
      {props.items.map((item) => (
        <BaseAccordion.Item
          key={item.id}
          value={item.id}
          disabled={item.disabled ?? false}
          {...stylex.props(styles.item)}
        >
          <BaseAccordion.Header {...stylex.props(styles.header)}>
            <BaseAccordion.Trigger
              {...stylex.props(
                disclosureStyles.trigger,
                focusRingStyles.visible
              )}
            >
              {item.title}
              <span {...stylex.props(disclosureStyles.caret)}>
                <Icon name="CaretDownIcon" size="sm" />
              </span>
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>
          <BaseAccordion.Panel
            {...stylex.props(disclosureStyles.panel, styles.panel)}
          >
            <div {...stylex.props(disclosureStyles.content)}>
              {item.content}
            </div>
          </BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  );
};

const styles = stylex.create({
  item: {
    borderBottomColor: color.border,
    borderBottomStyle: "solid",
    borderBottomWidth: borderWidth.thin,
  },
  header: { margin: 0 },
  panel: {
    height: {
      default: "var(--accordion-panel-height)",
      [enteringOrLeaving]: 0,
    },
  },
});
