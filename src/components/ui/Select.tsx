"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  size?: "default" | "compact";
}

interface ListboxPosition {
  direction: "up" | "down";
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

const LISTBOX_GAP = 8;
const LISTBOX_MAX_HEIGHT = 256;
const LISTBOX_MIN_PREFERRED_SPACE = 192;
const VIEWPORT_PADDING = 8;

export function Select({
  options,
  value,
  onValueChange,
  label,
  disabled = false,
  placeholder = "Select",
  className = "w-full",
  triggerClassName = "",
  size = "default",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listboxPosition, setListboxPosition] = useState<ListboxPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const isUnavailable = disabled || !options.some((option) => !option.disabled);

  const firstEnabledIndex = () => options.findIndex((option) => !option.disabled);
  const lastEnabledIndex = () => {
    for (let index = options.length - 1; index >= 0; index -= 1) {
      if (!options[index].disabled) return index;
    }
    return -1;
  };

  const nextEnabledIndex = (fromIndex: number, direction: 1 | -1) => {
    if (options.length === 0) return -1;

    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (fromIndex + direction * offset + options.length) % options.length;
      if (!options[index].disabled) return index;
    }

    return -1;
  };

  const focusOption = (index: number) => {
    if (index < 0 || options[index]?.disabled) return;
    setActiveIndex(index);
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const close = (restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const updateListboxPosition = useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const availableBelow = window.innerHeight - triggerRect.bottom - LISTBOX_GAP - VIEWPORT_PADDING;
    const availableAbove = triggerRect.top - LISTBOX_GAP - VIEWPORT_PADDING;
    const opensUpward = availableBelow < LISTBOX_MIN_PREFERRED_SPACE && availableAbove > availableBelow;
    const availableSpace = opensUpward ? availableAbove : availableBelow;
    const width = Math.min(triggerRect.width, window.innerWidth - VIEWPORT_PADDING * 2);
    const left = Math.min(
      Math.max(triggerRect.left, VIEWPORT_PADDING),
      window.innerWidth - VIEWPORT_PADDING - width,
    );

    setListboxPosition({
      direction: opensUpward ? "up" : "down",
      left,
      maxHeight: Math.min(LISTBOX_MAX_HEIGHT, Math.max(0, availableSpace)),
      top: opensUpward ? triggerRect.top - LISTBOX_GAP : triggerRect.bottom + LISTBOX_GAP,
      width,
    });
  }, []);

  const open = (preferredIndex = selectedIndex) => {
    if (isUnavailable) return;

    const initialIndex = preferredIndex >= 0 && !options[preferredIndex]?.disabled
      ? preferredIndex
      : firstEnabledIndex();
    if (initialIndex < 0) return;

    updateListboxPosition();
    setActiveIndex(initialIndex);
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
        close(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updateListboxPosition);
    window.addEventListener("scroll", updateListboxPosition, true);
    window.visualViewport?.addEventListener("resize", updateListboxPosition);
    window.visualViewport?.addEventListener("scroll", updateListboxPosition);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updateListboxPosition);
      window.removeEventListener("scroll", updateListboxPosition, true);
      window.visualViewport?.removeEventListener("resize", updateListboxPosition);
      window.visualViewport?.removeEventListener("scroll", updateListboxPosition);
    };
  }, [isOpen, updateListboxPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, isOpen]);

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) {
      onValueChange(option.value);
    }
    close();
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption(nextEnabledIndex(index, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption(nextEnabledIndex(index, -1));
        break;
      case "Home":
        event.preventDefault();
        focusOption(firstEnabledIndex());
        break;
      case "End":
        event.preventDefault();
        focusOption(lastEnabledIndex());
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectOption(index);
        break;
    }
  };

  const sizeClasses = size === "compact"
    ? "px-3 py-2 text-xs"
    : "px-4 py-3 text-sm";

  const handleBlur = () => {
    window.requestAnimationFrame(() => {
      const focusedElement = document.activeElement;
      if (
        !rootRef.current?.contains(focusedElement)
        && !listboxRef.current?.contains(focusedElement)
      ) {
        setIsOpen(false);
      }
    });
  };

  const listbox = isOpen && listboxPosition && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          onBlur={handleBlur}
          style={{
            left: listboxPosition.left,
            maxHeight: listboxPosition.maxHeight,
            top: listboxPosition.top,
            width: listboxPosition.width,
          }}
          className={`fixed z-[120] overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-1.5 shadow-2xl shadow-black/60 ${listboxPosition.direction === "up" ? "-translate-y-full" : ""}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                tabIndex={activeIndex === index ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => selectOption(index)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left leading-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-green/50 disabled:cursor-not-allowed disabled:opacity-40 ${size === "compact" ? "text-xs" : "text-sm"} ${
                  isSelected
                    ? "bg-accent-green/15 text-accent-green"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words">{option.label}</span>
                <Check
                  aria-hidden="true"
                  className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`}
                />
              </button>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`relative min-w-0 ${className}`}
        onBlur={handleBlur}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${label}: ${selectedOption?.label ?? placeholder}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          disabled={isUnavailable}
          title={selectedOption?.label ?? placeholder}
          onClick={() => (isOpen ? close() : open())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              open(event.key === "ArrowDown" ? selectedIndex : lastEnabledIndex());
            } else if ((event.key === "Enter" || event.key === " ") && !isOpen) {
              event.preventDefault();
              open();
            } else if (event.key === "Escape" && isOpen) {
              event.preventDefault();
              close();
            }
          }}
          className={`flex w-full min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/50 text-left font-medium text-white outline-none transition-colors hover:border-white/20 focus-visible:border-accent-green focus-visible:ring-2 focus-visible:ring-accent-green/30 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses} ${triggerClassName}`}
        >
          <span className="min-w-0 flex-1 truncate">
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {listbox}
    </>
  );
}
