import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InAppNotification,
  markNotificationAsRead,
  subscribeToNotifications,
} from "@/lib/accessControl";

type NotificationsBellProps = {
  userId?: string | null;
  onAccessRequest?: () => void;
};

function formatNotificationDate(value: unknown) {
  if (!value) return "agora";
  const date = typeof (value as { toDate?: () => Date })?.toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "agora";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function NotificationsBell({ userId, onAccessRequest }: NotificationsBellProps) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeToNotifications(userId, setNotifications, setError);
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const handleNotification = async (notification: InAppNotification) => {
    try {
      await markNotificationAsRead(notification.id);
      setNotifications((items) => items.map((item) => (
        item.id === notification.id ? { ...item, readAt: new Date() } : item
      )));
    } catch {
      // The destination action remains available even if marking as read fails.
    }
    if (notification.type === "access_request") onAccessRequest?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ""}`}
          className="relative h-9 w-9 rounded-none text-[#acabaa]/50 hover:text-[#e7e5e5]"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-[#ee7d77] px-1 text-[9px] text-[#0e0e0e]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] rounded-none border-[#484848]/30 bg-[#131313]">
        <DropdownMenuLabel className="flex items-center justify-between text-[#e7e5e5]">
          Notificações
          {unreadCount > 0 && <span className="font-mono text-[9px] text-[#97a5ff]">{unreadCount} NOVAS</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {error && (
          <p className="px-3 py-3 text-xs text-[#ee7d77]">Não foi possível carregar as notificações.</p>
        )}
        {!error && notifications.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-5 text-xs text-[#acabaa]/60">
            <Check size={14} className="text-[#acc3ce]" /> Tudo em dia.
          </div>
        )}
        {notifications.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            onSelect={() => void handleNotification(notification)}
            className={`items-start rounded-none border-b border-white/[0.05] px-3 py-3 ${!notification.readAt ? "bg-[#97a5ff]/[0.06]" : ""}`}
          >
            <Clock3 size={14} className="mt-0.5 shrink-0 text-[#97a5ff]" />
            <span className="min-w-0 whitespace-normal">
              <span className="block text-[10px] tracking-[0.1em] text-[#e7e5e5]">{notification.title}</span>
              <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-[#acabaa]">{notification.body}</span>
              <span className="mt-1 block font-mono text-[9px] font-normal tracking-normal text-[#acabaa]/40">{formatNotificationDate(notification.createdAt)}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
