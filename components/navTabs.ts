import { Library, Layers, ShoppingCart, Tag, Lightbulb, ChartColumn } from "lucide-react";

// Single source of truth for the app's primary navigation — used by the
// desktop tab bar (AppTabs) and the mobile bottom nav (BottomNav).
export const NAV_TABS = [
  { href: "/", label: "Albums", icon: Library },
  { href: "/series", label: "Séries", icon: Layers },
  { href: "/wishlist", label: "Achats", icon: ShoppingCart },
  { href: "/vente", label: "Ventes", icon: Tag },
  { href: "/ideas", label: "Idées", icon: Lightbulb },
  { href: "/stats", label: "Stats", icon: ChartColumn },
] as const;
