import { Content, Overlay, Portal, Root, Title } from "@radix-ui/react-dialog";
import { useContext } from "react";
import { SettingsContext } from "../../../providers/settings";
import { id } from "../../../styles/theme/ids";
import { Box } from "../../atoms/box";
import { XIcon } from "../../atoms/icons/x-icon";
import { Text } from "../../atoms/typography/text";
import { container, content, iframe, overlay } from "./styles.css";

export type KycIframeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
};

export const KycIframeModal = ({
  open,
  onOpenChange,
  url,
  title,
}: KycIframeModalProps) => {
  const portalContainer = useContext(SettingsContext)?.portalContainer;

  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <Portal container={portalContainer}>
        <Box className={container} data-rk={id}>
          <Overlay onClick={() => onOpenChange(false)} className={overlay} />

          <Content
            data-testid="kyc-iframe-modal__container"
            className={content}
            aria-describedby={undefined}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              px="4"
              py="3"
            >
              <Title>
                <Text variant={{ weight: "bold", size: "large" }}>{title}</Text>
              </Title>

              <Box as="button" onClick={() => onOpenChange(false)}>
                <XIcon />
              </Box>
            </Box>

            <iframe
              data-testid="kyc-iframe-modal__iframe"
              title={title}
              src={url}
              allow="camera; microphone; clipboard-write"
              className={iframe}
            />
          </Content>
        </Box>
      </Portal>
    </Root>
  );
};
