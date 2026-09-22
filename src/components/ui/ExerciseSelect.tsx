"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface ExerciseSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export function ExerciseSelect({ options, value, onChange, label }: ExerciseSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  const selectedIndex = Math.max(0, options.indexOf(value));

  const focusOption = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), options.length - 1);
    setActiveIndex(nextIndex);
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  };

  const close = (restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const open = (index = selectedIndex) => {
    setIsOpen(true);
    setActiveIndex(index);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.cancelAnimationFrame(frame);
    };
  }, [activeIndex, isOpen]);

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option);
    close();
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusOption((index + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusOption((index - 1 + options.length) % options.length);
        break;
      case "Home":
        event.preventDefault();
        focusOption(0);
        break;
      case "End":
        event.preventDefault();
        focusOption(options.length - 1);
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

  return (
    <div
      ref={rootRef}
      className="relative min-w-0 flex-1 sm:max-w-72"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            open(event.key === "ArrowDown" ? selectedIndex : Math.max(options.length - 1, 0));
          } else if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            close();
          }
        }}
        className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-left text-xs text-white outline-none transition-colors hover:border-white/20 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400/30"
      >
        <span className="min-w-0 flex-1 truncate" title={value}>{value}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-40 mt-2 max-h-64 w-[min(18rem,calc(100vw-3rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-1.5 shadow-2xl shadow-black/60"
        >
          {options.map((option, index) => {
            const isSelected = option === value;
            return (
              <button
                key={option}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={activeIndex === index ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => selectOption(index)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-xs leading-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                  isSelected
                    ? "bg-blue-400/15 text-blue-300"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words">{option}</span>
                <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
