import * as React from "react"

import { cn } from "../../lib/utils"

type TooltipContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null)

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

const Tooltip = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  )
}

const TooltipTrigger = React.forwardRef<
  HTMLElement,
  { children: React.ReactNode; asChild?: boolean } & React.HTMLAttributes<HTMLElement>
>(({ children, asChild = false, ...props }, ref) => {
  const ctx = React.useContext(TooltipContext)
  if (!ctx) return <>{children}</>
  const { setOpen } = ctx

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      onMouseEnter: () => setOpen(true),
      onMouseLeave: () => setOpen(false),
      ...props,
    })
  }

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </span>
  )
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  const ctx = React.useContext(TooltipContext)
  if (!ctx) return null
  const { open } = ctx

  if (!open) return null

  return (
    <div
      className={cn(
        "absolute left-1/2 z-50 mt-2 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md",
        className,
      )}
      role="tooltip"
    >
      {children}
    </div>
  )
}
TooltipContent.displayName = "TooltipContent"

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }

