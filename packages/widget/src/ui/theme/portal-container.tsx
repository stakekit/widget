import * as stylex from "@stylexjs/stylex";
import {
  createContext,
  type PropsWithChildren,
  use,
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * Where Design System popups render. `undefined` outside a theme root (Base UI
 * then portals into `document.body`); `null` while the portal container has
 * not mounted yet (Base UI waits for it).
 */
const PortalContainerContext = createContext<HTMLElement | null | undefined>(
  undefined
);

const styles = stylex.create({
  // The size container responsive layout queries. The portal container stays
  // outside it: before Safari 18.4, `container-type` also contains
  // `position: fixed` descendants, which would pin popups to the Widget.
  content: { containerType: "inline-size" },
  // An inline theme root's content and portal container generate no box, so
  // they leave the host's layout as it is.
  inline: { display: "contents" },
  // The element a Base UI Portal inserts into the portal container. It holds
  // only fixed or absolutely positioned parts, so it needs no box in any
  // container; in an inline one, a box would add an item, and a gap, to the
  // host's flex or grid layout while a popup is open.
  portal: { display: "contents" },
});

/**
 * The props Design System popups give their Base UI Portal: the portal
 * container to render into and a portal element that generates no box.
 */
export const usePortalProps = () => ({
  container: use(PortalContainerContext),
  ...stylex.props(styles.portal),
});

/**
 * Whether an Escape key press belongs to an open Widget popup: one is open in
 * the container and the key was pressed inside the Widget. The press's origin
 * is read through the composed path, since a window listener sees a press
 * inside a shadow root retargeted to its host.
 */
const isWidgetPopupEscape = (
  event: KeyboardEvent,
  container: HTMLElement,
  content: HTMLElement | null
) => {
  if (event.key !== "Escape" || event.defaultPrevented) return false;
  if (!container.querySelector("[data-open]")) return false;
  const target = event.composedPath()[0];
  return (
    target instanceof Node &&
    (container.contains(target) || (content?.contains(target) ?? false))
  );
};

/**
 * Renders the Widget's content and the portal container popups render into,
 * and provides that container to them. By default it sits inside the Widget
 * root, so popups stay inside a host dialog's DOM and inherit the theme
 * root's classes, attributes and custom properties. With a host
 * `portalContainer`, it is a Widget-owned element appended inside the host's,
 * carrying the theme itself, so the theme and reset never touch the host's own
 * content.
 *
 * A host Radix dialog closes on any Escape it sees in the capture phase unless
 * the event is default-prevented. Base UI closes Widget popups whether or not
 * it is, so an Escape meant for an open Widget popup is marked handled before
 * the host sees it, and Escape closes only the Widget popup.
 */
export const PortalContainerProvider = ({
  children,
  hostContainer,
  inline,
  themeAttributes,
  themeClassName,
  themeProperties,
}: PropsWithChildren<{
  readonly hostContainer: HTMLElement | undefined;
  /** Whether the theme root is inline: no box and no size container. */
  readonly inline: boolean;
  /** The Presentation Setting attributes the theme root carries. */
  readonly themeAttributes: Readonly<Record<`data-sk-${string}`, string>>;
  readonly themeClassName: string;
  readonly themeProperties: Readonly<Record<string, string>>;
}>) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!container) return;
    const view = container.ownerDocument.defaultView;
    if (!view) return;
    const markHandled = (event: KeyboardEvent) => {
      if (isWidgetPopupEscape(event, container, content)) {
        event.preventDefault();
      }
    };
    // The window's capture phase runs before the host's document listeners.
    view.addEventListener("keydown", markHandled, { capture: true });
    return () =>
      view.removeEventListener("keydown", markHandled, { capture: true });
  }, [container, content]);

  return (
    <PortalContainerContext value={container}>
      <div
        {...stylex.props(inline ? styles.inline : styles.content)}
        ref={setContent}
      >
        {children}
      </div>
      {hostContainer ? (
        createPortal(
          <div
            data-sk-portal=""
            {...themeAttributes}
            className={themeClassName}
            style={themeProperties}
            ref={setContainer}
          />,
          hostContainer
        )
      ) : (
        <div
          data-sk-portal=""
          {...stylex.props(inline && styles.inline)}
          ref={setContainer}
        />
      )}
    </PortalContainerContext>
  );
};
