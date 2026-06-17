import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

export type KpiTone = "neutral" | "success" | "danger" | "warning";

interface KpiCardProps {
  label: string;
  value: string;
  subtext: string;
  trend?: { value: string; direction: "up" | "down" };
  icon: LucideIcon;
  tone?: KpiTone;
}

const toneStyles: Record<KpiTone, { iconBg: string; iconFg: string; bar: string }> = {
  neutral: {
    iconBg: "bg-muted",
    iconFg: "text-foreground",
    bar: "bg-foreground/10",
  },
  success: {
    iconBg: "bg-success-soft",
    iconFg: "text-success",
    bar: "bg-success",
  },
  danger: {
    iconBg: "bg-danger-soft",
    iconFg: "text-danger",
    bar: "bg-danger",
  },
  warning: {
    iconBg: "bg-warning-soft",
    iconFg: "text-warning",
    bar: "bg-warning",
  },
};

export function KpiCard({
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  tone = "neutral",
}: KpiCardProps) {
  const styles = toneStyles[tone];

  return (
    <Card className="interactive-card relative overflow-hidden border-border bg-surface shadow-sm">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${styles.bar}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {value}
            </div>
          </div>
          <div
            className={`h-10 w-10 rounded-lg ${styles.iconBg} ${styles.iconFg} flex items-center justify-center shrink-0`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{subtext}</p>
          {trend && (
            <span
              className={[
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                trend.direction === "up"
                  ? "bg-success-soft text-success"
                  : "bg-danger-soft text-danger",
              ].join(" ")}
            >
              {trend.direction === "up" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {trend.value}
            </span>
          )}
        </div>

        {/* Sparkline placeholder */}
        <div className="mt-4 h-8 flex items-end gap-1">
          {[40, 55, 35, 60, 50, 70, 45, 65, 55, 75, 60, 80].map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${styles.bar} opacity-30`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
