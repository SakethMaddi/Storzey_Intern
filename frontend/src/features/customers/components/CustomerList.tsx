import { useState } from "react";
import type { Customer, Order, PaginationMeta, Payment } from "../../../types";
import { CustomerEditModal } from "./CustomerEditModal";

export interface CustomerListProps {
  customers: Customer[];
  pagination?: PaginationMeta | null;
  onPageChange?: (newPage: number) => void;
  editingCustomer: Customer | null;
  editCustomerName: string;
  editCustomerPhone: string;
  editCustomerEmail?: string;
  editCustomerErrors: { name?: string; phone?: string; email?: string };
  editCustomerApiError: string;
  editCustomerSuccess: string;
  isSubmittingCustomerEdit: boolean;
  onStartEdit: (customer: Customer) => void;
  onCancelEdit: () => void;
  onEditNameChange: (val: string) => void;
  onEditPhoneChange: (val: string) => void;
  onEditEmailChange?: (val: string) => void;
  onUpdateCustomerSubmit: (e: React.FormEvent) => void;
  onArchiveCustomer: (customerId: number) => void;
  onRestoreCustomer: (customerId: number) => void;
  onDeleteCustomer: (customerId: number) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  loading: boolean;
  loadError: string;
  onRetry: () => void;
  orders: Order[];
  payments: Record<number, Payment[]>;
  onOpenOrder: (customer: Customer, orderId?: number) => void;
  onCreateOrderForCustomer?: (customer: Customer) => void;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function inr(amount: number | undefined): string {
  return `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;
}

function paymentLabel(status: string): string {
  if (status === "PAID") return "Paid";
  if (status === "PARTIALLY_PAID") return "Partially paid";
  if (status === "PENDING") return "Pending";
  return status.replace(/_/g, " ").toLowerCase();
}

export function CustomerList({
  customers,
  pagination,
  onPageChange,
  editingCustomer,
  editCustomerName,
  editCustomerPhone,
  editCustomerEmail = "",
  editCustomerErrors,
  editCustomerApiError,
  editCustomerSuccess,
  isSubmittingCustomerEdit,
  onStartEdit,
  onCancelEdit,
  onEditNameChange,
  onEditPhoneChange,
  onEditEmailChange,
  onUpdateCustomerSubmit,
  onArchiveCustomer,
  onRestoreCustomer,
  onDeleteCustomer,
  showArchived,
  onToggleArchived,
  searchTerm,
  onSearchChange,
  loading,
  loadError,
  onRetry,
  orders,
  payments,
  onOpenOrder,
  onCreateOrderForCustomer,
}: CustomerListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeSelectedId = editingCustomer?.id ?? selectedId;
  const selected =
    customers.find((customer) => customer.id === activeSelectedId) ??
    (editingCustomer && editingCustomer.id === activeSelectedId ? editingCustomer : null);
  const relatedOrders = selected
    ? orders.filter((order) => order.customerId === selected.id)
    : [];

  const confirmArchive = (customer: Customer) => {
    if (window.confirm(`Archive ${customer.name}? They will be moved to the archived customers list.`)) {
      onArchiveCustomer(customer.id);
    }
  };

  const confirmDelete = (customer: Customer) => {
    if (window.confirm(`Permanently delete ${customer.name}? This action cannot be undone.`)) {
      onDeleteCustomer(customer.id);
    }
  };

  const renderActions = (customer: Customer) => (
    <div className="table-actions-inline" onClick={(e) => e.stopPropagation()}>
      {!showArchived ? (
        <>
          {onCreateOrderForCustomer && !customer.isArchived && (
            <button
              type="button"
              className="btn-action-sm btn-action-order"
              onClick={(event) => {
                event.stopPropagation();
                onCreateOrderForCustomer(customer);
              }}
              title={`Create order for ${customer.name}`}
            >
              + Create Order
            </button>
          )}
          <button
            type="button"
            className="btn-action-sm"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(customer.id);
              onStartEdit(customer);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={(event) => {
              event.stopPropagation();
              confirmArchive(customer);
            }}
          >
            Archive
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn-action-sm"
            onClick={(event) => {
              event.stopPropagation();
              onRestoreCustomer(customer.id);
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="btn-ghost-danger-sm"
            onClick={(event) => {
              event.stopPropagation();
              confirmDelete(customer);
            }}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="customers-content-wrap">
      {/* ── TOOLBAR: SEARCH & SEGMENTED FILTER ── */}
      <div className="orders-control-bar">
        <div className="search-box">
          <svg
            className="search-icon"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="customer-search"
            type="search"
            value={searchTerm}
            placeholder="Search clients by name or phone..."
            aria-label="Search customers by name or phone"
            onChange={(event) => onSearchChange(event.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="search-clear-btn"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="segmented-toggle" role="group" aria-label="Customer status view">
          <button
            type="button"
            className={`segmented-btn ${!showArchived ? "is-active" : ""}`}
            onClick={() => {
              if (showArchived) onToggleArchived();
            }}
          >
            Active
          </button>
          <button
            type="button"
            className={`segmented-btn ${showArchived ? "is-active" : ""}`}
            onClick={() => {
              if (!showArchived) onToggleArchived();
            }}
          >
            Archived
          </button>
        </div>
      </div>

      {loadError && (
        <div className="inline-alert alert-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn-ghost-sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {/* ── EXPANDED CUSTOMER DETAILS PANEL ── */}
      {selected && (
        <section className="customer-details-card" aria-label={`Details for ${selected.name}`}>
          <div className="card-top-row">
            <div className="card-id-name">
              <div className="customer-avatar-med">
                {selected.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="card-customer-title">{selected.name}</h3>
                <span className="card-item-tag">
                  {selected.isArchived ? "Archived Client" : "Active Client"} · Added {formatDate(selected.createdAt)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => {
                setSelectedId(null);
                if (editingCustomer?.id === selected.id) onCancelEdit();
              }}
            >
              Close ✕
            </button>
          </div>

          {editingCustomer?.id === selected.id ? (
            <div className="customer-edit-subpanel">
              <CustomerEditModal
                customer={editingCustomer}
                editName={editCustomerName}
                editPhone={editCustomerPhone}
                editEmail={editCustomerEmail}
                errors={editCustomerErrors}
                apiError={editCustomerApiError}
                successMessage={editCustomerSuccess}
                submitting={isSubmittingCustomerEdit}
                onNameChange={onEditNameChange}
                onPhoneChange={onEditPhoneChange}
                onEmailChange={onEditEmailChange}
                onSubmit={onUpdateCustomerSubmit}
                onCancel={onCancelEdit}
              />
            </div>
          ) : (
            <div className="detail-data-grid" style={{ margin: "16px 0" }}>
              <div className="data-item">
                <span className="data-label">Phone</span>
                <strong className="data-value">
                  <a href={`tel:${selected.phone}`} className="link-phone">
                    {selected.phone}
                  </a>
                </strong>
              </div>
              <div className="data-item">
                <span className="data-label">Email</span>
                <strong className="data-value">{selected.email || "No email on file"}</strong>
              </div>
              <div className="data-item">
                <span className="data-label">Client Since</span>
                <strong className="data-value">{formatDate(selected.createdAt)}</strong>
              </div>
              <div className="data-item">
                <span className="data-label">Orders on File</span>
                <strong className="data-value">{relatedOrders.length}</strong>
              </div>
            </div>
          )}

          <div className="customer-panel-actions">
            {editingCustomer?.id !== selected.id && renderActions(selected)}
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => onOpenOrder(selected)}
            >
              Search All Orders for Client →
            </button>
          </div>

          {/* Customer Order History */}
          <div className="customer-history-section">
            <h4 className="subpanel-title">Order History</h4>
            {relatedOrders.length === 0 ? (
              <p className="detail-empty-text">
                No orders for this customer are currently loaded on this page.
              </p>
            ) : (
              <div className="customer-orders-mini-list">
                {relatedOrders.map((order) => {
                  const orderPayments = payments[order.id] ?? order.payments ?? [];
                  const paid = Math.max(0, order.totalAmount - order.balance);
                  return (
                    <div key={order.id} className="customer-order-item">
                      <div className="order-item-main">
                        <div>
                          <strong className="order-item-name">{order.itemName}</strong>
                          <span className="order-item-num">Order #{order.id}</span>
                        </div>
                        <span className={`status-badge-sm ${
                          order.paymentStatus === "PAID"
                            ? "badge-paid"
                            : order.paymentStatus === "PARTIALLY_PAID"
                            ? "badge-partial"
                            : "badge-pending"
                        }`}>
                          {paymentLabel(order.paymentStatus)}
                        </span>
                      </div>

                      <div className="order-item-amounts">
                        <span>Total: <strong>{inr(order.totalAmount)}</strong></span>
                        <span>Paid: <strong className="text-paid">{inr(paid)}</strong></span>
                        <span>Balance: <strong className={order.balance > 0 ? "text-balance" : "text-paid"}>{inr(order.balance)}</strong></span>
                      </div>

                      {orderPayments.length > 0 && (
                        <div className="order-payments-chips">
                          {orderPayments.map((p) => (
                            <span key={p.id} className="payment-chip-sm">
                              {inr(p.amount)} ({p.paymentType}) · {formatDate(p.createdAt)}
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn-link-action"
                        onClick={() => onOpenOrder(selected, order.id)}
                      >
                        View Full Order Details →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── CUSTOMER LISTING ── */}
      {loading && customers.length === 0 ? (
        <div className="empty-state-card" role="status">
          <div className="empty-spinner" />
          <p>Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon-wrap">👥</div>
          <h3>
            {searchTerm.trim()
              ? "No Customers Match Your Search"
              : showArchived
              ? "No Archived Customers"
              : "No Active Customers"}
          </h3>
          <p>
            {searchTerm.trim()
              ? "Try checking the phone number or name spelling."
              : showArchived
              ? "Archived customer records will be preserved here."
              : "Add your first boutique customer to start recording orders."}
          </p>
        </div>
      ) : (
        <>
          {/* ── DESKTOP CUSTOMERS TABLE ── */}
          <div className="desktop-table-wrapper">
            <table className="boutique-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Added</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", minWidth: "140px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const customerOrdersCount = orders.filter((o) => o.customerId === customer.id).length;
                  const isSelected = activeSelectedId === customer.id;

                  return (
                    <tr
                      key={customer.id}
                      className={`table-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(customer.id)}
                    >
                      <td className="cell-customer">
                        <div className="customer-info">
                          <strong className="customer-name">{customer.name}</strong>
                        </div>
                      </td>
                      <td>
                        <a
                          href={`tel:${customer.phone}`}
                          className="link-phone"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {customer.phone}
                        </a>
                      </td>
                      <td>{customer.email || <span className="muted-dash">—</span>}</td>
                      <td>
                        <span className="count-badge-sm">
                          {customerOrdersCount} {customerOrdersCount === 1 ? "order" : "orders"}
                        </span>
                      </td>
                      <td>{formatDate(customer.createdAt)}</td>
                      <td>
                        <span className={`status-badge-sm ${customer.isArchived ? "badge-archived" : "badge-active"}`}>
                          {customer.isArchived ? "Archived" : "Active"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {renderActions(customer)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── MOBILE CUSTOMER CARDS (< 768px) ── */}
          <div className="mobile-orders-list">
            {customers.map((customer) => {
              const customerOrdersCount = orders.filter((o) => o.customerId === customer.id).length;
              const isSelected = activeSelectedId === customer.id;

              return (
                <article
                  key={customer.id}
                  className={`boutique-order-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => setSelectedId(customer.id)}
                >
                  <div className="card-top-row">
                    <div className="card-id-name">
                      <div className="customer-avatar-mini">
                        {customer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="card-customer-title">{customer.name}</h3>
                        <span className="card-item-tag">
                          {customerOrdersCount} {customerOrdersCount === 1 ? "order" : "orders"} on file
                        </span>
                      </div>
                    </div>
                    <span className={`status-badge-sm ${customer.isArchived ? "badge-archived" : "badge-active"}`}>
                      {customer.isArchived ? "Archived" : "Active"}
                    </span>
                  </div>

                  <div className="card-metrics-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: "12px 0 8px" }}>
                    <div className="metric-box">
                      <span className="metric-label">Phone</span>
                      <a href={`tel:${customer.phone}`} className="link-phone" onClick={(e) => e.stopPropagation()}>
                        {customer.phone}
                      </a>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">Added Date</span>
                      <strong className="metric-value" style={{ fontSize: "13px" }}>
                        {formatDate(customer.createdAt)}
                      </strong>
                    </div>
                  </div>

                  <div className="card-actions-bar">
                    <button
                      type="button"
                      className="btn-action-view"
                      onClick={() => setSelectedId(customer.id)}
                    >
                      {isSelected ? "Hide Details" : "View Customer"}
                    </button>
                    {renderActions(customer)}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* ── PAGINATION ── */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="pagination-bar" role="navigation" aria-label="Customers pagination">
          <button
            type="button"
            className="pagination-btn"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="pagination-btn"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
