import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-opacity disabled:pointer-events-none disabled:opacity-50";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary-interactive text-on-primary hover:opacity-90",
  secondary: "border border-border text-text hover:bg-surface",
  danger: "border border-danger text-danger hover:bg-danger/10",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/** Shared button visual style, exported so `Link`/`NavLink` (which need real anchor semantics) can reuse the exact same classes instead of duplicating the utility string. */
export function buttonClasses(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return [BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].filter(Boolean).join(" ");
}

export type ActionLinkTone = "primary" | "danger" | "neutral";

const ACTION_LINK_TONE_CLASSES: Record<ActionLinkTone, string> = {
  primary: "text-primary-text hover:underline",
  danger: "text-danger hover:underline",
  neutral: "text-text hover:underline",
};

/** Shared style for inline text-style row/list actions (e.g. "Open", "Clone", "Remove") — deliberately not a bordered button, matches existing usage. */
export function actionLinkClasses(
  tone: ActionLinkTone = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  const sizeClass = size === "sm" ? "text-xs font-medium" : "text-sm font-medium";
  return [sizeClass, ACTION_LINK_TONE_CLASSES[tone], className].filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
