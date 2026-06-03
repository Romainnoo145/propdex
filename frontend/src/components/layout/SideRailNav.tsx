import { Link, useMatchRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth/useAuth";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Map,
  Bookmark,
  Scale,
  ScrollText,
  FileText,
  Settings,
  LogOut,
  Search,
} from "lucide-react";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  to: string;
  search?: Record<string, string>;
  badge?: React.ReactNode;
}

export default function SideRailNav() {
  const matchRoute = useMatchRoute();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/auth" });
  };

  const mainItems: NavItem[] = [
    {
      icon: <LayoutDashboard size={22} strokeWidth={1.5} />,
      label: "Dashboard",
      to: "/dashboard",
    },
    { icon: <Map size={22} strokeWidth={1.5} />, label: "Kaart", to: "/map" },
    {
      icon: <Bookmark size={22} strokeWidth={1.5} />,
      label: "Opgeslagen",
      to: "/opgeslagen",
    },
    {
      icon: <Search size={22} strokeWidth={1.5} />,
      label: "Verkenner",
      to: "/verkenner",
    },
    {
      icon: <ScrollText size={22} strokeWidth={1.5} />,
      label: "Beleid",
      to: "/beleid",
    },
    {
      icon: <Scale size={22} strokeWidth={1.5} />,
      label: "Jurisprudentie",
      to: "/jurisprudentie",
      search: {
        gemeente: undefined,
        vergunningstype: undefined,
        uitkomst: undefined,
        rechtsgrond: undefined,
        rechtbank_niveau: undefined,
        periode: undefined,
        view: undefined,
      } as unknown as Record<string, string>,
    },
  ];

  const renderNavButton = (item: NavItem) => {
    const isActive = matchRoute({ to: item.to });
    return (
      <div key={item.to + item.label} className="w-full flex justify-center">
        <Link
          to={item.to}
          search={item.search}
          aria-label={item.label}
          className="group relative flex justify-center"
        >
          <div className="relative flex h-12 w-12 items-center justify-center">
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-full bg-aura-obsidian shadow-[0_0_20px_rgba(14,17,17,0.3)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 transition-colors duration-300 ${isActive ? "text-aura-amber drop-shadow-sm" : "text-slate-500 group-hover:text-aura-ink"}`}
            >
              {item.icon}
              {item.badge}
            </span>
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            {item.label}
          </span>
        </Link>
      </div>
    );
  };

  const isSettingsActive = matchRoute({ to: "/instellingen" });

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed left-0 top-0 bottom-0 w-[130px] flex flex-col items-center justify-between py-10 z-[100]"
    >
      {/* Top: Logo */}
      <div className="w-full flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full overflow-hidden">
          <img
            src="/images/propdex-logo.svg"
            alt="Propdex"
            className="h-16 w-16"
          />
        </div>
      </div>

      {/* Middle: Nav buttons — no container, just floating buttons */}
      <div className="flex flex-col items-center gap-4">
        {mainItems.map(renderNavButton)}
      </div>

      {/* Bottom: System buttons — no container */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-full flex justify-center">
          <Link
            to="/documentatie"
            aria-label="Documentatie"
            className="group relative flex justify-center"
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              {matchRoute({ to: "/documentatie" }) && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-full bg-aura-obsidian shadow-[0_0_20px_rgba(14,17,17,0.3)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 transition-colors duration-300 ${matchRoute({ to: "/documentatie" }) ? "text-aura-amber drop-shadow-sm" : "text-slate-500 group-hover:text-aura-ink"}`}
              >
                <FileText size={22} strokeWidth={1.5} />
              </span>
            </div>
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Documentatie
            </span>
          </Link>
        </div>

        <div className="w-full flex justify-center">
          <Link
            to="/instellingen"
            aria-label="Instellingen"
            className="group relative flex justify-center"
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              {isSettingsActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-full bg-aura-obsidian shadow-[0_0_20px_rgba(14,17,17,0.3)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 transition-colors duration-300 ${isSettingsActive ? "text-aura-amber drop-shadow-sm" : "text-slate-500 group-hover:text-aura-ink"}`}
              >
                <Settings size={22} strokeWidth={1.5} />
              </span>
            </div>
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Instellingen
            </span>
          </Link>
        </div>
        <div className="w-full flex justify-center">
          <button
            onClick={handleLogout}
            aria-label="Uitloggen"
            className="group relative flex justify-center"
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span className="text-slate-500 transition-colors duration-300 group-hover:text-aura-ink">
                <LogOut size={22} strokeWidth={1.5} />
              </span>
            </div>
            <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-aura-obsidian/90 backdrop-blur-md px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Uitloggen
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
