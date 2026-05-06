"use client";

import { useState, useTransition } from "react";
import { aiAdminCopilot } from "@/app/actions/ai";

type CopilotResponse = {
  answer?: string;
  suggested_query?: string;
  insights?: string[];
} | null;

export function AdminCopilot({
  stats,
}: {
  stats: { items: number; users: number; claims: number };
}) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CopilotResponse>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setResponse(null);

    startTransition(async () => {
      try {
        const result = await aiAdminCopilot({
          query: query.trim(),
          availableData: { stats },
        });
        setResponse(result as CopilotResponse);
      } catch {
        setError("AI Copilot is unavailable. Make sure the AI backend is running.");
      }
    });
  }

  return (
    <section className="mb-10 rounded-2xl border border-violet-200 bg-white p-5 dark:border-violet-800 dark:bg-sky-950">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <h2 className="text-lg font-semibold text-violet-700 dark:text-violet-300">
          AI Admin Copilot
        </h2>
      </div>
      <p className="mb-4 text-sm text-sky-700 dark:text-sky-300">
        Ask anything about system data — get instant insights, suggested queries, and summaries.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Which category has the most unclaimed items?"
          className="flex-1 rounded-md border border-violet-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400 dark:border-violet-700 dark:bg-sky-900"
        />
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          {isPending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error ? (
        <p className="mt-3 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {response ? (
        <div className="mt-4 space-y-3 rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm dark:border-violet-900 dark:bg-violet-950">
          {response.answer ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-500">
                Answer
              </p>
              <p className="text-sky-900 dark:text-sky-100">{response.answer}</p>
            </div>
          ) : null}

          {response.suggested_query ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-500">
                Suggested Query
              </p>
              <code className="block rounded-md bg-violet-100 px-3 py-2 text-xs dark:bg-violet-900">
                {response.suggested_query}
              </code>
            </div>
          ) : null}

          {response.insights && response.insights.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-500">
                Insights
              </p>
              <ul className="space-y-1 text-sky-800 dark:text-sky-200">
                {response.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-violet-400">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!response.answer && !response.suggested_query && !response.insights?.length ? (
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-sky-700 dark:text-sky-300">
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {/* Quick prompts */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          "Summarize today's activity",
          "Which items have been unclaimed the longest?",
          "Show claim approval rate",
        ].map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setQuery(prompt)}
            className="rounded-full border border-violet-200 px-3 py-1 text-xs text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900"
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
