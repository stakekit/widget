import { Text } from "../../../components/atoms/typography";
import { Box } from "../../../components/atoms/box";
import { PageContainer } from "../../components";
import { Button, Spinner } from "../../../components";
import { Footer } from "./components/footer";
import { SelectValidator } from "./components/select-validator";
import { HelpModal } from "../../../components/molecules/help-modal";
import { ConnectButton } from "../../../components/molecules/connect-button";
import { SelectTokenSection } from "./components/select-token-section";
import { SelectYieldSection } from "./components/select-yield-section";
import {
  DetailsContextProvider,
  useDetailsContext,
} from "./hooks/details-context";

const EarnPageComponent = () => {
  const {
    yieldType,
    buttonDisabled,
    onClick,
    isError,
    errorMessage,
    onStakeEnterIsLoading,
    selectedStakeYieldType,
    isFetching,
    isConnected,
    isLoading,
    buttonCTAText,
  } = useDetailsContext();

  const title = yieldType;

  return (
    <PageContainer>
      <Box>
        <Box>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center" minHeight="8">
              {selectedStakeYieldType && (
                <HelpModal modal={{ type: selectedStakeYieldType }} />
              )}
              <Text variant={{ size: "small" }}>{title}</Text>
              {(isFetching || isLoading) && (
                <Box display="flex" marginLeft="2">
                  <Spinner />
                </Box>
              )}
            </Box>
          </Box>

          <SelectTokenSection />

          <SelectYieldSection />

          <SelectValidator />
        </Box>

        {isError && (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            marginBottom="6"
          >
            <Text variant={{ type: "danger" }}>{errorMessage}</Text>
          </Box>
        )}

        <Box marginTop="4">
          <Footer />
        </Box>
      </Box>

      <Box
        flex={1}
        display="flex"
        justifyContent="flex-end"
        flexDirection="column"
        marginTop="8"
      >
        {isConnected ? (
          <Button
            disabled={buttonDisabled}
            isLoading={onStakeEnterIsLoading}
            onClick={onClick}
            variant={{
              color:
                buttonDisabled || onStakeEnterIsLoading
                  ? "disabled"
                  : "primary",
              animation: "press",
            }}
          >
            {buttonCTAText}
          </Button>
        ) : (
          <ConnectButton />
        )}
      </Box>
    </PageContainer>
  );
};

export const EarnPage = () => (
  <DetailsContextProvider>
    <EarnPageComponent />
  </DetailsContextProvider>
);