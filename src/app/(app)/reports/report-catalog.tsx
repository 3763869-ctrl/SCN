"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, Star } from "lucide-react";

type ReportDefinition = {
  description: string;
  id: string;
  title: string;
};

type ReportCategory = {
  id: string;
  reports: ReportDefinition[];
  title: string;
};

function getReportHref(baseParams: string, reportId: string) {
  const params = new URLSearchParams(baseParams);
  params.set("report", reportId);

  return `/reports?${params.toString()}`;
}

export function ReportCatalog({
  baseParams,
  categories,
}: {
  baseParams: string;
  categories: ReportCategory[];
}) {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved = window.localStorage.getItem("rm-support.favoriteReports");

    return saved ? JSON.parse(saved) : [];
  });
  const reportMap = useMemo(
    () =>
      new Map(
        categories.flatMap((category) =>
          category.reports.map((report) => [report.id, report] as const),
        ),
      ),
    [categories],
  );
  const favoriteReports = favorites
    .map((id) => reportMap.get(id))
    .filter((report): report is ReportDefinition => Boolean(report));

  function toggleFavorite(reportId: string) {
    setFavorites((current) => {
      const next = current.includes(reportId)
        ? current.filter((id) => id !== reportId)
        : [...current, reportId];

      window.localStorage.setItem("rm-support.favoriteReports", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <section className="app-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-muted text-accent">
            <Star className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Favorite Reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mark reports you use often and they will stay here on this device.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {favoriteReports.length ? (
            favoriteReports.map((report) => (
              <Link
                className="rounded-md border border-border bg-background p-4 text-sm transition hover:-translate-y-0.5 hover:bg-surface-muted"
                href={getReportHref(baseParams, report.id)}
                key={report.id}
              >
                <span className="font-semibold">★ {report.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {report.description}
                </span>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground md:col-span-3">
              No favorites yet. Use the star on any report card below.
            </p>
          )}
        </div>
      </section>

      {categories.map((category) => (
        <section className="space-y-3" key={category.id}>
          <h2 className="text-base font-semibold">{category.title}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {category.reports.map((report) => {
              const isFavorite = favorites.includes(report.id);

              return (
                <div
                  className="group rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  key={report.id}
                >
                  <div className="flex gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-surface-muted text-accent">
                      <BarChart3 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Link className="min-w-0 flex-1" href={getReportHref(baseParams, report.id)}>
                      <span className="block font-semibold">{report.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {report.description}
                      </span>
                    </Link>
                    <button
                      aria-label={`Favorite ${report.title}`}
                      className={`grid h-8 w-8 place-items-center rounded-md transition hover:bg-surface-muted ${
                        isFavorite ? "text-yellow-500" : "text-muted-foreground"
                      }`}
                      onClick={() => toggleFavorite(report.id)}
                      type="button"
                    >
                      <Star
                        className="h-4 w-4"
                        fill={isFavorite ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
