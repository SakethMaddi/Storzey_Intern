import type { Customer, PaginationMeta } from "../../../types";
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
  // Archival props
  onArchiveCustomer: (customerId: number) => void;
  onRestoreCustomer: (customerId: number) => void;
  onDeleteCustomer: (customerId: number) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
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
}: CustomerListProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>
          Customers ({pagination ? pagination.total : customers.length})
        </h2>
        <button
          type="button"
          onClick={onToggleArchived}
          style={{
            background: showArchived ? "#64748b" : "#f1f5f9",
            color: showArchived ? "#ffffff" : "#334155",
            border: "1px solid #cbd5e1",
            padding: "6px 14px",
            fontSize: "13px",
            borderRadius: "6px",
          }}
        >
          {showArchived ? "Show Active" : "Show Archived"}
        </button>
      </div>

      {editingCustomer && (
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
      )}

      <div className="customer-list-container">
        {customers.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14, padding: "8px 0" }}>
            {showArchived ? "No archived customers." : "No active customers."}
          </p>
        ) : (
          customers.map((customer) => (
            <div
              className="customer-card"
              key={customer.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: customer.isArchived ? 0.75 : 1,
              }}
            >
              <div>
                <p style={{ margin: "2px 0" }}>
                  <strong>Name:</strong> {customer.name}
                  {customer.isArchived && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#e2e8f0",
                        color: "#475569",
                        borderRadius: 4,
                        padding: "1px 6px",
                      }}
                    >
                      ARCHIVED
                    </span>
                  )}
                </p>
                <p style={{ margin: "2px 0" }}>
                  <strong>Phone:</strong> {customer.phone}
                </p>
                {customer.email && (
                  <p style={{ margin: "2px 0", fontSize: "13px", color: "#64748b" }}>
                    <strong>Email:</strong> {customer.email}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!showArchived ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onStartEdit(customer)}
                      style={{
                        background: "#0284c7",
                        padding: "6px 14px",
                        fontSize: "13px",
                        borderRadius: "6px",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive ${customer.name}? They won't appear in the main list.`
                          )
                        ) {
                          onArchiveCustomer(customer.id);
                        }
                      }}
                      style={{
                        background: "#f59e0b",
                        padding: "6px 14px",
                        fontSize: "13px",
                        borderRadius: "6px",
                      }}
                    >
                      Archive
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onRestoreCustomer(customer.id)}
                      style={{
                        background: "#059669",
                        padding: "6px 14px",
                        fontSize: "13px",
                        borderRadius: "6px",
                      }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Permanently delete ${customer.name}? This cannot be undone.`
                          )
                        ) {
                          onDeleteCustomer(customer.id);
                        }
                      }}
                      style={{
                        background: "#ef4444",
                        padding: "6px 14px",
                        fontSize: "13px",
                        borderRadius: "6px",
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "16px" }}>
          <button
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
            style={{ padding: "6px 12px", fontSize: "13px", background: pagination.hasPreviousPage ? "#0284c7" : "#cbd5e1" }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: "14px", color: "#475569" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
            style={{ padding: "6px 12px", fontSize: "13px", background: pagination.hasNextPage ? "#0284c7" : "#cbd5e1" }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
