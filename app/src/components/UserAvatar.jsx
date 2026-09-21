"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function getInitials(user) {
  const label = user?.displayName || user?.email || "Usuário";
  const parts = label.trim().split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return label.slice(0, 2).toUpperCase();
}

export default function UserAvatar({ user, size = "default", className = "" }) {
  const label = user?.displayName || user?.email || "Usuário";

  return (
    <Avatar size={size} className={className} aria-label={label}>
      {user?.photoURL ? (
        <AvatarImage src={user.photoURL} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className="bg-accent text-xs font-semibold text-primary">
        {getInitials(user)}
      </AvatarFallback>
    </Avatar>
  );
}
