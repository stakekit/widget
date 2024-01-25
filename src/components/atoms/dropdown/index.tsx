import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Box } from "../box";
import { Text } from "../typography";
import {
  dropdownContent,
  dropdownGroup,
  dropdownItem,
  separator,
  trigger,
} from "./styles.css";
import { CaretDownIcon } from "../icons";
import { Fragment } from "react";

interface DropdownProps<T extends { label: string; value: string }> {
  options: T[];
  onSelect: (option: T["value"]) => void;
  selectedOption: T | undefined;
  placeholder: string;
}

export function Dropdown<T extends { label: string; value: string }>({
  options,
  onSelect,
  selectedOption,
  placeholder,
}: DropdownProps<T>) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Box
          className={trigger}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap="2"
        >
          <Text>{selectedOption?.label ?? placeholder}</Text>

          <CaretDownIcon />
        </Box>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content
        className={dropdownContent}
        sideOffset={3}
        align="start"
      >
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
    </DropdownMenu.Root>
  );
}
