import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-border text-muted",
  info: "border-primary-text text-primary-text",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  danger: "border-danger text-danger",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${TONE_CLASSES[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
