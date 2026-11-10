import type { ReactNode } from "react";
import { isValidElement, useEffect, useEffectEvent } from "react";
import { Trans, useTranslation } from "react-i18next";

import { formatCountryCode } from "../../../../shared/lib/formatters";
import {
  Button,
  ExternalLink,
  Icon,
  InlineIcon,
  Modal,
  Stack,
  Text,
} from "../../../../ui/index";
import { useTrackEvent } from "../../../tracking/index";
import { TranslatedLink } from "../translated-link";
import type { useGeoBlock } from "../use-geo-block";
import { WidgetTranslationGate } from "../widget-translation-gate";

type ModalType =
  | ({ type: "geoBlock"; onClose: () => void } & Exclude<
      ReturnType<typeof useGeoBlock>,
      false
    > & {
        regionCodeName: string | undefined;
      })
  | { type: "getInTouch" }
  | { type: "whatIsStakeKit" };

type HelpModalProps = {
  modal: ModalType;
  customTrigger?: ReactNode;
};

const siteUrl = "https://yield.xyz/";
const faqUrl = "https://docs.yield.xyz/docs/faqs";
const xUrl = "https://x.com/yield_xyz";
const ofacUrl =
  "https://ofac.treasury.gov/sanctions-programs-and-country-information";
const ofsiUrl =
  "https://www.gov.uk/government/collections/financial-sanctions-regime-specific-consolidated-lists-and-releases";
const secUrl = "https://www.sec.or.th/TH/Pages/News_Detail.aspx?SECID=10018";

type GeoBlockNotice =
  | "ofac_ofsi"
  | "ofsi_crypto_ban"
  | "crypto_ban"
  | "ofac"
  | "ofsi"
  | "pending_litigation"
  | "staking_ban"
  | "default";

/** The sources a notice's `<link0>` and `<link1>` name. */
type NoticeLinks = Readonly<Partial<Record<"link0" | "link1", string>>>;

/** The notice for a geo block's tags, most specific first. */
const geoBlockNotice = (
  tags: ReadonlySet<string>
): { readonly key: GeoBlockNotice; readonly links: NoticeLinks } => {
  if (tags.has("OFAC") && tags.has("OFSI")) {
    return { key: "ofac_ofsi", links: { link0: ofacUrl, link1: ofsiUrl } };
  }
  if (tags.has("OFSI") && tags.has("Crypto Ban")) {
    return { key: "ofsi_crypto_ban", links: { link0: ofsiUrl } };
  }
  if (tags.has("Crypto Ban")) return { key: "crypto_ban", links: {} };
  if (tags.has("OFAC")) return { key: "ofac", links: { link0: ofacUrl } };
  if (tags.has("OFSI")) return { key: "ofsi", links: { link0: ofsiUrl } };
  if (tags.has("Pending Litigation")) {
    return { key: "pending_litigation", links: {} };
  }
  if (tags.has("Staking Ban")) {
    return { key: "staking_ban", links: { link0: secUrl } };
  }
  return { key: "default", links: {} };
};

type Content = {
  readonly title: string;
  /** The title analytics records, when the title names a place. */
  readonly trackedTitle?: string;
  readonly description: ReactNode;
  readonly body?: ReactNode;
  readonly footer: ReactNode;
};

