export function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-brass"
      : tone === "negative"
        ? "text-brick"
        : "text-foreground";

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
