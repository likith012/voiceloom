"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "./utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  style,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  style?: React.CSSProperties;
}) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      style={style}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 py-2",
        // Modern slider styling with CSS variables
        "[&>span[data-slot='slider-track']]:relative [&>span[data-slot='slider-track']]:w-full [&>span[data-slot='slider-track']]:overflow-hidden [&>span[data-slot='slider-track']]:rounded-full [&>span[data-slot='slider-track']]:bg-[var(--slider-track-bg,theme(colors.slate.200))] [&>span[data-slot='slider-track']]:dark:bg-[var(--slider-track-bg-dark,theme(colors.slate.700))]",
        "[&>span[data-slot='slider-track']]:h-[var(--slider-track-height,6px)]",
        "[&_span[data-slot='slider-range']]:absolute [&_span[data-slot='slider-range']]:h-full [&_span[data-slot='slider-range']]:rounded-full [&_span[data-slot='slider-range']]:bg-[var(--slider-range-bg,theme(colors.blue.500))]",
        "[&_span[data-slot='slider-thumb']]:block [&_span[data-slot='slider-thumb']]:rounded-full [&_span[data-slot='slider-thumb']]:border-2 [&_span[data-slot='slider-thumb']]:transition-all [&_span[data-slot='slider-thumb']]:duration-200 [&_span[data-slot='slider-thumb']]:ease-out",
        "[&_span[data-slot='slider-thumb']]:w-[var(--slider-thumb-size,16px)] [&_span[data-slot='slider-thumb']]:h-[var(--slider-thumb-size,16px)]",
        "[&_span[data-slot='slider-thumb']]:bg-[var(--slider-thumb-bg,theme(colors.white))] [&_span[data-slot='slider-thumb']]:border-[var(--slider-thumb-border,theme(colors.blue.500))]",
        "[&_span[data-slot='slider-thumb']]:shadow-[var(--slider-thumb-shadow,0_2px_8px_rgba(59,130,246,0.3))]",
        "[&_span[data-slot='slider-thumb']]:hover:scale-110 [&_span[data-slot='slider-thumb']]:active:scale-95",
        "[&_span[data-slot='slider-thumb']]:focus-visible:outline-none [&_span[data-slot='slider-thumb']]:focus-visible:ring-2 [&_span[data-slot='slider-thumb']]:focus-visible:ring-blue-500/50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track">
        <SliderPrimitive.Range data-slot="slider-range" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