const HelpModalContent = ({ modal, customTrigger }: HelpModalProps) => {
  const { t, i18n } = useTranslation();
  const newTabLabel = t("shared.opens_in_new_tab");

  const linkAction = (
    href: string,
    label: string,
    variant: "primary" | "secondary"
  ) => (
    <ExternalLink
      href={href}
      newTabLabel={newTabLabel}
      button={{ variant, size: "cta" }}
    >
      {label}
    </ExternalLink>
  );

  const getContent = (modal: ModalType): Content => {
    switch (modal.type) {
      case "geoBlock": {
        const countryName = formatCountryCode({
          language: i18n.language,
          countryCode: modal.countryCode,
        });
        const notice = geoBlockNotice(modal.tags);
        // The place the notice's copy names: the region under litigation,
        // otherwise the country.
        const place =
          notice.key === "pending_litigation"
            ? modal.regionCodeName
            : countryName;
        const genericTitle = t("help_modals.geo_block.title");

        return {
          title:
            place === undefined
              ? genericTitle
              : t("help_modals.geo_block.title_in", { place }),
          trackedTitle: genericTitle,
          description: (
            <Trans
              i18nKey={`help_modals.geo_block.${notice.key}`}
              values={{
                countryName,
                nameOfRegion: modal.regionCodeName ?? "",
              }}
              components={Object.fromEntries(
                Object.entries(notice.links).map(([tag, href]) => [
                  tag,
                  <TranslatedLink key={tag} href={href} />,
                ])
              )}
            />
          ),
          footer: (
            <Button variant="secondary" size="cta" onClick={modal.onClose}>
              {t("help_modals.geo_block.dismiss")}
            </Button>
          ),
        };
      }

      case "getInTouch": {
        return {
          title: t("help_modals.get_in_touch.title"),
          description: t("help_modals.get_in_touch.description"),
          footer: (
            <>
              {linkAction(faqUrl, t("help_modals.faq"), "primary")}
              {linkAction(
                xUrl,
                t("help_modals.get_in_touch.button"),
                "secondary"
              )}
            </>
          ),
        };
      }

      case "whatIsStakeKit": {
        return {
          title: t("help_modals.what_is_stakekit.title"),
          description: t("help_modals.what_is_stakekit.description"),
          // Facts that each carry an icon keep the icons in a column.
          body: (
            <Stack as="ul" gap={8}>
              {(["yields", "custody", "flow"] as const).map((point) => (
                <Stack as="li" key={point} direction="row">
                  <InlineIcon variant="body" gap={8}>
                    <Icon name="CheckIcon" size="sm" />
                  </InlineIcon>
                  <Text>
                    {t(`help_modals.what_is_stakekit.points.${point}`)}
                  </Text>
                </Stack>
              ))}
            </Stack>
          ),
          footer: (
            <>
              {linkAction(
                siteUrl,
                t("help_modals.what_is_stakekit.visit"),
                "primary"
              )}
              {linkAction(faqUrl, t("help_modals.faq"), "secondary")}
            </>
          ),
        };
      }
    }
  };

  // HelpModal can be used as SKApp children (outside the widget frame) under the
  // same Application Runtime registry; tracking uses that tree's config.
  const trackEvent = useTrackEvent();

  const {
    title,
    trackedTitle = title,
    description,
    body,
    footer,
  } = getContent(modal);

  const isGeoBlock = modal.type === "geoBlock";

  const reportOpened = useEffectEvent(() =>
    trackEvent("helpModalOpened", { modal: trackedTitle })
  );

  useEffect(() => {
    if (!isGeoBlock) return;

    reportOpened();
  }, [isGeoBlock]);

  // A geo-block notice is open while it is rendered; help content opens from
  // its trigger: the host's element, or a help icon button.
  const openProps =
    modal.type === "geoBlock"
      ? {
          open: true,
          onOpenChange: (open: boolean) => {
            if (!open) modal.onClose();
          },
        }
      : {
          trigger: isValidElement(customTrigger) ? (
            customTrigger
          ) : (
            <Button
              variant="ghost"
              size="sm"
              aria-label={customTrigger === undefined ? title : undefined}
            >
              {customTrigger ?? <Icon name="HelpIcon" />}
            </Button>
          ),
          onOpenChange: (open: boolean) => {
            if (open) trackEvent("helpModalOpened", { modal: trackedTitle });
          },
        };

  return (
    <Modal
      {...openProps}
      title={title}
      description={description}
      closeLabel={t("help_modals.close")}
      initialFocus="dialog"
      footer={footer}
    >
      {body}
    </Modal>
  );
};

export const HelpModal = (props: HelpModalProps) => (
  <WidgetTranslationGate>
    <HelpModalContent {...props} />
  </WidgetTranslationGate>
);
