import { useTranslation } from "react-i18next";
import { images } from "../../../assets/images";
import { Box, Button, Heading, SelectModal, Text } from "../../../components";
import { unstakeSignContainer, unstakeSignImageStyle } from "../styles.css";

export const UnstakeSignPopup = ({
  onCancel,
  onClick,
  isOpen,
}: {
  isOpen: boolean;
  onCancel: () => void;
  onClick: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <SelectModal state={{ isOpen, setOpen: onCancel }} onClose={onCancel}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingBottom={{ mobile: "8" }}
        className={unstakeSignContainer}
      >
        <Box
          as="img"
          src={images.poweredBy}
          className={unstakeSignImageStyle}
        />

        <Heading variant={{ level: "h4" }}>
          {t("position_details.unstake_sign.title")}
        </Heading>

        <Box marginTop="2" lineHeight="short">
          <Text
            variant={{ type: "muted", weight: "normal" }}
            textAlign="center"
          >
            {t("position_details.unstake_sign.description")}
          </Text>
        </Box>

        <Box marginTop="8" width="full">
          <Button onClick={onClick}>
            <Text variant={{ type: "inverted", weight: "bold", size: "large" }}>
              {t("shared.continue")}
            </Text>
          </Button>
        </Box>
      </Box>
    </SelectModal>
  );
};
