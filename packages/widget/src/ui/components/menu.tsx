import { Menu as BaseMenu } from "@base-ui/react/menu";
import * as stylex from "@stylexjs/stylex";
import type { ReactElement } from "react";
import { Icon } from "../primitives/icon";
import { usePortalContainer } from "../theme/portal-container";
import { color } from "../tokens/color.stylex";
import { layer } from "../tokens/layer.stylex";
import { overlaySize } from "../tokens/overlay.stylex";
import { space } from "../tokens/space.stylex";
import type { ButtonIconName } from "./button-styles";
import { popupStyles } from "./popup-styles";

/** One action in a `Menu`. */
type MenuItem = {
  /** Unique within the menu. */
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly icon?: ButtonIconName;
  /** `danger` for a destructive action, such as disconnecting. */
  readonly tone?: "danger";
  readonly disabled?: boolean;
};

type MenuProps = {
  /**
   * The element that opens the menu, such as a `Button` or `IconButton`. It
   * must forward its ref and props. Focus returns to it when the menu closes.
   */
  readonly trigger: ReactElement;
  readonly items: ReadonlyArray<MenuItem>;
  /** Names the list of actions. */
  readonly label: string;
  readonly side?: "top" | "bottom";
  readonly align?: "start" | "center" | "end";
};

/**
 * A list of actions that opens from a trigger, such as a wallet account menu.
 * Arrow keys move through the actions, Enter runs one, and Escape closes the
 * menu.
 */
export const Menu = ({
  trigger,
  items,
  label,
  side = "bottom",
  align = "end",
}: MenuProps) => {
  const container = usePortalContainer();

  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal container={container}>
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={4}
          {...stylex.props(popupStyles.positioner, styles.positioner)}
        >
          <BaseMenu.Popup
            aria-label={label}
            {...stylex.props(popupStyles.surface, styles.popup)}
          >
            {items.map((item) => (
              <BaseMenu.Item
                key={item.id}
                label={item.label}
                disabled={item.disabled}
                onClick={item.onSelect}
                {...stylex.props(
                  popupStyles.item,
                  item.tone === "danger" && styles.danger
                )}
              >
                {item.icon && <Icon name={item.icon} size="sm" />}
                {item.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
};

const styles = stylex.create({
  positioner: { zIndex: layer.dropdown },
  popup: {
    padding: space[4],
    minWidth: overlaySize.menuMinWidth,
  },
  // Danger text sits on its soft tint while highlighted.
  danger: {
    backgroundColor: {
      default: "transparent",
      ":is([data-highlighted])": color.dangerSoft,
    },
    color: { default: color.danger, ":is([data-disabled])": color.textSubtle },
  },
});
