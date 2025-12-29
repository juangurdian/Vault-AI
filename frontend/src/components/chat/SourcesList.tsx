"use client";

type Source = {
  url: string;
  title?: string;
  type?: "web" | "local";
};

type SourcesListProps = {
  sources: Source[];
  webSources?: string[];
  localSources?: Array<{ text: string; metadata?: { source?: string } }>;
};

export default function SourcesList({
  sources,
  webSources = [],
  localSources = [],
}: SourcesListProps) {
  // Combine all sources
  const allSources: Source[] = [
    ...sources,
    ...webSources.map((url) => ({ url, type: "web" as const })),
    ...localSources.map((local) => ({
      url: local.metadata?.source || "Local knowledge base",
      title: local.text.substring(0, 100),
      type: "local" as const,
    })),
  ];

  // Deduplicate by URL
  const uniqueSources = Array.from(
    new Map(allSources.map((s) => [s.url, s])).values()
  );

  if (uniqueSources.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Sources</h3>
      <div className="space-y-2">
        {uniqueSources.map((source, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 rounded border border-slate-800 bg-slate-900/30 p-2 text-xs"
          >
            <span className="mt-0.5 shrink-0 text-slate-500">{idx + 1}.</span>
            <div className="min-w-0 flex-1">
              {source.url.startsWith("http") ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-cyan-400 hover:underline"
                >
                  {source.title || source.url}
                </a>
              ) : (
                <span className="font-medium text-slate-300">{source.title || source.url}</span>
              )}
              {source.type && (
                <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {source.type}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}




