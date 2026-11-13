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
  // Archival and Cancellation props
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

  // Summary statistics computed from current available orders and stages data
  const summaryStats = useMemo(() => {
    let inProgress = 0;
    let readyForDelivery = 0;
    let delivered = 0;

    for (const order of orders) {
      if (order.status === "CANCELLED" || order.isArchived) continue;
      const orderStages = stages[order.id] || order.stages || [];
      const prod = getOrderProductionStatus(order, orderStages);

      if (prod.status === "DELIVERED") {
        delivered++;
      } else if (prod.status === "READY_FOR_DELIVERY") {
        readyForDelivery++;
      } else {
        inProgress++;
      }
    }

    const total = showArchived
      ? orders.length
      : pagination?.total ?? orders.filter((o) => !o.isArchived).length;

    return {
      total,
      inProgress,
      readyForDelivery,
      delivered,
    };
  }, [orders, stages, showArchived, pagination]);

  // Handle Quick Filter click on Summary Stat cards
  const handleStatCardClick = (filterType: "ALL" | "IN_PROGRESS" | "READY_FOR_DELIVERY" | "DELIVERED") => {
    if (productionFilter === filterType) {
      setProductionFilter("ALL");
    } else {
      setProductionFilter(filterType);
    }
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    const now = new Date();

    return orders
      .filter((order) => {
        // If this order is the actively selected order, always include it so its row & details are visible
        if (selectedOrderId && order.id === selectedOrderId) {
          return true;
        }

        // 1. Search matcher (ID, customer name, customer phone, item name)
        const orderIdStr = order.id.toString();
        const matchesSearch =
          !searchLower ||
          orderIdStr === searchLower ||
          `#${orderIdStr}`.includes(searchLower) ||
          order.itemName.toLowerCase().includes(searchLower) ||
          order.customer?.name?.toLowerCase().includes(searchLower) ||
          order.customer?.phone?.includes(searchLower);

        // 2. Payment status filter
        const matchesPaymentStatus =
          statusFilter === "ALL"
            ? true
            : statusFilter === "OUTSTANDING"
            ? order.balance > 0 && order.paymentStatus !== "PAID"
            : order.paymentStatus === statusFilter;

        // 3. Production stage filter
        const orderStages = stages[order.id] || order.stages || [];
        const prod = getOrderProductionStatus(order, orderStages);
        const matchesProdStatus =
          productionFilter === "ALL"
            ? true
            : productionFilter === "CANCELLED"
            ? order.status === "CANCELLED"
            : prod.status === productionFilter;

        // 4. Date filter
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

        return (
          matchesSearch &&
          matchesPaymentStatus &&
          matchesProdStatus &&
          matchesDate
        );
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
  }, [orders, stages, searchTerm, statusFilter, productionFilter, dateFilter, sortBy, selectedOrderId]);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    statusFilter !== "ALL" ||
    productionFilter !== "ALL" ||
    dateFilter !== "ALL" ||
    sortBy !== "NEWEST";

  const handleResetFilters = () => {
    onSearchChange("");
    onStatusFilterChange("ALL");
    setProductionFilter("ALL");
    setDateFilter("ALL");
    setSortBy("NEWEST");
  };

  const scrollToCreateOrder = () => {
    if (onCreateOrderClick) {
      onCreateOrderClick();
    } else {
      document.getElementById("create-order")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="orders-in-progress"
      className="orders-page"
      aria-label="Orders in Progress"
    >
      {/* ── 1. HEADER ── */}
      <div className="orders-header">
        <div>
          <h2>{showArchived ? "Archived Orders" : "Orders"}</h2>
          <p>
            Manage bespoke garments, track production milestones, and monitor customer payments.
          </p>
        </div>

        <div className="orders-header-actions">
          {!showArchived && (
            <button
              type="button"
              onClick={scrollToCreateOrder}
              className="orders-btn orders-btn-primary"
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

          <button
            type="button"
            onClick={onToggleArchived}
            className="orders-btn orders-btn-ghost"
          >
            {showArchived ? "Show Active Orders" : "View Archived Orders"}
          </button>
        </div>
      </div>

      {/* ── 2. ORDER SUMMARY STATS (Total, In Progress, Ready for Delivery, Delivered) ── */}
      <div className="orders-stats" role="region" aria-label="Orders Summary Statistics">
        {/* Total Orders */}
        <div
          className={`orders-stat-card ${productionFilter === "ALL" ? "is-active-filter" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => handleStatCardClick("ALL")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatCardClick("ALL");
            }
          }}
          aria-label={`Total Orders: ${summaryStats.total}. Click to view all orders.`}
        >
          <div className="orders-stat-head">
            <span className="orders-stat-label">Total Orders</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f7f9f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <strong className="orders-stat-num">{summaryStats.total}</strong>
          <span className="orders-stat-sub">
            {showArchived ? "Archived records" : "Active boutique orders"}
          </span>
        </div>

        {/* In Progress */}
        <div
          className={`orders-stat-card ${productionFilter === "IN_PROGRESS" ? "is-active-filter" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => handleStatCardClick("IN_PROGRESS")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatCardClick("IN_PROGRESS");
            }
          }}
          aria-label={`In Progress Orders: ${summaryStats.inProgress}. Click to filter.`}
        >
          <div className="orders-stat-head">
            <span className="orders-stat-label">In Progress</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <strong className="orders-stat-num" style={{ color: "#d97706" }}>
            {summaryStats.inProgress}
          </strong>
          <span className="orders-stat-sub">Cutting, stitching & finishing</span>
        </div>

        {/* Ready for Delivery */}
        <div
          className={`orders-stat-card ${productionFilter === "READY_FOR_DELIVERY" ? "is-active-filter" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => handleStatCardClick("READY_FOR_DELIVERY")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatCardClick("READY_FOR_DELIVERY");
            }
          }}
          aria-label={`Ready for Delivery: ${summaryStats.readyForDelivery}. Click to filter.`}
        >
          <div className="orders-stat-head">
            <span className="orders-stat-label">Ready for Delivery</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <strong className="orders-stat-num" style={{ color: "#0284c7" }}>
            {summaryStats.readyForDelivery}
          </strong>
          <span className="orders-stat-sub">Awaiting customer collection</span>
        </div>

        {/* Delivered */}
        <div
          className={`orders-stat-card ${productionFilter === "DELIVERED" ? "is-active-filter" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => handleStatCardClick("DELIVERED")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStatCardClick("DELIVERED");
            }
          }}
          aria-label={`Delivered Orders: ${summaryStats.delivered}. Click to filter.`}
        >
          <div className="orders-stat-head">
            <span className="orders-stat-label">Delivered</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <strong className="orders-stat-num" style={{ color: "#166534" }}>
            {summaryStats.delivered}
          </strong>
          <span className="orders-stat-sub">Completed orders</span>
        </div>
      </div>

      {/* ── 3. SEARCH & FILTERS TOOLBAR ── */}
      <div className="orders-toolbar">
        {/* Search Input with Clear Button */}
        <div className="orders-search">
          <svg
            className="orders-search-icon"
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by order ID, garment item, or customer name/phone..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="orders-search-input"
            aria-label="Search orders"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="orders-search-clear"
              aria-label="Clear search text"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="orders-filter-row">
          {/* Production Status Filter */}
          <select
            value={productionFilter}
            onChange={(e) => setProductionFilter(e.target.value)}
            className="orders-select"
            aria-label="Filter by production stage"
          >
            <option value="ALL">All Production Stages</option>
            <option value="ORDER_PLACED">Order Placed</option>
            <option value="IN_PROGRESS">In Progress (Cutting/Stitching/Finishing)</option>
            <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
            <option value="DELIVERED">Delivered / Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="orders-select"
            aria-label="Filter by payment status"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="OUTSTANDING">Has Outstanding Balance</option>
            <option value="PENDING">Pending Payment</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Fully Paid</option>
          </select>

          {/* Delivery Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="orders-select"
            aria-label="Filter by date"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Placed Today</option>
            <option value="NEXT_7_DAYS">Due in Next 7 Days</option>
            <option value="THIS_MONTH">Due This Month</option>
            <option value="OVERDUE">Overdue Balance</option>
          </select>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="orders-select"
            aria-label="Sort orders"
          >
            <option value="NEWEST">Newest Placed First</option>
            <option value="OLDEST">Oldest Placed First</option>
            <option value="DELIVERY_EARLIEST">Delivery Date (Earliest)</option>
            <option value="DELIVERY_LATEST">Delivery Date (Latest)</option>
            <option value="AMOUNT_HIGH">Amount (High to Low)</option>
            <option value="AMOUNT_LOW">Amount (Low to High)</option>
            <option value="BALANCE_HIGH">Balance Due (High to Low)</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="orders-btn orders-btn-ghost orders-reset-btn"
              title="Reset all search and filter criteria"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── 4. ORDERS LISTING (Table on Desktop, Cards on Mobile) ── */}
      <div className="orders-count-row">
        <span>
          Showing <strong>{filteredOrders.length}</strong> {showArchived ? "archived" : "active"}{" "}
          {filteredOrders.length === 1 ? "order" : "orders"}
          {hasActiveFilters ? " (filtered)" : ""}
        </span>
      </div>

      {loadingInitial ? (
        <div className="order-card orders-empty-box">
          <p>Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="order-card orders-empty-box">
          <h3>
            {showArchived
              ? "No Archived Orders Found"
              : hasActiveFilters
              ? "No Orders Match Your Filters"
              : "No Active Orders in Progress"}
          </h3>
          <p>
            {showArchived
              ? "Archived orders will appear here once archived from the active orders list."
              : hasActiveFilters
              ? "Try resetting your search query or status filters to view more orders."
              : "Create your first order using the 'Create Order' form below."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="orders-btn orders-btn-primary"
              style={{ marginTop: "12px" }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── DESKTOP ORDERS TABLE VIEW ── */}
          <div className="desktop-table-container orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Order ID</th>
                  <th>Customer</th>
                  <th>Item / Garment</th>
                  <th>Order Date</th>
                  <th>Delivery Date</th>
                  <th style={{ textAlign: "right" }}>Order Amount</th>
                  <th style={{ textAlign: "right" }}>Advance Paid</th>
                  <th style={{ textAlign: "right" }}>Balance Due</th>
                  <th style={{ textAlign: "center" }}>Production Status</th>
                  <th style={{ textAlign: "center" }}>Payment Status</th>
                  <th style={{ textAlign: "right", minWidth: "140px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const orderStages = stages[order.id] || order.stages || [];
                  const prod = getOrderProductionStatus(order, orderStages);
                  const isSelected = selectedOrderId === order.id;
                  const isCancelled = order.status === "CANCELLED";

                  return (
                    <tr
                      key={order.id}
                      id={`order-row-${order.id}`}
                      className={`orders-tr ${isSelected ? "is-selected-row" : ""}`}
                    >
                      {/* Order ID */}
                      <td className="orders-td-id">
                        <span className="orders-table-id">#{order.id}</span>
                      </td>

                      {/* Customer */}
                      <td className="orders-td-customer">
                        <strong className="orders-td-name">
                          {order.customer?.name || "—"}
                        </strong>
                        <span className="orders-td-phone">
                          {order.customer?.phone || ""}
                        </span>
                      </td>

                      {/* Item */}
                      <td className="orders-td-item">
                        <span className="orders-td-itemname">{order.itemName}</span>
                      </td>

                      {/* Order Date */}
                      <td className="orders-td-date">
                        {formatOrderDate(order.createdAt)}
                      </td>

                      {/* Delivery Date */}
                      <td className="orders-td-date">
                        {order.promisedDate ? (
                          <span style={{ fontWeight: 600 }}>
                            {formatOrderDate(order.promisedDate)}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      {/* Order Amount */}
                      <td className="orders-td-amount">
                        {inr(order.totalAmount)}
                      </td>

                      {/* Advance Paid */}
                      <td className="orders-td-amount" style={{ color: "#166534" }}>
                        {inr(order.advance)}
                      </td>

                      {/* Balance Due */}
                      <td
                        className="orders-td-amount"
                        style={{
                          color: order.balance > 0 ? "#b91c1c" : "#166534",
                          fontWeight: 700,
                        }}
                      >
                        {inr(order.balance)}
                      </td>

                      {/* Production Status */}
                      <td style={{ textAlign: "center" }}>
                        <span className={`orders-badge ${isCancelled ? "badge-cancelled" : prod.badgeClass}`}>
                          {isCancelled ? "Cancelled" : prod.label}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`orders-badge ${
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

                      {/* Actions */}
                      <td className="orders-td-actions">
                        <button
                          type="button"
                          onClick={() => onToggleDetails(order.id)}
                          className="orders-btn orders-btn-primary"
                          style={{ padding: "6px 12px", fontSize: "12px" }}
                        >
                          {isSelected ? "Hide Details" : "View Details"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── EXPANDED ORDER DETAILS PANEL (Visible on Desktop when an order is selected) ── */}
          {selectedOrderId && (
            <div className="desktop-expanded-details-container">
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

          {/* ── MOBILE RESPONSIVE CARDS VIEW (<768px) ── */}
          <div className="mobile-cards-container">
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

      {/* ── 5. PAGINATION CONTROLS ── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="orders-pagination" role="navigation" aria-label="Orders pagination">
          <button
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
            className="orders-btn orders-btn-ghost"
            style={{
              padding: "6px 14px",
              opacity: pagination.hasPreviousPage ? 1 : 0.4,
              cursor: pagination.hasPreviousPage ? "pointer" : "not-allowed",
            }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: "14px", color: "#475569", fontWeight: 600 }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
            className="orders-btn orders-btn-ghost"
            style={{
              padding: "6px 14px",
              opacity: pagination.hasNextPage ? 1 : 0.4,
              cursor: pagination.hasNextPage ? "pointer" : "not-allowed",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
