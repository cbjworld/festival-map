import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Shadcn UI 스타일 컨벤션을 따르는 경량 Button 컴포넌트.
 * (shadcn CLI로 생성한 button.tsx와 동일한 인터페이스를 사용하므로
 *  나중에 `npx shadcn@latest add button`으로 교체해도 호환된다.)
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gray-900 text-white hover:bg-gray-800",
        primary: "bg-green-500 text-white hover:bg-green-600 focus-visible:ring-green-500",
        secondary: "bg-yellow-400 text-gray-900 hover:bg-yellow-500 focus-visible:ring-yellow-400",
        outline: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
        ghost: "hover:bg-gray-100 text-gray-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
