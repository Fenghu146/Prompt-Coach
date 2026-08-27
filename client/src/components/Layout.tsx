import { Link, NavLink } from "react-router-dom";
export function Layout({ children }: { children: React.ReactNode }) {
  const link = (to: string, label: string) => (
    <NavLink to={to} className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
      {label}
    </NavLink>
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-slate-900">
            Prompt Coach
          </Link>
          <nav className="flex gap-1">
            {link("/", "新建案例")}
            {link("/library", "规则库")}
            {link("/generate", "生成 Prompt")}
            {link("/settings", "设置")}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
