"use client";

import { useEffect, useRef, useState } from "react";

interface AccountOption {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

interface Props {
  label?: string;
  selected: AccountOption | null;
  onSelect: (account: AccountOption) => void;
}

/**
 * Type-to-search dropdown for picking a user account — used anywhere an
 * admin needs to assign something (a site, a campaign target, etc.) to a
 * specific account rather than acting on their own.
 */
export function AccountPicker({ label = "Assign to account", selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      setResults(body.users ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1 block text-sm text-muted">{label}</label>
      {selected ? (
        <div className="flex items-center justify-between rounded-chip border border-line bg-paper px-3 py-2 text-sm">
          <span>
            {selected.full_name || "(no name)"}{" "}
            <span className="text-muted">· {selected.email ?? "no email"} · {selected.role}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null as unknown as AccountOption);
              setQuery("");
              setOpen(true);
            }}
            className="text-xs text-brand-blue underline"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search by name or email…"
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      )}

      {open && !selected && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-chip border border-line bg-white shadow-md">
          {loading && <p className="p-3 text-xs text-muted">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="p-3 text-xs text-muted">No accounts match.</p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelect(u);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-paper"
            >
              <span className="font-medium">{u.full_name || "(no name)"}</span>{" "}
              <span className="text-xs text-muted">
                · {u.email ?? "no email"} · {u.role}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
