import * as React from "react"

import { cn } from "../../lib/utils"

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "h-4 w-4 rounded border-border text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...props}
      />
    )
  },
)

Checkbox.displayName = "Checkbox"

export { Checkbox }

