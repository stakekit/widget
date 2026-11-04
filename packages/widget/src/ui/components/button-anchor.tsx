import type { ReactNode } from "react";
import { VisuallyHidden } from "../primitives/visually-hidden";
import {
  ButtonContent,
  type ButtonLookProps,
  buttonLook,
} from "./button-styles";

type ButtonAnchorProps = ButtonLookProps & {
  readonly href: string;
  readonly children: ReactNode;
} & (
    | { readonly external?: false; readonly newTabLabel?: never }
    | {
        /**
         * Opens the page in a new tab, without giving it access to this one,
         * and says so: the trailing new-tab icon is named `newTabLabel`.
         */
        readonly external: true;
        /** Names the new tab, such as "opens in a new tab". */
        readonly newTabLabel: string;
        /** An external link ends with the new-tab icon. */
        readonly iconEnd?: never;
      }
  );

/** A link that looks like a `Button`, for an action that navigates. */
export const ButtonAnchor = ({
  href,
  external = false,
  newTabLabel,
  variant = "secondary",
  size = "md",
  iconStart,
  iconEnd,
  children,
}: ButtonAnchorProps) => (
  <a
    href={href}
    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    {...buttonLook(variant, size)}
  >
    <ButtonContent
      size={size}
      iconStart={iconStart}
      iconEnd={external ? "ExternalLinkIcon" : iconEnd}
    >
      {children}
      {newTabLabel !== undefined && (
        <>
          {" "}
          <VisuallyHidden>{newTabLabel}</VisuallyHidden>
        </>
      )}
    </ButtonContent>
  </a>
);
