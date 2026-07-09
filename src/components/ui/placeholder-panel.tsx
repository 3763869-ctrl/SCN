import { PageHeader } from "@/components/layout/page-header";

type PlaceholderPanelProps = {
  title: string;
  description: string;
};

export function PlaceholderPanel({ title, description }: PlaceholderPanelProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <section className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold">{title} Workspace</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This route is ready for future data models, Supabase queries,
            permissions, forms, tables, and reporting workflows.
          </p>
        </div>
      </section>
    </div>
  );
}
