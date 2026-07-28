import {
  Building2,
  Megaphone,
  Target,
  Ticket,
  Database,
  Wallet,
  Zap,
  Folder,
  type LucideIcon,
} from "lucide-react";

/**
 * Íconos disponibles para los hubs de grupo (hero del grupo + sub-cards de
 * miembros). Las claves coinciden con el `icon` de `DashboardGroup` /
 * `GroupMember` (ver lib/dashboard-groups.ts).
 */
export const GROUP_ICON_MAP: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  target: Target,
  ticket: Ticket,
  database: Database,
  wallet: Wallet,
  zap: Zap,
  folder: Folder,
  "building-2": Building2,
};

export const FALLBACK_GROUP_ICON: LucideIcon = Ticket;
