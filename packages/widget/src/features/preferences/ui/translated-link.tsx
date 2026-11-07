import { Children, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ExternalLink } from "../../../ui/index";

/**
 * A link inside translated copy, for `<Trans components>`. Without `href`, the
 * translation places the URL as the link's text, possibly split in parts.
 */
export const TranslatedLink = ({
  href,
  children,
}: {
  readonly href?: string;
  readonly children?: ReactNode;
}) => {
  const { t } = useTranslation();
  const url =
    href ??
    Children.toArray(children)
      .filter((child) => typeof child === "string")
      .join("");

  return (
    <ExternalLink href={url} newTabLabel={t("shared.opens_in_new_tab")}>
      {children ?? url}
    </ExternalLink>
  );
};
