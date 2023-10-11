import { Box, Spinner, Text } from "../../../components";
import { useTranslation } from "react-i18next";
import { useSKWallet } from "../../../hooks/wallet/use-sk-wallet";
import { ConnectButton } from "../../../components/molecules/connect-button";
import { usePositions } from "./hooks/use-positions";
import { PositionsListItem } from "./components/positions-list-item";
import { PageContainer } from "../../components";
import { ListItem } from "../../../components/atoms/list/list-item";
import { ImportValidator } from "./components/import-validator";
import { VirtualList } from "../../../components/atoms/virtual-list";

export const PositionsPage = () => {
  const { positionsData, importValidators } = usePositions();

  const { isConnected } = useSKWallet();

  const { t } = useTranslation();

  const getContent = () => {
    if (positionsData.isLoading && positionsData.isFetching && isConnected) {
      return <FallbackContent type="spinner" />;
    } else if (!isConnected) {
      return <FallbackContent type="not_connected" />;
    } else if (positionsData.isError) {
      return <FallbackContent type="something_wrong" />;
    } else if (isConnected && !positionsData.data?.length) {
      return <FallbackContent type="no_current_positions" />;
    }

    return null;
  };

  const showPositions =
    isConnected &&
    (positionsData.data.length ||
      (!positionsData.isLoading && !positionsData.isError));

  return (
    <PageContainer>
      <Box display="flex" flex={1} flexDirection="column">
        {getContent()}

        {showPositions && (
          <Box flex={1}>
            <VirtualList
              data={["header" as const, ...positionsData.data]}
              itemContent={(_, item) =>
                item === "header" ? (
                  <ListItem variant={{ hover: "disabled" }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gap="2"
                      marginBottom="2"
                    >
                      <Box
                        display="flex"
                        flexDirection="column"
                        gap="2"
                        flex={2}
                      >
                        <Text variant={{ weight: "bold" }}>
                          {t("positions.dont_see_position")}
                        </Text>

                        <Text variant={{ weight: "normal", type: "muted" }}>
                          {t("positions.import_validator")}
                        </Text>
                      </Box>

                      <Box
                        flex={1}
                        display="flex"
                        justifyContent="flex-end"
                        alignItems="center"
                      >
                        <ImportValidator {...importValidators} />
                      </Box>
                    </Box>
                  </ListItem>
                ) : (
                  <PositionsListItem item={item} />
                )
              }
            />
          </Box>
        )}
      </Box>
    </PageContainer>
  );
};

const FallbackContent = ({
  type,
}: {
  type:
    | "not_connected"
    | "no_current_positions"
    | "spinner"
    | "something_wrong";
}) => {
  const { t } = useTranslation();

  const getContent = () => {
    if (type === "spinner") {
      return (
        <Box display="flex" justifyContent="center">
          <Spinner />
        </Box>
      );
    } else if (type === "not_connected") {
      return <ConnectButton />;
    } else if (type === "something_wrong") {
      return (
        <Text variant={{ type: "danger" }} textAlign="center">
          {t("shared.something_went_wrong")}
        </Text>
      );
    } else if (type === "no_current_positions") {
      return (
        <Text variant={{ weight: "medium" }} textAlign="center">
          {t("positions.no_current_positions")}
        </Text>
      );
    }

    return null;
  };

  return (
    <Box marginTop="2" marginBottom="4">
      {getContent()}
    </Box>
  );
};

export default PositionsPage;
