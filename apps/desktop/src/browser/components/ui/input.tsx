import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "h-8 w-full min-w-0 appearance-none rounded-md px-2.5 py-1 text-sm transition-[color,background-color,border-color,box-shadow] outline-none selection:bg-selection selection:text-selection-foreground [caret-color:var(--caret-color)] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
  {
    variants: {
      chrome: {
        default:
          "border border-input bg-transparent shadow-xs dark:bg-input/30",
        ghost:
          "border border-transparent bg-transparent shadow-none hover:border-border/50 hover:bg-background/80",
      },
    },
    defaultVariants: {
      chrome: "default",
    },
  }
);

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & VariantProps<typeof inputVariants>
>(({ chrome, className, type, ...props }, ref) => {
  return (
    <input
      data-chrome={chrome ?? "default"}
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(inputVariants({ chrome, className }))}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input, inputVariants };
