"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, ArrowUp, ArrowDown, Copy, Check, Table } from "lucide-react";

interface DataTableProps {
  data: Record<string, any>[];
  title?: string;
}

type SortDirection = "asc" | "desc" | null;
type ColumnType = "number" | "boolean" | "string";

function detectColumnType(data: Record<string, any>[], key: string): ColumnType {
  for (const row of data) {
    const val = row[key];
    if (val == null) continue;
    if (typeof val === "number") return "number";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "string" && val !== "" && !isNaN(Number(val))) return "number";
    return "string";
  }
  return "string";
}

function formatCell(value: any, type: ColumnType): string {
  if (value == null) return "\u2014";
  if (type === "boolean") return value ? "true" : "false";
  if (type === "number") {
    const num = typeof value === "string" ? Number(value) : value;
    if (Number.isFinite(num)) {
      return num % 1 === 0 ? num.toLocaleString() : num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
  }
  return String(value);
}

function compareValues(a: any, b: any, type: ColumnType): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (type === "number") {
    const numA = typeof a === "string" ? Number(a) : a;
    const numB = typeof b === "string" ? Number(b) : b;
    return numA - numB;
  }
  return String(a).localeCompare(String(b));
}

export default function DataTable({ data, title }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [copied, setCopied] = useState(false);

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    const keySet = new Set<string>();
    for (const row of data) {
      for (const key of Object.keys(row)) {
        keySet.add(key);
      }
    }
    return Array.from(keySet);
  }, [data]);

  const columnTypes = useMemo(() => {
    const types: Record<string, ColumnType> = {};
    for (const col of columns) {
      types[col] = detectColumnType(data, col);
    }
    return types;
  }, [data, columns]);

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const type = columnTypes[sortKey] ?? "string";
    return [...data].sort((a, b) => {
      const cmp = compareValues(a[sortKey], b[sortKey], type);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columnTypes]);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey, sortDir]);

  const copyAsCSV = useCallback(() => {
    const header = columns.join(",");
    const rows = sortedData.map(row =>
      columns.map(col => {
        const val = row[col];
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
    navigator.clipboard.writeText([header, ...rows].join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [columns, sortedData]);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-zinc-900 p-6 text-center text-zinc-400">
        No data to display.
      </div>
    );
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 text-indigo-400" />;
    return <ArrowDown className="h-3 w-3 text-indigo-400" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-white/[0.06] bg-zinc-900 overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-indigo-400" />
          {title && <span className="text-sm font-medium text-zinc-200">{title}</span>}
          <span className="text-xs text-zinc-500">
            {data.length} row{data.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={copyAsCSV}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy CSV"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-200 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    {col}
                    <SortIcon col={col} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors ${
                  i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                }`}
              >
                {columns.map(col => (
                  <td
                    key={col}
                    className={`px-4 py-2 text-zinc-200 whitespace-nowrap ${
                      columnTypes[col] === "number" ? "tabular-nums text-right" : ""
                    }`}
                  >
                    {formatCell(row[col], columnTypes[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
