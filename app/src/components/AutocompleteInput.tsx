"use client";

import { forwardRef, useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type AutocompleteOption = {
  id?: string;
  value: string;
  label?: string;
  description?: string;
};

type AutocompleteInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onSelect"> & {
  value: string;
  onValueChange: (value: string) => void;
  options?: AutocompleteOption[];
  onOptionSelect?: (option: AutocompleteOption) => void;
  maxOptions?: number;
};

function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

const AutocompleteInput = forwardRef<HTMLInputElement, AutocompleteInputProps>(function AutocompleteInput({
  value,
  onValueChange,
  options = [],
  onOptionSelect,
  maxOptions = 8,
  className,
  id,
  onFocus,
  onBlur,
  onKeyDown,
  ...inputProps
}, forwardedRef) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `${useId().replace(/:/g, "")}-suggestions`;
  const isComposing = useRef(false);

  const visibleOptions = useMemo(() => {
    const query = normalizeForSearch(value.trim());
    const seen = new Set<string>();

    return options.filter((option) => {
      const optionKey = normalizeForSearch(option.value);
      if (!optionKey || seen.has(optionKey)) return false;
      seen.add(optionKey);
      return !query || normalizeForSearch(`${option.label || option.value} ${option.description || ""}`).includes(query);
    }).slice(0, maxOptions);
  }, [maxOptions, options, value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!inputRef.current?.parentElement?.contains(target)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const effectiveActiveIndex = activeIndex >= 0 && activeIndex < visibleOptions.length ? activeIndex : -1;

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const selectOption = (option: AutocompleteOption) => {
    onValueChange(option.value);
    onOptionSelect?.(option);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || isComposing.current) return;

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!isOpen || visibleOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? visibleOptions.length - 1 : current - 1));
    } else if (event.key === "Enter" && effectiveActiveIndex >= 0) {
      event.preventDefault();
      selectOption(visibleOptions[effectiveActiveIndex]);
    }
  };

  return (
    <div className="relative">
      <input
        {...inputProps}
        ref={setInputRef}
        id={id}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={isOpen && visibleOptions.length > 0}
        aria-activedescendant={isOpen && effectiveActiveIndex >= 0 ? `${listId}-${effectiveActiveIndex}` : undefined}
        className={cn("h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:ring-destructive/40", className)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          setIsOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setIsOpen(false);
          onBlur?.(event);
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; }}
      />

      {isOpen && visibleOptions.length > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto border border-[#484848]/30 bg-[#1a1a1a] p-1 shadow-2xl">
          {visibleOptions.map((option, index) => (
            <li
              key={`${option.id || option.value}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={effectiveActiveIndex === index}
              className={cn("cursor-pointer px-3 py-2.5 text-xs text-[#e7e5e5]", effectiveActiveIndex === index && "bg-[#293e48] text-[#e7e5e5]")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              <span className="block truncate">{option.label || option.value}</span>
              {option.description && <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/50">{option.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

AutocompleteInput.displayName = "AutocompleteInput";

export default AutocompleteInput;
