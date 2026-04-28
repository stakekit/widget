import { Trigger } from "@radix-ui/react-dialog";
import { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { CaretDownIcon } from "../../../../../components/atoms/icons/caret-down";
import { Image } from "../../../../../components/atoms/image";
import { Text } from "../../../../../components/atoms/typography/text";
import { SelectYield } from "../../../../../components/molecules/select-yield";
import {
  getYieldProviderDetails,
  getYieldProviderYieldIds,
  isYieldWithProviderOptions,
} from "../../../../../domain/types/yields";
import { useMultiYields } from "../../../../../hooks/api/use-multi-yields";
import { useEarnPageContext } from "../../state/earn-page-context";
import {
  useEarnPageDispatch,
  useEarnPageState,
} from "../../state/earn-page-state-context";
import { breakWord, validatorPill } from "../../styles.css";
import { selectProviderTrigger } from "./styles.css";

export const SelectProvider = () => {
  const { selectedStake, selectedProviderYieldId } = useEarnPageState();
  const { appLoading } = useEarnPageContext();
  const dispatch = useEarnPageDispatch();

  const { t } = useTranslation();

  const providerYieldIdOptions = selectedStake
    .filter(isYieldWithProviderOptions)
    .map(getYieldProviderYieldIds);

  const yields = useMultiYields(providerYieldIdOptions.orDefault([]));

  const selectedProviderYield = Maybe.fromRecord({
    selectedProviderYieldId,
    yields: Maybe.fromNullable(yields.data),
  }).chainNullable((val) =>
    val.yields.find((v) => v.id === val.selectedProviderYieldId)
  );

  const providerSelection = Maybe.fromRecord({
    selectedStake,
    providerYieldIdOptions,
    selectedProviderYield,
  }).chain((val) =>
    Maybe.fromNullable(getYieldProviderDetails(val.selectedProviderYield)).map(
      (provider) => ({
        ...val,
        provider,
      })
    )
  );

  return appLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : (
    providerSelection
      .map((val) => (
        <SelectYield
          onItemClick={(yieldDto) =>
            dispatch({ type: "providerYieldId/select", data: yieldDto.id })
          }
          providerYieldIds={val.providerYieldIdOptions}
          trigger={
            <Box
              className={selectProviderTrigger}
              display="flex"
              gap="2"
              alignItems="center"
            >
              <Text>{t("details.earn_with")}</Text>

              <Trigger asChild>
                <Box as="button" display="flex" gap="1">
                  <Box
                    data-rk="select-validator-trigger"
                    className={validatorPill}
                  >
                    <Box marginRight="2">
                      <Image
                        wrapperProps={{ hw: "5" }}
                        imgProps={{ borderRadius: "full" }}
                        src={val.provider.logoURI}
                        fallbackName={val.provider.name}
                      />
                    </Box>

                    <Text className={breakWord} variant={{ weight: "bold" }}>
                      {val.provider.name}
                    </Text>
                  </Box>

                  <Box
                    data-rk="select-validator-caret-down"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <CaretDownIcon />
                  </Box>
                </Box>
              </Trigger>
            </Box>
          }
        />
      ))
      .extractNullable()
  );
};
