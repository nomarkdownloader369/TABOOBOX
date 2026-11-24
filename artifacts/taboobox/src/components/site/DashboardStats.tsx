import { Film, CheckCircle2, Clock, Eye } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { formatViews } from "@/lib/videos";

export function DashboardStats() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { videos, catalogLoadState } = useStore();
  const hasLiveData =
    catalogLoadState === "ready" || (catalogLoadState === "error" && videos.length > 0);
  const stats = [
    {
      label: ar ? "إجمالي الفيديوهات" : "Total videos",
      value: hasLiveData ? videos.length : "—",
      icon: Film,
    },
    {
      label: ar ? "منشور" : "Published",
      value: hasLiveData ? videos.filter((v) => v.status === "published").length : "—",
      icon: CheckCircle2,
    },
    {
      label: ar ? "قيد الانتظار" : "Pending",
      value: hasLiveData ? videos.filter((v) => v.status === "pending").length : "—",
      icon: Clock,
    },
    {
      label: ar ? "إجمالي المشاهدات" : "Total views",
      value: hasLiveData ? formatViews(videos.reduce((s, v) => s + v.views, 0)) : "—",
      icon: Eye,
    },
  ];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-muted-foreground">
          {ar ? "بيانات أرشيف Supabase المباشرة" : "Live Supabase archive data"}
        </span>
        {catalogLoadState === "loading" && (
          <span role="status" className="text-muted-foreground">
            {ar ? "جارٍ تحميل السجلات…" : "Loading records…"}
          </span>
        )}
        {catalogLoadState === "error" && (
          <span role="alert" className="text-destructive">
            {ar ? "تعذر تحديث الأرشيف المباشر" : "Could not refresh live archive"}
          </span>
        )}
        {catalogLoadState === "ready" && videos.length === 0 && (
          <span className="text-muted-foreground">
            {ar ? "لا توجد سجلات بعد" : "No live records yet"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: I }) => (
          <div key={label} className="panel p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <span className="rounded-lg bg-primary/15 p-1.5">
                <I className="h-4 w-4 text-primary" />
              </span>
            </div>
            <p className="mt-2 font-display text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
