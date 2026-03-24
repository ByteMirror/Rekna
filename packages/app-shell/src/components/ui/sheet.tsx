import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../../lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  forceMount,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal> & {
  forceMount?: boolean;
}) {
  return (
    <SheetPrimitive.Portal
      data-slot="sheet-portal"
      forceMount={forceMount}
      {...props}
    />
  );
}

function SheetOverlay({
  className,
  forceMount,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay> & {
  forceMount?: boolean;
}) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      forceMount={forceMount}
      className={cn(
        "fixed inset-0 z-50 bg-black/45 transition-[opacity,backdrop-filter] duration-260 ease-out data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:opacity-100 data-[state=open]:backdrop-blur-[1px]",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  floating = false,
  forceMount,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  floating?: boolean;
}) {
  return (
    <SheetPortal forceMount={forceMount}>
      <SheetOverlay forceMount={forceMount} />
      <SheetPrimitive.Content
        forceMount={forceMount}
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-3 bg-background shadow-lg will-change-[opacity,transform] transition-[opacity,transform,box-shadow] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:pointer-events-none data-[state=closed]:duration-180 data-[state=closed]:opacity-0 data-[state=open]:duration-280 data-[state=open]:opacity-100",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:translate-x-6 data-[state=open]:translate-x-0 sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:-translate-x-6 data-[state=open]:translate-x-0 sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:-translate-y-4 data-[state=open]:translate-y-0",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:translate-y-4 data-[state=open]:translate-y-0",
          floating &&
            "overflow-hidden border border-border/70 bg-background/95 shadow-2xl backdrop-blur-sm data-[state=closed]:scale-[0.985] data-[state=open]:scale-100",
          floating &&
            side === "right" &&
            "top-3 right-3 bottom-3 h-auto max-h-[calc(100vh-1.5rem)] w-[min(calc(100vw-1.5rem),20rem)] rounded-2xl border",
          floating &&
            side === "left" &&
            "top-3 left-3 bottom-3 h-auto max-h-[calc(100vh-1.5rem)] w-[min(calc(100vw-1.5rem),20rem)] rounded-2xl border",
          floating &&
            side === "top" &&
            "top-3 right-3 left-3 rounded-2xl border",
          floating &&
            side === "bottom" &&
            "right-3 bottom-3 left-3 rounded-2xl border",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-3 right-3 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-3.5" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 p-3", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-1.5 p-3", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
