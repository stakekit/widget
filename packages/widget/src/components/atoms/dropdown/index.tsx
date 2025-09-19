import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Fragment } from "react";
import { useSettings } from "../../../providers/settings";
import { id } from "../../../styles/theme/ids";
import { Box } from "../box";
import { CaretDownIcon } from "../icons/caret-down";
import { Text } from "../typography/text";
import {
  dropdownContent,
  dropdownGroup,
  dropdownItem,
  separator,
  trigger,
} from "./styles.css";

interface DropdownProps<T extends { label: string; value: string }> {
  options: T[];
  onSelect: (option: T["value"]) => void;
  selectedOption: T | undefined;
  placeholder: string;
  isError?: boolean;
}

export function Dropdown<T extends { label: string; value: string }>({
  options,
  onSelect,
  selectedOption,
  placeholder,
  isError,
}: DropdownProps<T>) {
  const { portalContainer } = useSettings();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Box
          className={trigger}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap="2"
          borderStyle="solid"
          borderColor={isError ? "textDanger" : "transparent"}
          borderWidth={1}
        >
          <Text>{selectedOption?.label ?? placeholder}</Text>

          <CaretDownIcon />
        </Box>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal container={portalContainer}>
        <Box data-rk={id}>
          <DropdownMenu.Content className={dropdownContent} sideOffset={3}>
            <DropdownMenu.RadioGroup
              className={dropdownGroup}
              value={selectedOption?.value}
              onValueChange={onSelect}
            >
              {options.map((option, i) => (
                <Fragment key={option.value}>
                  <DropdownMenu.RadioItem
                    className={dropdownItem}
                    value={option.value}
                  >
                    <Text>{option.label}</Text>
                  </DropdownMenu.RadioItem>

                  {i < options.length - 1 && (
                    <DropdownMenu.Separator className={separator} />
                  )}
                </Fragment>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </Box>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
