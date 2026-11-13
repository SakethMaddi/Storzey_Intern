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
}: CustomerListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeSelectedId = editingCustomer?.id ?? selectedId;
  const selected =
    customers.find((customer) => customer.id === activeSelectedId) ??
    (editingCustomer && editingCustomer.id === activeSelectedId ? editingCustomer : null);
  const relatedOrders = selected
    ? orders.filter((order) => order.customerId === selected.id)
    : [];
  const listedTotal = pagination ? pagination.total : customers.length;

  const confirmArchive = (customer: Customer) => {
    if (window.confirm(`Archive ${customer.name}? They won't appear in the main list.`)) {
      onArchiveCustomer(customer.id);
    }
  };

  const confirmDelete = (customer: Customer) => {
    if (window.confirm(`Permanently delete ${customer.name}? This cannot be undone.`)) {
      onDeleteCustomer(customer.id);
    }
  };

  const renderActions = (customer: Customer) => (
    <div className="customers-actions">
      {!showArchived ? (
        <>
          <button
            type="button"
            className="customers-btn customers-btn-primary"
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
            className="customers-btn customers-btn-warning"
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
            className="customers-btn customers-btn-success"
            onClick={(event) => {
              event.stopPropagation();
              onRestoreCustomer(customer.id);
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="customers-btn customers-btn-danger"
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
    <>
      <div className="customers-toolbar">
        <label className="customers-search">
          <span className="customers-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="16.5" y1="16.5" x2="21" y2="21"></line>
            </svg>
          </span>
          <input
            id="customer-search"
            type="search"
            value={searchTerm}
            placeholder="Search by name or phone"
            aria-label="Search customers by name or phone"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="customers-toolbar-side">
          <div className="customers-filter" role="group" aria-label="Customer list">
            <button
              type="button"
              className={!showArchived ? "is-selected" : ""}
              aria-pressed={!showArchived}
              onClick={() => {
                if (showArchived) onToggleArchived();
              }}
            >
              Active
            </button>
            <button
              type="button"
              className={showArchived ? "is-selected" : ""}
              aria-pressed={showArchived}
              onClick={() => {
                if (!showArchived) onToggleArchived();
              }}
            >
              Archived
            </button>
          </div>
          <p className="customers-sort">Newest first</p>
        </div>
      </div>

      {loadError && (
        <div className="api-error-banner customers-load-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="customers-btn customers-btn-ghost" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {selected && (
        <section className="customers-detail" aria-label={`Details for ${selected.name}`}>
          <div className="customers-panel-head">
            <div>
              <h3>{selected.name}</h3>
              <p>Contact details and orders currently loaded on this dashboard.</p>
            </div>
            <button
              type="button"
              className="customers-btn customers-btn-ghost"
              onClick={() => {
                setSelectedId(null);
                if (editingCustomer?.id === selected.id) onCancelEdit();
              }}
            >
              Close
            </button>
          </div>

          {editingCustomer?.id === selected.id ? (
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
          ) : (
            <dl className="customers-contact">
              <div>
                <dt>Phone</dt>
                <dd>{selected.phone}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selected.email || "No email on file"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.isArchived ? "Archived" : "Active"}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
              </div>
            </dl>
          )}

          <div className="customers-detail-actions">
            {editingCustomer?.id !== selected.id && renderActions(selected)}
            <button
              type="button"
              className="customers-btn customers-btn-ghost"
              onClick={() => onOpenOrder(selected)}
            >
              Find orders
            </button>
          </div>

          <div className="customers-history">
            <h4>Orders and payments</h4>
            {relatedOrders.length === 0 ? (
              <p>
                No orders for this customer are on the current orders page. Use Find orders to
                search the loaded orders by this phone number.
              </p>
            ) : (
              <ul>
                {relatedOrders.map((order) => {
                  const orderPayments = payments[order.id] ?? order.payments ?? [];
                  return (
                    <li key={order.id}>
                      <div className="customers-order-row">
                        <div>
                          <strong>{order.itemName}</strong>
                          <span>Order #{order.id}</span>
                        </div>
                        <span className={`customers-pay customers-pay-${order.paymentStatus.toLowerCase()}`}>
                          {paymentLabel(order.paymentStatus)}
                        </span>
                      </div>
                      <p className="customers-order-money">
                        Total {inr(order.totalAmount)} · Advance {inr(order.advance)} · Balance{" "}
                        {inr(order.balance)}
                      </p>
                      {orderPayments.length > 0 && (
                        <ul className="customers-payments">
                          {orderPayments.map((payment) => (
                            <li key={payment.id}>
                              {inr(payment.amount)} · {payment.paymentType} · {payment.status} ·{" "}
                              {formatDate(payment.createdAt)}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        className="customers-btn customers-btn-ghost"
                        onClick={() => onOpenOrder(selected, order.id)}
                      >
                        Open order
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {loading && customers.length === 0 ? (
        <p className="customers-empty">Loading customers...</p>
      ) : customers.length === 0 ? (
        <p className="customers-empty">
          {searchTerm.trim()
            ? "No customers match that name or phone number."
            : showArchived
              ? "No archived customers."
              : "No active customers."}
        </p>
      ) : (
        <>
          {loading && <p className="customers-updating">Updating customers...</p>}
          <p className="customers-count">
            {listedTotal} {showArchived ? "archived" : "active"}{" "}
            {listedTotal === 1 ? "customer" : "customers"}
            {searchTerm.trim() ? " matching your search" : ""}
          </p>

          <div className="desktop-table-container customers-table-wrap">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Added</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className={activeSelectedId === customer.id ? "is-selected" : ""}
                    onClick={() => setSelectedId(customer.id)}
                  >
                    <td>
                      <button
                        type="button"
                        className="customers-name"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(customer.id);
                        }}
                      >
                        {customer.name}
                      </button>
                    </td>
                    <td>{customer.phone}</td>
                    <td>{customer.email || "—"}</td>
                    <td>{formatDate(customer.createdAt)}</td>
                    <td>
                      <span className={customer.isArchived ? "customers-status is-archived" : "customers-status"}>
                        {customer.isArchived ? "Archived" : "Active"}
                      </span>
                    </td>
                    <td>{renderActions(customer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-cards-container">
            {customers.map((customer) => (
              <article
                key={customer.id}
                className={`customers-mobile-card${activeSelectedId === customer.id ? " is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="customers-name"
                  onClick={() => setSelectedId(customer.id)}
                >
                  {customer.name}
                </button>
                <p>{customer.phone}</p>
                <p>{customer.email || "No email"}</p>
                <p className="customers-mobile-meta">
                  Added {formatDate(customer.createdAt)} · {customer.isArchived ? "Archived" : "Active"}
                </p>
                {renderActions(customer)}
              </article>
            ))}
          </div>
        </>
      )}

      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="customers-pagination">
          <button
            type="button"
            className="customers-btn customers-btn-ghost"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="customers-btn customers-btn-ghost"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
