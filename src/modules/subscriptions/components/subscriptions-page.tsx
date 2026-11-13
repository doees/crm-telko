"use client";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  CircleCheck,
  Router,
  CreditCard,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { canWrite, money, dateLabel } from "@/modules/crm/domain";
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
export function SubscriptionsPage() {
  const { state, open } = useCrm();
  const list = useList();
  const items = state.subscriptions.filter((s) => {
    const c = state.customers.find((c) => c.id === s.customerId);
    const p = state.packages.find((p) => p.id === s.packageId);
    return (
      (list.filter === "ALL" || s.status === list.filter) &&
      `${s.number} ${c?.name} ${p?.name}`
        .toLowerCase()
        .includes(list.search.toLowerCase())
    );
  });
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SUBSCRIPTION MANAGEMENT"
        title="Langganan"
        description="Pantau perjalanan layanan, dari pendaftaran hingga aktivasi."
      >
        <button
          className="btn btn-primary"
          disabled={!canWrite(state.role, "operations")}
          onClick={() => open({ kind: "subscription" })}
        >
          <Plus size={17} />
          Langganan baru
        </button>
      </PageHeading>
      <div className="status-stat-grid">
        {["ACTIVE", "PENDING", "SUSPENDED", "CANCELLED"].map((s) => (
          <button
            className={`status-stat ${list.filter === s ? "selected" : ""}`}
            key={s}
            onClick={() => list.setFilter(list.filter === s ? "ALL" : s)}
          >
            <Badge status={s} />
            <strong>
              {state.subscriptions.filter((sub) => sub.status === s).length}
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
            placeholder="Cari nomor, pelanggan, atau paket…"
          />
          <FilterSelect
            value={list.filter}
            onChange={list.setFilter}
            options={["ACTIVE", "PENDING", "SUSPENDED", "CANCELLED"]}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Langganan</th>
                <th>Pelanggan</th>
                <th>Paket & harga kontrak</th>
                <th>Status</th>
                <th>Aktivasi</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {pageItems(items, list.page).map((s) => {
                const c = state.customers.find((c) => c.id === s.customerId);
                const p = state.packages.find((p) => p.id === s.packageId);
                const paid = state.invoices.some(
                  (i) => i.subscriptionId === s.id && i.status === "PAID",
                );
                const fulfilled =
                  !s.device ||
                  state.fulfillments.some(
                    (f) =>
                      f.subscriptionId === s.id && f.status === "FULFILLED",
                  );
                return (
                  <tr key={s.id}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() =>
                          open({ kind: "subscription-detail", id: s.id })
                        }
                      >
                        {s.number}
                      </button>
                      <small className="cell-subtext">
                        {dateLabel(s.createdAt)}
                      </small>
                    </td>
                    <td>{c?.name}</td>
                    <td>
                      <span className="stacked-cell">
                        {p?.name}
                        <small>{money(s.price)}/bulan</small>
                      </span>
                    </td>
                    <td>
                      <Badge status={s.status} />
                    </td>
                    <td>
                      <div className="readiness">
                        <span
                          className={paid ? "ready" : ""}
                          title={paid ? "Invoice lunas" : "Menunggu pembayaran"}
                        >
                          <CreditCard size={15} />
                          {paid ? "Lunas" : "Tagihan"}
                        </span>
                        <span
                          className={fulfilled ? "ready" : ""}
                          title={
                            fulfilled ? "Perangkat siap" : "Menunggu perangkat"
                          }
                        >
                          <Router size={15} />
                          {fulfilled ? "Siap" : "Perangkat"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Detail ${s.number}`}
                        onClick={() =>
                          open({ kind: "subscription-detail", id: s.id })
                        }
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
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
      <div className="info-note">
        <CircleCheck size={18} />
        <span>
          Langganan menunggu akan aktif otomatis setelah pembayaran dan
          pemenuhan perangkat diselesaikan di{" "}
          <Link href="/integrations">Pusat integrasi</Link>.
        </span>
      </div>
    </div>
  );
}
