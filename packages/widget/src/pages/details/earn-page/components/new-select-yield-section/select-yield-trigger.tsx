import { Trigger } from "@radix-ui/react-dialog";
import { Box, CaretDownIcon, Divider, Text } from "@sk-widget/components";
import { ProviderIcon } from "@sk-widget/components/atoms/token-icon/provider-icon";
import {
  breakWord,
  selectContainer,
} from "@sk-widget/pages/details/earn-page/components/new-select-yield-section/styles.css";
import { validatorPill } from "@sk-widget/pages/details/earn-page/styles.css";
import type { YieldDto } from "@stakekit/api-hooks";
import { useTranslation } from "react-i18next";

export const SelectYieldTrigger = ({
  selectedYield,
}: {
  selectedYield: YieldDto;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Box
        data-rk="select-validator-trigger-container"
        className={selectContainer}
      >
        <Box display="flex" alignItems="center" justifyContent="center">
          <Text className={breakWord} variant={{ weight: "bold" }}>
            {t("details.earn_with")}
          </Text>
        </Box>

        <Trigger asChild>
          <Box as="button" display="flex" gap="1">
            <>
              <Box>
                <Box
                  data-rk="select-validator-trigger"
                  className={validatorPill}
                >
                  <Box marginRight="2">
                    <ProviderIcon
                      tokenLogoHw="5"
                      hideNetwork
                      token={selectedYield.token}
                      metadata={selectedYield.metadata}
                    />
                  </Box>

                  <Text className={breakWord} variant={{ weight: "bold" }}>
                    {selectedYield.metadata.name}
                  </Text>
                </Box>
              </Box>

              <Box
                data-rk="select-validator-caret-down"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <CaretDownIcon />
              </Box>
            </>
          </Box>
        </Trigger>
      </Box>

      <Box marginTop="3">
        <Divider />
      </Box>
    </>
  );
};
