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

/** The element Design System popups portal into. */
export const usePortalContainer = () => use(PortalContainerContext);

const styles = stylex.create({
  // The size container responsive layout queries. The portal container stays
  // outside it: before Safari 18.4, `container-type` also contains
  // `position: fixed` descendants, which would pin popups to the Widget.
  content: { containerType: "inline-size" },
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
  themeAttributes,
  themeClassName,
  themeProperties,
}: PropsWithChildren<{
  readonly hostContainer: HTMLElement | undefined;
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
      <div {...stylex.props(styles.content)} ref={setContent}>
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
        <div data-sk-portal="" ref={setContainer} />
      )}
    </PortalContainerContext>
  );
};
