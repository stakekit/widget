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
} from "./state/details-context";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";

const EarnPageComponent = () => {
  useTrackPage("earn");

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
    appLoading,
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
              <Text>{title}</Text>
              {selectedStakeYieldType && (
                <HelpModal modal={{ type: selectedStakeYieldType }} />
              )}
              {(isFetching || appLoading) && (
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
            my="4"
          >
            <Text variant={{ type: "danger" }} textAlign="center">
              {errorMessage}
            </Text>
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
          <ConnectButton
            disabled={appLoading}
            variant={{ color: appLoading ? "disabled" : "primary" }}
          />
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
