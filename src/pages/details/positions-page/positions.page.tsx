import { Box, Spinner, Text } from "../../../components";
import { useTranslation } from "react-i18next";
import { useSKWallet } from "../../../hooks/wallet/use-sk-wallet";
import { ConnectButton } from "../../../components/molecules/connect-button";
import { usePositions } from "./hooks/use-positions";
import { PositionsListItem } from "./components/positions-list-item";
import { PageContainer } from "../../components";
import { virtuosoContainer } from "./style.css";
import { ListItem } from "../../../components/atoms/list/list-item";
import { ImportValidator } from "./components/import-validator";
import { VirtualList } from "../../../components/atoms/virtual-list";

export const PositionsPage = () => {
  const { positionsData, importValidators } = usePositions();

  const { isConnected } = useSKWallet();

  const { t } = useTranslation();

  const getContent = () => {
    if (positionsData.isLoading && positionsData.isFetching && isConnected) {
      return (
        <Box my="2" display="flex" flex={1} justifyContent="center">
          <Spinner />
        </Box>
      );
    } else if (!isConnected) {
      return (
        <Box my="2" flex={1}>
          <ConnectButton />
        </Box>
      );
    } else if (positionsData.isError) {
      return (
        <Box display="flex" justifyContent="center" my="2">
          <Text variant={{ type: "danger" }}>
            {t("shared.something_went_wrong")}
          </Text>
        </Box>
      );
    } else if (isConnected && !positionsData.data?.length) {
      return (
        <Box my="2">
          <Text variant={{ weight: "medium" }}>
            {t("positions.no_current_positions")}
          </Text>
        </Box>
      );
    }

    return null;
  };

  return (
    <PageContainer>
      <Box display="flex" justifyContent="center" flex={1}>
        {getContent()}

        {!!positionsData.data?.length && (
          <VirtualList
            className={virtuosoContainer}
            style={{ height: "auto" }}
            data={["header" as const, ...positionsData.data]}
            itemContent={(_index, item) =>
              item === "header" ? (
                <ListItem variant={{ hover: "disabled" }}>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap="2"
                    marginBottom="2"
                  >
                    <Box display="flex" flexDirection="column" gap="2" flex={2}>
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
        )}
      </Box>
    </PageContainer>
  );
};

export default PositionsPage;
