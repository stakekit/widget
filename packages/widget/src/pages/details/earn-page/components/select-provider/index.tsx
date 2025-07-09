import { Trigger } from "@radix-ui/react-dialog";
import { Box, CaretDownIcon, Text } from "@sk-widget/components";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { Image } from "@sk-widget/components/atoms/image";
import { ImageFallback } from "@sk-widget/components/atoms/image-fallback";
import { SelectYield } from "@sk-widget/components/molecules/select-yield";
import { useMultiYields } from "@sk-widget/hooks/api/use-multi-yields";
import { selectProviderTrigger } from "@sk-widget/pages/details/earn-page/components/select-provider/styles.css";
import { useEarnPageContext } from "@sk-widget/pages/details/earn-page/state/earn-page-context";
import {
  useEarnPageDispatch,
  useEarnPageState,
} from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import {
  breakWord,
  validatorPill,
} from "@sk-widget/pages/details/earn-page/styles.css";
import { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";

export const SelectProvider = () => {
  const { selectedStake, selectedProviderYieldId } = useEarnPageState();
  const { appLoading } = useEarnPageContext();
  const dispatch = useEarnPageDispatch();

  const { t } = useTranslation();

  const providerYieldIdOptions = selectedStake
    .filter((ss) => !!ss.args.enter.args?.providerId?.required)
    .chainNullable((ss) => ss.args.enter.args?.providerId?.options);

  const yields = useMultiYields(providerYieldIdOptions.orDefault([]));

  const selectedProviderYield = Maybe.fromRecord({
    selectedProviderYieldId,
    yields: Maybe.fromNullable(yields.data),
  }).chainNullable((val) =>
    val.yields.find((v) => v.id === val.selectedProviderYieldId)
  );

  return appLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={20} variant={{ size: "medium" }} />
    </Box>
  ) : (
    Maybe.fromRecord({
      selectedStake,
      providerYieldIdOptions,
      selectedProviderYield,
    })
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
                        containerProps={{ hw: "5" }}
                        imageProps={{ borderRadius: "full" }}
                        src={
                          val.selectedProviderYield.metadata.provider?.logoURI
                        }
                        fallback={
                          <Box marginRight="1">
                            <ImageFallback
                              name={
                                val.selectedProviderYield.metadata.provider
                                  ?.name ??
                                val.selectedProviderYield.metadata.name
                              }
                              tokenLogoHw="5"
                              textVariant={{
                                type: "white",
                                weight: "bold",
                              }}
                            />
                          </Box>
                        }
                      />
                    </Box>

                    <Text className={breakWord} variant={{ weight: "bold" }}>
                      {val.selectedProviderYield.metadata.provider?.name}
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
