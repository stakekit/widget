import { Content, Overlay, Portal, Root, Title } from "@radix-ui/react-dialog";
import { Root as VisuallyHiddenRoot } from "@radix-ui/react-visually-hidden";
import clsx from "clsx";
import type { ChangeEvent, PropsWithChildren, ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { id } from "../../../styles/theme/ids";
import { Box } from "../../primitives/box";
import { SearchIcon } from "../../primitives/icons/search";
import { XIcon } from "../../primitives/icons/x-icon";
import { ListItem } from "../../primitives/list/list-item";
import type { ItemContainerVariants } from "../../primitives/list/styles.css";
import { Spinner } from "../../primitives/spinner";
import { Text } from "../../primitives/typography/text";
import { useWidgetPresentation } from "../../widget-presentation";
import {
  container,
  content,
  contentSize,
  noOutline,
  overlay,
  selectModalItemButton,
  selectModalItemContainer,
} from "./styles.css";

type SelectModalWithoutStateProps = PropsWithChildren<
  {
    title?: string;
    /** Accessible dialog name when `title` is omitted (VisuallyHidden). */
    dialogTitle?: string;
    inputPlaceholder?: string;
    trigger?: ReactNode;
    onClose?: () => void;
    onOpen?: () => void;
    searchValue?: string;
    isLoading?: boolean;
    errorMessage?: string;
    disableClose?: boolean;
    hideTopBar?: boolean;
    headerAlignment?: "start" | "center";
    headerStart?: ReactNode;
    size?: "default" | "compact";
  } & (
    | {
        onSearch: (value: string) => void;
        searchValue: string;
      }
    | {
        onSearch?: never;
        searchValue?: never;
      }
  )
>;

type SelectModalContextType = {
  isOpen: boolean;
  setOpen: (val: boolean) => void;
};

export type SelectModalProps = SelectModalWithoutStateProps & {
  state?: SelectModalContextType;
  portalContainer?: HTMLElement;
};

const SelectModalContext = createContext<SelectModalContextType | undefined>(
  undefined
);

const useSelectModalContext = () => {
  const value = useContext(SelectModalContext);

  if (!value) {
    throw new Error("SelectModalContext is not provided");
  }

  return value;
};

const SelectModalWithoutState = ({
  children,
  trigger,
  title,
  dialogTitle,
  onSearch,
  searchValue,
  inputPlaceholder,
  isLoading,
  errorMessage,
  disableClose,
  hideTopBar,
  headerAlignment = "start",
  headerStart,
  size = "default",
  portalContainer,
}: SelectModalProps) => {
  const { isOpen, setOpen } = useSelectModalContext();
  const { t } = useTranslation();
  const { portalContainer: configuredPortalContainer } =
    useWidgetPresentation();

  const showTopBar = !!title || !hideTopBar || onSearch;

  return (
    <Root open={isOpen} onOpenChange={setOpen}>
      {trigger}

      <Portal container={configuredPortalContainer ?? portalContainer}>
        <Box className={container} data-select-modal data-rk={id}>
          <Overlay onClick={() => setOpen(false)} className={overlay} />

          <Content
            data-testid="select-modal__container"
            className={clsx(content, contentSize[size])}
            aria-describedby={undefined}
          >
            <Box display="flex" flexDirection="column" height="full">
              {showTopBar && (
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  px="4"
                >
                  {(headerStart || headerAlignment === "center") && (
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      width="7"
                    >
                      {headerStart}
                    </Box>
                  )}
                  <Box
                    flex={1}
                    display="flex"
                    alignItems="center"
                    justifyContent={
                      headerAlignment === "center" ? "center" : "flex-start"
                    }
                    gap="2"
                  >
                    {title ? (
                      <Title>
                        <Text
                          data-testid="select-modal__title"
                          variant={{ weight: "bold", size: "large" }}
                        >
                          {title}
                        </Text>
                      </Title>
                    ) : (
                      <VisuallyHiddenRoot asChild>
                        <Title>{dialogTitle ?? "Selection Modal"}</Title>
                      </VisuallyHiddenRoot>
                    )}

                    {isLoading && <Spinner />}
                  </Box>
                  {!disableClose && (
                    <Box
                      as="button"
                      type="button"
                      aria-label={t("wallet_modal.close")}
                      display="flex"
                      justifyContent="center"
                      width={headerAlignment === "center" ? "7" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <XIcon />
                    </Box>
                  )}
                </Box>
              )}

              {onSearch && (
                <Box
                  display="flex"
                  mx="4"
                  my="2"
                  background="tokenSelectBackground"
                  borderRadius="xl"
                  alignItems="center"
                  as="label"
                >
                  <Box mx="3" display="flex" alignItems="center">
                    <SearchIcon />
                  </Box>
                  <Box
                    data-testid="select-modal__search-input"
                    className={noOutline}
                    as="input"
                    border="none"
                    flex={1}
                    py="3"
                    borderRadius="xl"
                    color="text"
                    placeholder={inputPlaceholder ?? ""}
                    value={searchValue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onSearch(e.target.value)
                    }
                  />
                </Box>
              )}

              {!!errorMessage && (
                <Box
                  display="flex"
                  justifyContent="center"
                  marginTop="4"
                  marginBottom="2"
                >
                  <Text variant={{ type: "danger" }}>{errorMessage}</Text>
                </Box>
              )}

              {children}
            </Box>
          </Content>
        </Box>
      </Portal>
    </Root>
  );
};

export const SelectModal = ({
  state,
  onClose,
  onOpen,
  ...props
}: SelectModalProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isOpen = state ? state.isOpen : internalIsOpen;

  const value = useMemo<SelectModalContextType>(
    () => ({
      isOpen,
      setOpen: (val) => {
        if (state) {
          state.setOpen(val);
        } else {
          setInternalIsOpen(val);
        }

        if (val === isOpen) return;

        if (val) {
          onOpen?.();
        } else {
          onClose?.();
        }
      },
    }),
    [isOpen, state, onOpen, onClose]
  );

  return (
    <SelectModalContext.Provider value={value}>
      <SelectModalWithoutState {...props} />
    </SelectModalContext.Provider>
  );
};

export const SelectModalItemContainer = ({ children }: PropsWithChildren) => (
  <Box mx="4" className={selectModalItemContainer}>
    {children}
  </Box>
);

export const SelectModalItem = ({
  children,
  onItemClick,
  testId,
  variant,
  className,
  selected,
}: PropsWithChildren<{
  onItemClick?: (args: { closeModal: () => void }) => void;
  testId?: string;
  variant?: ItemContainerVariants;
  className?: string;
  selected?: boolean;
}>) => {
  const { setOpen } = useSelectModalContext();
  const onClick = () => onItemClick?.({ closeModal: () => setOpen(false) });

  return (
    <ListItem
      as="button"
      type="button"
      disabled={variant?.type === "disabled"}
      variant={{
        appearance: "plain",
        ...variant,
        active: selected ? "active" : variant?.active,
      }}
      onClick={onClick}
      testId={testId}
      data-selected={selected || undefined}
      className={clsx(selectModalItemButton, className)}
    >
      {children}
    </ListItem>
  );
};
