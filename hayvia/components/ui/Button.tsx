import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const baseStyles =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

const variantStyles: Record<Variant, string> = {
  primary: "bg-moss-600 text-white hover:bg-moss-700",
  secondary: "bg-transparent text-ink border border-ink/20 hover:border-ink/40 hover:bg-ink/[0.03]",
  ghost: "bg-transparent text-moss-700 hover:bg-moss-50",
};

const sizeStyles: Record<Size, string> = {
  md: "text-sm px-4 py-2.5 rounded",
  lg: "text-base px-6 py-3.5 rounded",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

interface ButtonAsButton
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  href?: undefined;
}

interface ButtonAsLink extends CommonProps {
  href: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  const { href: _href, ...buttonProps } = props as ButtonAsButton;
  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
