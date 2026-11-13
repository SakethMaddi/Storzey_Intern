import { useState, useMemo } from "react";
import type { Order, OrderStage, PaginationMeta, Payment } from "../../../types";
import { OrderCard } from "./OrderCard";
import {
  inr,
  formatOrderDate,
  getOrderProductionStatus,
} from "../order-utils";

export interface OrderListProps {
  orders: Order[];
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  loadingInitial: boolean;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  searchTerm: string;
  statusFilter: string;
  selectedOrderId: number | null;
  payments: Record<number, Payment[]>;
  stages: Record<number, OrderStage[]>;
  paymentInputs: Record<number, { amount: string; type: string }>;
  paymentErrors: Record<number, string>;
  paymentSuccess: Record<number, string>;
  submittingPayment: Record<number, boolean>;
  updatingStage: Record<number, boolean>;
  onSearchChange: (val: string) => void;
  onStatusFilterChange: (val: string) => void;
  onToggleDetails: (orderId: number) => void;
  onPaymentAmountChange: (orderId: number, amount: string) => void;
  onPaymentTypeChange: (orderId: number, type: string) => void;
  onRecordPayment: (orderId: number) => void;
  onReconcile: (orderId: number) => void;
  onCancelPayment?: (orderId: number, paymentId: number) => void;
  onUpdateStageStatus: (stageId: number, orderId: number, status: string) => void;
  onCancelOrder: (orderId: number, reason: string) => void;
  onArchiveOrder: (orderId: number) => void;
  onRestoreOrder: (orderId: number) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  onCreateOrderClick?: () => void;
}

