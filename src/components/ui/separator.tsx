
import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={true}
    orientation="horizontal"
    className={cn(
      "shrink-0 bg-border h-[1px] w-full",
      className
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
