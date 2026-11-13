"use client";
import { useState } from "react";
import { Plus, ArrowUpRight, Pencil } from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import {
  Badge,
  PageHeading,
  Empty,
  Pagination,
  SearchInput,
} from "@/components/crm/ui";
import {
  useList,
  FilterSelect,
  pageItems,
} from "@/components/crm/page-helpers";
export function TicketsPage() {
  const { state, open } = useCrm();
  const list = useList();
  const [priority, setPriority] = useState("ALL");
  const [mine, setMine] = useState(false);
  const items = state.tickets.filter(
    (t) =>
      (list.filter === "ALL" || list.filter === t.status) &&
      (priority === "ALL" || priority === t.priority) &&
      (!mine || t.assignee === "Raka Wijaya") &&
      `${t.number} ${t.subject} ${state.customers.find((c) => c.id === t.customerId)?.name}`
        .toLowerCase()
        .includes(list.search.toLowerCase()),
  );
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CUSTOMER CARE"
        title="Tiket bantuan"
        description="Dengarkan kebutuhan pelanggan. Hadirkan solusi yang berarti."
      >
        {["ADMIN", "CS"].includes(state.role) && (
          <button
            className="btn btn-primary"
            onClick={() => open({ kind: "ticket" })}
          >
            <Plus size={17} />
            Buat tiket
          </button>
        )}
      </PageHeading>
      <div className="status-stat-grid">
        {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((status) => (
          <button
            key={status}
            className={`status-stat ${list.filter === status ? "selected" : ""}`}
            onClick={() =>
              list.setFilter(list.filter === status ? "ALL" : status)
            }
          >
            <Badge status={status} />
            <strong>
              {state.tickets.filter((t) => t.status === status).length}
            </strong>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Cari tiket atau nama pelanggan…"
          />
          <div className="toolbar-filters">
            <FilterSelect
              value={list.filter}
              onChange={list.setFilter}
              options={["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]}
            />
            <FilterSelect
              label="Filter prioritas"
              value={priority}
              onChange={(value) => {
                setPriority(value);
                list.setPage(1);
              }}
              options={["HIGH", "MEDIUM", "LOW"]}
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => {
                  setMine(e.target.checked);
                  list.setPage(1);
                }}
              />
              Tugas Raka
            </label>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tiket & keluhan</th>
                <th>Pelanggan</th>
                <th>Prioritas</th>
                <th>Status</th>
                <th>Penanggung jawab</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageItems(items, list.page).map((t) => (
                <tr key={t.id}>
                  <td>
                    <button
                      className="ticket-title-button"
                      onClick={() => open({ kind: "ticket-detail", id: t.id })}
                    >
                      <small>{t.number}</small>
                      <strong>{t.subject}</strong>
                    </button>
                  </td>
                  <td>
                    {state.customers.find((c) => c.id === t.customerId)?.name}
                  </td>
                  <td>
                    <Badge status={t.priority} />
                  </td>
                  <td>
                    <Badge status={t.status} />
                  </td>
                  <td>
                    <span className="assignee-cell">
                      <span>
                        {t.assignee === "Belum ditugaskan"
                          ? "—"
                          : t.assignee
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                      </span>
                      {t.assignee}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Detail ${t.number}`}
                        onClick={() =>
                          open({ kind: "ticket-detail", id: t.id })
                        }
                      >
                        <ArrowUpRight size={17} />
                      </button>
                      {["ADMIN", "CS"].includes(state.role) &&
                        ["OPEN", "IN_PROGRESS"].includes(t.status) && (
                          <button
                            className="icon-button"
                            aria-label={`Edit ${t.number}`}
                            onClick={() => open({ kind: "ticket", id: t.id })}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && <Empty />}
        <Pagination
          page={list.page}
          total={items.length}
          size={6}
          onChange={list.setPage}
        />
      </section>
    </div>
  );
}
