import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "lib/utils";

export type LanguageOption = {
  code: string;
  label: string;
  shortLabel?: string;
};

type LanguageSelectorDropdownProps = {
  value: string;
  options: LanguageOption[];
  onChange: (code: string) => void;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
};

export const LanguageSelectorDropdown = ({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
}: LanguageSelectorDropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.code === value) ?? options[0],
    [options, value]
  );

  const selectedBadge = selected?.shortLabel || selected?.code?.toUpperCase() || "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    if (code !== value) {
      onChange(code);
    }
    setOpen(false);
  };

  return (
    <div className={cn("relative inline-block", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm",
          "bg-white/60 backdrop-blur-md shadow-sm",
          "border-gray-200 text-gray-800",
          "hover:bg-gray-50 transition-all",
          triggerClassName
        )}
      >
        <span className="inline-flex items-center justify-center rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700">
          {selectedBadge}
        </span>
        <span className="whitespace-nowrap">{selected?.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute left-0 z-50 mt-2 w-full min-w-full overflow-hidden rounded-xl",
            "bg-white/90 backdrop-blur-xl",
            "shadow-lg border border-gray-200",
            "animate-fade-in",
            menuClassName
          )}
        >
          {options.map((option) => {
            const isSelected = option.code === selected?.code;
            const optionBadge = option.shortLabel || option.code.toUpperCase();
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.code)}
                className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors",
                isSelected
                  ? "font-semibold text-blue-600"
                  : "text-gray-800 hover:bg-gray-100",
                optionClassName
              )}
            >
              <span className="inline-flex items-center justify-center rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700">
                {optionBadge}
              </span>
                <span className="flex-1">{option.label}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 text-blue-500" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
