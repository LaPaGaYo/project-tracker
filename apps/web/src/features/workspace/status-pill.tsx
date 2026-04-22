import type { ReactNode } from "react";

type StatusPillTone = "neutral" | "accent" | "success" | "warning" | "danger";

interface StatusPillProps {
  children: ReactNode;
  tone: StatusPillTone;
  className?: string;
}

const toneClasses: Record<StatusPillTone, string> = {
  neutral: "border border-white/10 bg-black/10 text-planka-text-muted",
  accent: "bg-planka-selected text-white ring-1 ring-[#4f89ff]",
  success: "bg-[#143326] text-[#9dd5b1] ring-1 ring-[#205339]",
  warning: "bg-[#3b2b10] text-[#f7cf7b] ring-1 ring-[#6f4e18]",
  danger: "bg-[#3c1717] text-[#f6b0ab] ring-1 ring-[#6c2722]"
};

export function StatusPill({ children, tone, className }: StatusPillProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
        toneClasses[tone],
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
