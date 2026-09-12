import { Library, Layers, ShoppingCart, Tag, Lightbulb, ChartColumn } from "lucide-react";

// Single source of truth for the app's primary navigation — used by the
// desktop tab bar (AppTabs, all 6 shown flat — see its comment on why it
// only renders at lg+) and the mobile bottom nav (BottomNav, which groups
// `secondary` entries under a "Plus" menu to keep 5 items in thumb reach
// instead of 6 cramped ones).
export const NAV_TABS = [
  { href: "/", label: "Albums", icon: Library },
  { href: "/series", label: "Séries", icon: Layers },
  { href: "/wishlist", label: "Achats", icon: ShoppingCart },
  { href: "/vente", label: "Ventes", icon: Tag },
  { href: "/ideas", label: "Idées", icon: Lightbulb, secondary: true },
  { href: "/stats", label: "Stats", icon: ChartColumn, secondary: true },
] as const;
