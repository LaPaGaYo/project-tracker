"use client";

interface NotificationBellProps {
  isOpen: boolean;
  unreadCount: number;
  onToggle: () => void;
}

function unreadLabel(unreadCount: number) {
  if (unreadCount === 1) {
    return "1 unread notification";
  }

  return `${unreadCount} unread notifications`;
}

export function NotificationBell({ isOpen, unreadCount, onToggle }: NotificationBellProps) {
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);
  const label =
    unreadCount > 0 ? `Notifications, ${unreadLabel(unreadCount)}` : "Notifications";

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-label={label}
      onClick={onToggle}
      className="group relative inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 text-sm font-semibold text-planka-text shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition hover:border-white/20 hover:bg-white/8"
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-planka-accent shadow-[0_0_18px_rgba(79,137,255,0.8)]" />
      <span>Notifications</span>
      {unreadCount > 0 ? (
        <span
          aria-label={unreadLabel(unreadCount)}
          className="absolute -right-1 -top-1 min-w-6 rounded-full bg-planka-accent px-2 py-0.5 text-center text-xs font-bold text-white ring-2 ring-[#11151b]"
        >
          {displayCount}
        </span>
      ) : null}
    </button>
  );
}
