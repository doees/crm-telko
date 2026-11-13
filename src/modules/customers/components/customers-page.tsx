"use client";
import {
  Plus,
  ArrowUpRight,
  Users,
  Layers,
  Download,
  Pencil,
  CircleCheck,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { canWrite, dateLabel, statusLabels } from "@/modules/crm/domain";
import { exportCsv } from "@/modules/crm/store";
import {
  Avatar,
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
export function CustomersPage() {
  const { state, open } = useCrm();
  const list = useList();
  const items = state.customers.filter(
    (c) =>
      (list.filter === "ALL" || c.status === list.filter) &&
      `${c.name} ${c.number} ${c.phone} ${c.email}`
        .toLowerCase()
        .includes(list.search.toLowerCase()),
  );
  const exportData = () =>
    exportCsv("nusa-pelanggan.csv", [
      ["Nomor", "Nama", "Email", "Telepon", "Alamat", "Status"],
      ...items.map((c) => [
        c.number,
        c.name,
        c.email,
        c.phone,
        c.address,
        statusLabels[c.status],
      ]),
    ]);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CUSTOMER EXPERIENCE"
        title="Pelanggan"
        description="Kenali setiap pelanggan. Bangun hubungan yang lebih berarti."
      >
        <button className="btn btn-secondary" onClick={exportData}>
          <Download size={16} />
          Ekspor CSV
        </button>
        <button
          className="btn btn-primary"
          disabled={!canWrite(state.role, "master")}
          onClick={() => open({ kind: "customer" })}
        >
          <Plus size={17} />
          Tambah pelanggan
        </button>
      </PageHeading>
      <div className="summary-strip">
        <div>
          <Users size={19} />
          <span>
            Total pelanggan<strong>{state.customers.length}</strong>
          </span>
        </div>
        <div>
          <CircleCheck size={19} />
          <span>
            Pelanggan aktif
            <strong>
              {state.customers.filter((c) => c.status === "ACTIVE").length}
            </strong>
          </span>
        </div>
        <div>
          <Layers size={19} />
          <span>
            Memiliki langganan
            <strong>
              {
                new Set(
                  state.subscriptions
                    .filter((s) => s.status !== "CANCELLED")
                    .map((s) => s.customerId),
                ).size
              }
            </strong>
          </span>
        </div>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Cari nama, nomor, email, atau telepon…"
          />
          <FilterSelect
            value={list.filter}
            onChange={list.setFilter}
            options={["ACTIVE", "INACTIVE"]}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Kontak</th>
                <th>Langganan</th>
                <th>Status</th>
                <th>Bergabung</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageItems(items, list.page).map((c, i) => (
                <tr key={c.id}>
                  <td>
                    <button
                      className="customer-cell"
                      onClick={() =>
                        open({ kind: "customer-detail", id: c.id })
                      }
                    >
                      <Avatar name={c.name} index={i} />
                      <span>
                        <strong>{c.name}</strong>
                        <small>{c.number}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="stacked-cell">
                      {c.email || "—"}
                      <small>{c.phone}</small>
                    </span>
                  </td>
                  <td>
                    {
                      state.subscriptions.filter(
                        (s) =>
                          s.customerId === c.id && s.status !== "CANCELLED",
                      ).length
                    }{" "}
                    layanan
                  </td>
                  <td>
                    <Badge status={c.status} />
                  </td>
                  <td className="muted-cell">{dateLabel(c.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Detail ${c.name}`}
                        onClick={() =>
                          open({ kind: "customer-detail", id: c.id })
                        }
                      >
                        <ArrowUpRight size={17} />
                      </button>
                      {canWrite(state.role, "master") && (
                        <>
                          <button
                            className="icon-button"
                            aria-label={`Edit ${c.name}`}
                            onClick={() => open({ kind: "customer", id: c.id })}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              open({
                                kind: "confirm",
                                title:
                                  c.status === "ACTIVE"
                                    ? "Nonaktifkan pelanggan?"
                                    : "Aktifkan pelanggan?",
                                description:
                                  "Pelanggan dengan langganan berjalan harus menyelesaikan pembatalan layanan terlebih dahulu.",
                                action: { type: "TOGGLE_CUSTOMER", id: c.id },
                              })
                            }
                          >
                            {c.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </>
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
