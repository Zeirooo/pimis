"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface ComboboxOption {
  value: string;
  label: string;
  meta?: string; // Additional info like SKU code
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  disabled?: boolean;
  showAllOnEmptySearch?: boolean;
}

export const Combobox = React.forwardRef<HTMLDivElement, ComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Select option...",
      searchPlaceholder = "Search...",
      emptyMessage = "No option found.",
      isLoading = false,
      disabled = false,
      showAllOnEmptySearch = true,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");
    const [isFocused, setIsFocused] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = React.useMemo(() => {
      if (!searchValue && !showAllOnEmptySearch) {
        return selectedOption ? [selectedOption] : [];
      }
      if (!searchValue) return options;
      const lower = searchValue.toLowerCase();
      return options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(lower) ||
          opt.meta?.toLowerCase().includes(lower),
      );
    }, [options, searchValue, showAllOnEmptySearch, selectedOption]);

    React.useEffect(() => {
      if (open && inputRef.current) {
        inputRef.current.focus();
      }
    }, [open]);

    const handleSelect = (currentValue: string) => {
      onValueChange(currentValue === value ? "" : currentValue);
      setOpen(false);
      setSearchValue("");
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onValueChange("");
      setSearchValue("");
    };

    React.useEffect(() => {
      if (!showAllOnEmptySearch && open && !searchValue && !selectedOption) {
        setOpen(false);
      }
    }, [open, searchValue, showAllOnEmptySearch, selectedOption]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            ref={ref}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-background/80 cursor-pointer transition-colors"
            role="combobox"
            aria-expanded={open}
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.focus();
              }
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={isFocused ? placeholder : selectedOption?.label || placeholder}
              value={searchValue}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (selectedOption && !searchValue && nextValue) {
                  onValueChange("");
                }
                setSearchValue(nextValue);
                if (!open && nextValue) setOpen(true);
              }}
              onFocus={() => {
                setIsFocused(true);
                if (showAllOnEmptySearch || searchValue) {
                  setOpen(true);
                }
              }}
              onBlur={() => setIsFocused(false)}
              disabled={disabled || isLoading}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={placeholder}
            />
            {selectedOption && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {filteredOptions.length === 0 ? (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">{option.label}</span>
                        {option.meta && (
                          <span className="text-xs text-muted-foreground">
                            {option.meta}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
Combobox.displayName = "Combobox";
