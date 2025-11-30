import { NavLink, Outlet } from "react-router-dom";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div className="space-y-0.5">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Birmingham Neighbourhood Environmental Health Index
            </h1>
            <p className="max-w-2xl text-xs text-slate-300 sm:text-sm">
              A 0–100 long-term environmental health score for every postcode
              district, combining air quality, noise, and access to green space.
            </p>
          </div>

          <nav className="ml-4 flex gap-2 text-xs sm:text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                [
                  "rounded-full px-3 py-1",
                  "transition-colors",
                  isActive
                    ? "bg-emerald-500/90 text-slate-950"
                    : "text-slate-200 hover:bg-slate-800",
                ].join(" ")
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/methods"
              className={({ isActive }) =>
                [
                  "rounded-full px-3 py-1",
                  "transition-colors",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-200 hover:bg-slate-800",
                ].join(" ")
              }
            >
              Methods
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-xs text-slate-400 md:px-6">
          <span>Birmingham Environmental Health Index · Prototype</span>
          <span>Data sources: DEFRA, OS, ONS</span>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
