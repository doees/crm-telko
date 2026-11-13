"use client";
import { useState } from "react";
import { Filter } from "lucide-react";
import { statusLabels } from "@/modules/crm/domain";
export function useList() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  return {
    search,
    filter,
    page,
    setPage,
    setSearch: (s: string) => {
      setSearch(s);
      setPage(1);
    },
    setFilter: (s: string) => {
      setFilter(s);
      setPage(1);
    },
  };
}
export function FilterSelect({
  value,
  onChange,
  options,
  label = "Filter status",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label?: string;
}) {
  return (
    <label className="filter-select">
      <Filter size={14} />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="ALL">
          Semua {label === "Filter prioritas" ? "prioritas" : "status"}
        </option>
        {options.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s] ?? s}
          </option>
        ))}
      </select>
    </label>
  );
}
export function pageItems<T>(items: T[], page: number, size = 6) {
  return items.slice(
    (Math.min(page, Math.max(1, Math.ceil(items.length / size))) - 1) * size,
    Math.min(page, Math.max(1, Math.ceil(items.length / size))) * size,
  );
}
export function CardTitle({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
