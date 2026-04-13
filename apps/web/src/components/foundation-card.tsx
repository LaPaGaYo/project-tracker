interface FoundationCardProps {
  title: string;
  description: string;
}

export function FoundationCard({ title, description }: FoundationCardProps) {
  return (
    <article className="rounded-2xl border border-white/8 bg-planka-card/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur">
      <h2 className="text-lg font-semibold text-planka-text">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-planka-text-muted">{description}</p>
    </article>
  );
}
