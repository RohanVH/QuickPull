"use client";

import { Clock3, Copy, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

interface HistoryItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  timestamp: number;
}

function normalizeHistory(items: HistoryItem[]) {
  return items
    .map((item, index) => ({
      ...item,
      id: item.id || `${item.url}-${item.timestamp || index}`,
      timestamp: item.timestamp || Date.now() - index
    }))
    .filter((item, index, array) =>
      index === array.findIndex((candidate) => candidate.id === item.id && candidate.timestamp === item.timestamp)
    );
}

export function HistoryPanel() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem("quickpull-history");
    if (!raw) return;
    const normalized = normalizeHistory(JSON.parse(raw) as HistoryItem[]);
    setHistory(normalized);
    window.localStorage.setItem("quickpull-history", JSON.stringify(normalized));
  }, []);

  function clearHistory() {
    window.localStorage.removeItem("quickpull-history");
    setHistory([]);
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
  }

  return (
    <div className="glass-panel rounded-[32px] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300/80">Recent Pulls</p>
          <h3 className="mt-2 text-2xl font-semibold">Download history on this device</h3>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-[var(--muted)] transition hover:border-white/20 hover:text-[var(--foreground)]"
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-[var(--muted)]">
            Your recent downloads will appear here once you start pulling media.
          </div>
        ) : (
          history.map((item) => (
            <div
              key={`${item.id}-${item.timestamp}`}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-medium">{item.title}</p>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">{item.url}</p>
                <div className="mt-2 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-cyan-300/70">
                  <span>{item.platform}</span>
                  <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                    <Clock3 size={12} />
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyLink(item.url)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm transition hover:border-cyan-300/40"
              >
                <Copy size={15} />
                Copy link
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
