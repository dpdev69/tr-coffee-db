import Link from 'next/link';

export function DataSourceNotice({
  actionHref,
  actionLabel,
  message,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  message: string;
  title: string;
}) {
  return (
    <section
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left"
    >
      <p className="text-sm font-semibold text-amber-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-amber-900">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-3 inline-flex text-sm font-semibold text-amber-800 transition-colors hover:text-amber-950"
        >
          {actionLabel}
        </Link>
      )}
    </section>
  );
}
