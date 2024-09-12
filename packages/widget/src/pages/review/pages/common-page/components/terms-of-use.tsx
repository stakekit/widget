import { Box, Text } from "@sk-widget/components";
import { useTrackEvent } from "@sk-widget/hooks/tracking/use-track-event";
import { pointerStyles } from "@sk-widget/pages/review/pages/style.css";
import { Trans } from "react-i18next";

const TermsOfUse = ({ ...rest }) => {
  const trackEvent = useTrackEvent();
  return (
    <Box marginTop="4" marginBottom={rest.showMetaInfo ? "4" : "16"}>
      <Text variant={{ weight: "normal", type: "muted" }}>
        <Trans
          i18nKey="review.terms_of_use"
          components={{
            underline0: (
              // biome-ignore lint/a11y/useAnchorContent: <explanation>
              <a
                target="_blank"
                onClick={() => trackEvent("termsClicked")}
                href="https://docs.stakek.it/docs/terms-of-use"
                className={pointerStyles}
                rel="noreferrer"
              />
            ),
          }}
        />
      </Text>
    </Box>
  );
};

export default TermsOfUse;