export function OrderList({
  orders,
  pagination,
  onPageChange,
  loadingInitial,
  loading = false,
  loadError = "",
  onRetry,
  searchTerm,
  statusFilter,
  selectedOrderId,
  payments,
  stages,
  paymentInputs,
  paymentErrors,
  paymentSuccess,
  submittingPayment,
  updatingStage,
  onSearchChange,
  onStatusFilterChange,
  onToggleDetails,
  onPaymentAmountChange,
  onPaymentTypeChange,
  onRecordPayment,
  onReconcile,
  onCancelPayment,
  onUpdateStageStatus,
  onCancelOrder,
  onArchiveOrder,
  onRestoreOrder,
  showArchived,
  onToggleArchived,
  onCreateOrderClick,
}: OrderListProps) {
  // Local state for extended filtering & sorting
  const [productionFilter, setProductionFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("NEWEST");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders
      .filter((order) => {
        // Search and stored payment statuses are applied by GET /orders.
        const matchesPaymentStatus =
          statusFilter === "OUTSTANDING"
            ? order.balance > 0 && order.paymentStatus !== "PAID"
            : true;

        // Production stage filter
        const orderStages = stages[order.id] || order.stages || [];
        const prod = getOrderProductionStatus(order, orderStages);
        const matchesProdStatus =
          productionFilter === "ALL"
            ? true
            : productionFilter === "CANCELLED"
            ? order.status === "CANCELLED"
            : prod.status === productionFilter;

        // Date filter
        let matchesDate = true;
        if (dateFilter === "TODAY") {
          const created = new Date(order.createdAt);
          matchesDate = created.toDateString() === now.toDateString();
        } else if (dateFilter === "NEXT_7_DAYS") {
          if (!order.promisedDate) {
            matchesDate = false;
          } else {
            const prom = new Date(order.promisedDate);
            const in7 = new Date(now.getTime() + 7 * 86400000);
            matchesDate = prom >= now && prom <= in7;
          }
        } else if (dateFilter === "THIS_MONTH") {
          if (!order.promisedDate) {
            matchesDate = false;
          } else {
            const prom = new Date(order.promisedDate);
            matchesDate =
              prom.getMonth() === now.getMonth() &&
              prom.getFullYear() === now.getFullYear();
          }
        } else if (dateFilter === "OVERDUE") {
          if (!order.promisedDate || order.balance <= 0 || order.status === "CANCELLED") {
            matchesDate = false;
          } else {
            matchesDate = new Date(order.promisedDate) < now;
          }
        }

        return matchesPaymentStatus && matchesProdStatus && matchesDate;
      })
      .sort((a, b) => {
        if (sortBy === "NEWEST") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "OLDEST") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "DELIVERY_EARLIEST") {
          const dateA = a.promisedDate ? new Date(a.promisedDate).getTime() : Infinity;
          const dateB = b.promisedDate ? new Date(b.promisedDate).getTime() : Infinity;
          return dateA - dateB;
        }
        if (sortBy === "DELIVERY_LATEST") {
          const dateA = a.promisedDate ? new Date(a.promisedDate).getTime() : -Infinity;
          const dateB = b.promisedDate ? new Date(b.promisedDate).getTime() : -Infinity;
          return dateB - dateA;
        }
        if (sortBy === "AMOUNT_HIGH") {
          return b.totalAmount - a.totalAmount;
        }
        if (sortBy === "AMOUNT_LOW") {
          return a.totalAmount - b.totalAmount;
        }
        if (sortBy === "BALANCE_HIGH") {
          return b.balance - a.balance;
        }
        return 0;
      });
  }, [orders, stages, statusFilter, productionFilter, dateFilter, sortBy]);

  // Compute active filters count
  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) +
    (productionFilter !== "ALL" ? 1 : 0) +
    (dateFilter !== "ALL" ? 1 : 0) +
    (sortBy !== "NEWEST" ? 1 : 0);

  const hasActiveFilters = Boolean(searchTerm) || activeFiltersCount > 0;

  const handleResetFilters = () => {
    onSearchChange("");
    onStatusFilterChange("ALL");
    setProductionFilter("ALL");
    setDateFilter("ALL");
    setSortBy("NEWEST");
  };

  return (
    <section id="orders-section" className="boutique-section" aria-label="Orders Management">
      {/* ── 1. PAGE HEADER ── */}
      <div className="section-header-row">
        <div>
          <div className="section-title-wrap">
            <h1 className="section-title">
              {showArchived ? "Archived Orders" : "Orders"}
            </h1>
            <span className="count-pill">
              {pagination ? pagination.total : orders.length}
            </span>
          </div>
          <p className="section-subtitle">
            Manage bespoke garments, track tailor stages, and record payments.
          </p>
        </div>

        <div className="section-actions-wrap">
          {/* Active vs Archived Segmented Control */}
          <div className="segmented-toggle" role="group" aria-label="Order status view">
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

          {!showArchived && onCreateOrderClick && (
            <button
              type="button"
              onClick={onCreateOrderClick}
              className="btn-primary"
              aria-label="Create new order"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create Order</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. SEARCH & FILTER CONTROLS ── */}
      <div className="orders-control-bar">
        {/* Search input with icon & clear button */}
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
            type="text"
            placeholder="Search garment, customer name, or phone..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
            aria-label="Search orders"
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

        {/* Filter Toggle Button */}
        <button
          type="button"
          onClick={() => setIsFilterPanelOpen((v) => !v)}
          className={`filter-toggle-btn ${activeFiltersCount > 0 ? "has-filters" : ""} ${isFilterPanelOpen ? "is-open" : ""}`}
          aria-expanded={isFilterPanelOpen}
          aria-label="Toggle filters panel"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="filter-badge">{activeFiltersCount}</span>
          )}
        </button>
      </div>

      {/* ── 3. EXPANDABLE FILTER PANEL ── */}
      {isFilterPanelOpen && (
        <div className="filter-drawer-panel" role="region" aria-label="Order filters">
          <div className="filter-grid">
            <div className="filter-group">
              <label htmlFor="order-payment-filter" className="filter-label">Payment Status</label>
              <select
                id="order-payment-filter"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="select-field"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="OUTSTANDING">Has Balance Due</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Fully Paid</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="order-prod-filter" className="filter-label">Production Stage</label>
              <select
                id="order-prod-filter"
                value={productionFilter}
                onChange={(e) => setProductionFilter(e.target.value)}
                className="select-field"
              >
                <option value="ALL">All Production Stages</option>
                <option value="ORDER_PLACED">Order Placed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="order-date-filter" className="filter-label">Delivery Date</label>
              <select
                id="order-date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="select-field"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Placed Today</option>
                <option value="NEXT_7_DAYS">Due in 7 Days</option>
                <option value="THIS_MONTH">Due This Month</option>
                <option value="OVERDUE">Overdue Balance</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="order-sort-filter" className="filter-label">Sort By</label>
              <select
                id="order-sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="select-field"
              >
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="DELIVERY_EARLIEST">Delivery (Earliest)</option>
                <option value="DELIVERY_LATEST">Delivery (Latest)</option>
                <option value="AMOUNT_HIGH">Amount (High to Low)</option>
                <option value="AMOUNT_LOW">Amount (Low to High)</option>
                <option value="BALANCE_HIGH">Balance Due (High to Low)</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="filter-actions-row">
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-ghost-sm"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 4. APPLIED FILTER CHIPS ── */}
      {hasActiveFilters && (
        <div className="filter-chips-row" aria-label="Applied filters">
          {searchTerm && (
            <span className="filter-chip">
              Search: "{searchTerm}"
              <button type="button" onClick={() => onSearchChange("")} aria-label="Remove search filter">✕</button>
            </span>
          )}
          {statusFilter !== "ALL" && (
            <span className="filter-chip">
              Payment: {statusFilter.replace("_", " ")}
              <button type="button" onClick={() => onStatusFilterChange("ALL")} aria-label="Remove payment filter">✕</button>
            </span>
          )}
          {productionFilter !== "ALL" && (
            <span className="filter-chip">
              Stage: {productionFilter.replace("_", " ")}
              <button type="button" onClick={() => setProductionFilter("ALL")} aria-label="Remove production filter">✕</button>
            </span>
          )}
          {dateFilter !== "ALL" && (
            <span className="filter-chip">
              Date: {dateFilter.replace("_", " ")}
              <button type="button" onClick={() => setDateFilter("ALL")} aria-label="Remove date filter">✕</button>
            </span>
          )}
          {sortBy !== "NEWEST" && (
            <span className="filter-chip">
              Sorted: {sortBy.replace("_", " ")}
              <button type="button" onClick={() => setSortBy("NEWEST")} aria-label="Reset sort">✕</button>
            </span>
          )}
          <button
            type="button"
            onClick={handleResetFilters}
            className="clear-all-text-btn"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── 5. STATE FEEDBACK (Loading, Error, Empty) ── */}
      {loadError && filteredOrders.length > 0 && (
        <div className="inline-alert alert-error" role="alert">{loadError}</div>
      )}
      {loading && filteredOrders.length > 0 && (
        <div className="inline-alert alert-info" role="status">Updating orders list...</div>
      )}

      {loadError && filteredOrders.length === 0 ? (
        <div className="empty-state-card" role="alert">
          <div className="empty-icon-wrap">⚠️</div>
          <h3>Could not load orders</h3>
          <p>{loadError}</p>
          {onRetry && (
            <button type="button" className="btn-primary" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      ) : (loadingInitial || loading) && filteredOrders.length === 0 ? (
        <div className="empty-state-card" role="status">
          <div className="empty-spinner" />
          <p>Loading your orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h3>
            {showArchived
              ? "No Archived Orders"
              : hasActiveFilters
              ? "No Matching Orders"
              : "No Active Orders"}
          </h3>
          <p>
            {showArchived
              ? "Orders you archive will be kept securely here for your records."
              : hasActiveFilters
              ? "Try adjusting your search keywords or clearing active filters."
              : "Create your first bespoke garment order to get started."}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-primary"
            >
              Clear Filters
            </button>
          ) : !showArchived && onCreateOrderClick ? (
            <button
              type="button"
              onClick={onCreateOrderClick}
              className="btn-primary"
            >
              Create First Order
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* ── 6. DESKTOP ORDERS TABLE (Visible on >= 768px) ── */}
          <div className="desktop-table-wrapper">
            <table className="boutique-table">
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Order</th>
                  <th>Customer</th>
                  <th>Item / Garment</th>
                  <th>Order Date</th>
                  <th>Promised Delivery</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Paid</th>
                  <th style={{ textAlign: "right" }}>Balance Due</th>
                  <th style={{ textAlign: "center" }}>Production</th>
                  <th style={{ textAlign: "center" }}>Payment</th>
                  <th style={{ textAlign: "right", minWidth: "110px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const orderStages = stages[order.id] || order.stages || [];
                  const prod = getOrderProductionStatus(order, orderStages);
                  const isSelected = selectedOrderId === order.id;
                  const isCancelled = order.status === "CANCELLED";
                  const paid = Math.max(0, order.totalAmount - order.balance);

                  return (
                    <tr
                      key={order.id}
                      className={`table-row ${isSelected ? "is-selected" : ""}`}
                      onClick={() => onToggleDetails(order.id)}
                    >
                      {/* Order ID */}
                      <td className="cell-id">
                        <span className="order-num-pill">#{order.id}</span>
                      </td>

                      {/* Customer */}
                      <td className="cell-customer">
                        <div className="customer-info">
                          <strong className="customer-name">
                            {order.customer?.name || "—"}
                          </strong>
                          {order.customer?.phone && (
                            <span className="customer-phone">
                              {order.customer.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Item */}
                      <td className="cell-item">
                        <span className="item-title">{order.itemName}</span>
                      </td>

                      {/* Order Date */}
                      <td className="cell-date">
                        {formatOrderDate(order.createdAt)}
                      </td>

                      {/* Delivery Date */}
                      <td className="cell-date">
                        {order.promisedDate ? (
                          <span className="delivery-date-highlight">
                            {formatOrderDate(order.promisedDate)}
                          </span>
                        ) : (
                          <span className="muted-dash">—</span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="cell-amount">
                        {inr(order.totalAmount)}
                      </td>

                      {/* Amount Paid */}
                      <td className="cell-amount cell-paid">
                        {inr(paid)}
                      </td>

                      {/* Balance Due */}
                      <td className="cell-amount cell-balance">
                        <span className={order.balance > 0 ? "balance-due-text" : "balance-settled-text"}>
                          {inr(order.balance)}
                        </span>
                      </td>

                      {/* Production Status Badge */}
                      <td style={{ textAlign: "center" }}>
                        <span className={`status-badge ${isCancelled ? "badge-cancelled" : prod.badgeClass}`}>
                          {isCancelled ? "Cancelled" : prod.label}
                        </span>
                      </td>

                      {/* Payment Status Badge */}
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`status-badge ${
                            order.paymentStatus === "PAID"
                              ? "badge-paid"
                              : order.paymentStatus === "PARTIALLY_PAID"
                              ? "badge-partial"
                              : "badge-pending"
                          }`}
                        >
                          {order.paymentStatus === "PAID"
                            ? "Paid"
                            : order.paymentStatus === "PARTIALLY_PAID"
                            ? "Partial"
                            : "Pending"}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="cell-action" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onToggleDetails(order.id)}
                          className={`btn-action-sm ${isSelected ? "is-expanded" : ""}`}
                        >
                          {isSelected ? "Close" : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── EXPANDED ORDER DETAILS DRAWER / MODAL (Desktop) ── */}
          {selectedOrderId && (
            <div className="desktop-details-wrapper">
              {orders
                .filter((o) => o.id === selectedOrderId)
                .map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isSelected={true}
                    orderPayments={payments[order.id]}
                    orderStages={stages[order.id]}
                    paymentInput={paymentInputs[order.id]}
                    paymentError={paymentErrors[order.id]}
                    paymentSuccess={paymentSuccess[order.id]}
                    isSubmittingPayment={submittingPayment[order.id]}
                    isUpdatingStage={updatingStage[order.id]}
                    onToggleDetails={() => onToggleDetails(order.id)}
                    onPaymentAmountChange={(amount) =>
                      onPaymentAmountChange(order.id, amount)
                    }
                    onPaymentTypeChange={(type) =>
                      onPaymentTypeChange(order.id, type)
                    }
                    onRecordPayment={() => onRecordPayment(order.id)}
                    onReconcile={() => onReconcile(order.id)}
                    onCancelPayment={onCancelPayment}
                    onUpdateStageStatus={(stId, stVal) =>
                      onUpdateStageStatus(stId, order.id, stVal)
                    }
                    onCancelOrder={onCancelOrder}
                    onArchiveOrder={onArchiveOrder}
                    onRestoreOrder={onRestoreOrder}
                  />
                ))}
            </div>
          )}

          {/* ── 7. MOBILE ORDERS CARDS (< 768px) ── */}
          <div className="mobile-orders-list">
            {(selectedOrderId && !filteredOrders.some((o) => o.id === selectedOrderId)
              ? [...orders.filter((o) => o.id === selectedOrderId), ...filteredOrders]
              : filteredOrders
            ).map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isSelected={selectedOrderId === order.id}
                orderPayments={payments[order.id]}
                orderStages={stages[order.id]}
                paymentInput={paymentInputs[order.id]}
                paymentError={paymentErrors[order.id]}
                paymentSuccess={paymentSuccess[order.id]}
                isSubmittingPayment={submittingPayment[order.id]}
                isUpdatingStage={updatingStage[order.id]}
                onToggleDetails={() => onToggleDetails(order.id)}
                onPaymentAmountChange={(amount) =>
                  onPaymentAmountChange(order.id, amount)
                }
                onPaymentTypeChange={(type) =>
                  onPaymentTypeChange(order.id, type)
                }
                onRecordPayment={() => onRecordPayment(order.id)}
                onReconcile={() => onReconcile(order.id)}
                onCancelPayment={onCancelPayment}
                onUpdateStageStatus={(stId, stVal) =>
                  onUpdateStageStatus(stId, order.id, stVal)
                }
                onCancelOrder={onCancelOrder}
                onArchiveOrder={onArchiveOrder}
                onRestoreOrder={onRestoreOrder}
              />
            ))}
          </div>
        </>
      )}

      {/* ── 8. PAGINATION ── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pagination-bar" role="navigation" aria-label="Orders pagination">
          <button
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
            className="pagination-btn"
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
