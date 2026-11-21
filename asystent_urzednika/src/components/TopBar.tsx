import React from "react";
import { Plus } from "lucide-react";

export type AppView = "calendar" | "workflow" | "knowledge" | "architecture";

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onNewRequest: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: "calendar", label: "Kalendarz wniosków" },
  { id: "workflow", label: "Workflow i analiza" },
  { id: "knowledge", label: "Baza wiedzy" },
  { id: "architecture", label: "Wdrożenie lokalne" },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onNavigate,
  onNewRequest,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate("calendar")}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-700 transition-colors cursor-pointer"
        >
          Asystent UDIP · Bydgoszcz
        </button>

        <nav className="flex items-center gap-6 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewRequest}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Wgraj wniosek
          </button>
        </div>
      </div>
    </header>
  );
};
