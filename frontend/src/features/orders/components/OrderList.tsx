import type { Order, OrderStage, PaginationMeta, Payment } from "../../../types";
import { OrderCard } from "./OrderCard";

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
}: OrderListProps) {
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      order.itemName.toLowerCase().includes(searchLower) ||
      order.customer?.name?.toLowerCase().includes(searchLower) ||
      order.customer?.phone?.includes(searchLower);

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "OUTSTANDING"
        ? order.balance > 0 && order.paymentStatus !== "PAID"
        : order.paymentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <section id="orders-in-progress" aria-label="Orders in Progress">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#1e3a8a" }}>
            {showArchived
              ? "Archived Orders"
              : "Orders in Progress / Orders We're Dealing With"}
          </h2>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            Showing {filteredOrders.length} {showArchived ? "archived" : "active"} {filteredOrders.length === 1 ? "order" : "orders"}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleArchived}
          style={{
            background: showArchived ? "#475569" : "#f1f5f9",
            color: showArchived ? "#ffffff" : "#1e293b",
            border: "1px solid #cbd5e1",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {showArchived ? "Show Active Orders" : "View Archived Orders"}
        </button>
      </div>

      {/* Dashboard Search and Filter controls */}
      <div className="dashboard-filters">
        <input
          type="text"
          placeholder="Search orders by item or customer name/phone..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
          style={{ margin: 0 }}
        />

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="filter-select"
          style={{ margin: 0 }}
        >
          <option value="ALL">All Payment Statuses</option>
          <option value="OUTSTANDING">Has Outstanding Balance</option>
          <option value="PENDING">Pending Payment</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Fully Paid</option>
        </select>
      </div>

      {loadingInitial ? (
        <div className="order-card" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
          Loading orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div
          className="order-card"
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#64748b",
            background: "#ffffff",
          }}
        >
          <h3 style={{ color: "#334155", marginBottom: "8px" }}>
            {showArchived ? "No Archived Orders Found" : "No Active Orders in Progress"}
          </h3>
          <p style={{ margin: "0 auto", maxWidth: "400px", fontSize: "14px" }}>
            {showArchived
              ? "Archived orders will appear here once archived."
              : searchTerm || statusFilter !== "ALL"
              ? "No orders match your filter criteria. Try resetting search or status filters."
              : "Create your first order using the 'Create Order' section below."}
          </p>
        </div>
      ) : (
        filteredOrders.map((order) => (
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
        ))
      )}

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            margin: "24px 0",
          }}
        >
          <button
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              opacity: pagination.hasPreviousPage ? 1 : 0.5,
              cursor: pagination.hasPreviousPage ? "pointer" : "not-allowed",
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              opacity: pagination.hasNextPage ? 1 : 0.5,
              cursor: pagination.hasNextPage ? "pointer" : "not-allowed",
            }}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
