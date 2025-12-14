import * as React from "react"

import { cn } from "../../lib/utils"

type SelectProps = {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
  placeholder?: string
}

const Select = ({ value, onValueChange, children, className, placeholder }: SelectProps) => {
  const items: Array<{ value: string; label: React.ReactNode }> = []
  let computedPlaceholder: React.ReactNode = placeholder

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const childType: any = child.type
    const childProps: any = child.props

    if (childType?.displayName === "SelectTrigger") {
      const triggerChildren = React.Children.toArray(childProps?.children ?? [])
      triggerChildren.forEach((subChild) => {
        if (!React.isValidElement(subChild)) return
        const subChildType: any = subChild.type
        const subChildProps: any = subChild.props
        if (subChildType?.displayName === "SelectValue" && subChildProps?.placeholder) {
          computedPlaceholder = subChildProps.placeholder
        }
      })
    }

    if (childType?.displayName === "SelectContent") {
      const contentChildren = React.Children.toArray(childProps?.children ?? [])
      contentChildren.forEach((contentChild) => {
        if (!React.isValidElement(contentChild)) return
        const contentChildType: any = contentChild.type
        const contentChildProps: any = contentChild.props
        if (contentChildType?.displayName === "SelectItem") {
          items.push({
            value: contentChildProps?.value,
            label: contentChildProps?.children,
          })
        }
      })
    }
  })

  return (
    <select
      className={cn(
        "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" disabled>
        {computedPlaceholder || "Select an option"}
      </option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  )
}

const SelectTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({
  placeholder,
}: {
  placeholder?: React.ReactNode
}) => <>{placeholder ?? null}</>
SelectValue.displayName = "SelectValue"

const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
SelectContent.displayName = "SelectContent"

const SelectItem = ({
  children,
  value,
}: {
  children: React.ReactNode
  value: string
}) => <option value={value}>{children}</option>
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }

