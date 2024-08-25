import { Trigger } from "@radix-ui/react-dialog";
import { Box, CaretDownIcon, SelectModal, Text } from "@sk-widget/components";
import { pressAnimation } from "@sk-widget/components/atoms/button/styles.css";

export const SelectNetwork: React.FC = () => {
  return (
    <SelectModal
      title="Select Network"
      trigger={
        <Trigger asChild>
          <Box
            width="full"
            as="button"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            background="backgroundMuted"
            borderRadius="2xl"
            px="3"
            py="2"
            className={pressAnimation}
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <Text>Network</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    />
  );
};
