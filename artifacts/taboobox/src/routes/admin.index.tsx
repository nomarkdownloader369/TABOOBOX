import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardStats } from "@/components/site/DashboardStats";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { formatViews } from "@/lib/videos";
import { Sparkles, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Thumb } from "@/components/site/Thumb";

export const Route = createFileRoute("/admin/")({ head: () => ({ meta: [{ title: "Dashboard — TABOOBOX" }, { name: "description", content: "Manage the TABOOBOX video archive and publication activity." }, { property: "og:title", content: "Dashboard — TABOOBOX" }, { property: "og:description", content: "Manage the TABOOBOX video archive and publication activity." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Dashboard });

function Dashboard() {
  const { lang, t } = useI18n(); const ar = lang === "ar";
  const { videos, catalogLoadState } = useStore();
  const recent = [...videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  return (
    <div className="space-y-5">
      <header className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide">{ar ? "نظرة عامة" : "Overview"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{ar ? "ملخص مباشر لسجلات Supabase. لا تتضمن بيانات الاختبار المحلية." : "Live Supabase archive summary; local test samples are not included."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary"><Link to="/admin/videos"><Film />{ar ? "إدارة الفيديوهات" : "Manage videos"}</Link></Button>
          <Button asChild variant="ai"><Link to="/admin/publish"><Sparkles />{ar ? "استيراد ومراجعة فيديو" : "Import & review videos"}</Link></Button>
        </div>
      </header>
      <DashboardStats />
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b p-4"><h2 className="font-display text-lg font-bold uppercase">{ar ? "أضيف مؤخرًا" : "Recently added"}</h2><Link to="/admin/videos" className="text-xs font-semibold text-primary hover:underline">{ar ? "عرض الكل" : "View all"}</Link></div>
        {catalogLoadState === "loading" && <p role="status" className="p-8 text-center text-sm text-muted-foreground">{ar ? "جارٍ تحميل سجلات Supabase…" : "Loading live Supabase records…"}</p>}
        {catalogLoadState === "error" && <p role="alert" className="p-8 text-center text-sm text-destructive">{ar ? "تعذر تحميل سجلات Supabase المباشرة." : "Could not load live Supabase records."}</p>}
        {catalogLoadState === "ready" && !recent.length && <p className="p-8 text-center text-sm text-muted-foreground">{ar ? "الأرشيف المباشر فارغ حاليًا." : "The live archive is currently empty."}</p>}
        {recent.length > 0 && (
        <ul className="divide-y">
          {recent.map((v) => (
            <li key={v.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-surface-2/50">
              <div className="aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-surface-2 sm:w-24"><Thumb src={v.thumbnail} embed={v.embedUrl} alt="" /></div>
              <div className="min-w-0 flex-1">
                <Link to="/watch/$id" params={{ id: v.id }} className="block truncate text-sm font-semibold hover:text-primary">{v.title}</Link>
                <p className="text-xs text-muted-foreground">{formatViews(v.views)} {t("views")} · {v.duration}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${v.status === "published" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{ar ? v.status === "published" ? "منشور" : "قيد الانتظار" : v.status}</span>
            </li>
          ))}
        </ul>)}
      </section>
    </div>
  );
}
