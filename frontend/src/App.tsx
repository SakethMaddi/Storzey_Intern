import "./App.css";
import { useEffect, useState, useRef, useTransition } from "react";
import axios from "axios";
import { CustomerOrderPage } from "./features/tracking/pages/CustomerOrderPage";
import {
  customerSchema,
  orderFormSchema,
  validateStrictIndianPhone,
  capitalizeFirstLetter,
} from "./validation";
import { API_BASE_URL } from "./config";
import type { Customer, Order, OrderStage, Payment, PaginationMeta } from "./types";

import { OwnerSignUpPage } from "./features/auth/components/OwnerSignUpPage";
import { OwnerLoginPage } from "./features/auth/components/OwnerLoginPage";
import { HeaderBar, type NavTab } from "./shared/components/HeaderBar";
import { CustomerCreateCard } from "./features/customers/components/CustomerCreateCard";
import { CustomerList } from "./features/customers/components/CustomerList";
import { OrderCreateForm } from "./features/orders/components/OrderCreateForm";
import { sanitizeOrderStages, validateOrderStages } from "./features/orders/order-wizard";
import { buildOrdersQuery } from "./features/orders/order-list-query";
import { OrderList } from "./features/orders/components/OrderList";
import { ReportsPage } from "./features/orders/components/ReportsPage";
import { PaymentsPage } from "./features/payments/components/PaymentsPage";
import { SettingsPage } from "./features/settings/SettingsPage";

// Configure axios globally to always send cookies with requests and provide CSRF custom header
axios.defaults.withCredentials = true;
axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

const API_BASE = API_BASE_URL;

// ----------------------------------------------------
// PROTECTED OWNER ADMIN DASHBOARD COMPONENT
// ----------------------------------------------------
function AdminApp({
  ownerEmail,
  onLogout,
  initialTab,
  initialOrders,
  initialCustomers,
  initialStats,
  initialStages,
  initialPayments,
  initialBusinessName,
  initialOwnerName,
  initialSelectedOrderId,
}: {
  ownerEmail: string;
  onLogout: () => void;
  initialTab?: NavTab;
  initialOrders?: Order[];
  initialCustomers?: Customer[];
  initialStats?: {
    totalOrders: number;
    totalCustomers: number;
    totalOrderValue: number;
    totalCollected: number;
    totalOutstanding: number;
    paidCount: number;
    partiallyPaidCount: number;
    pendingCount: number;
    recentOrders?: any[];
    recentPayments?: any[];
  } | null;
  initialStages?: Record<number, OrderStage[]>;
  initialPayments?: Record<number, Payment[]>;
  initialBusinessName?: string;
  initialOwnerName?: string;
  initialSelectedOrderId?: number;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders || []);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers || []);
  const [orderCustomers, setOrderCustomers] = useState<Customer[]>(initialCustomers || []);
  const [customerPagination, setCustomerPagination] = useState<PaginationMeta | null>(null);
  const [orderPagination, setOrderPagination] = useState<PaginationMeta | null>(null);
  const [customerPage, setCustomerPage] = useState(1);
  const [payments, setPayments] = useState<Record<number, Payment[]>>(initialPayments || {});
  const [stages, setStages] = useState<Record<number, OrderStage[]>>(initialStages || {});
  const [selectedOrder, setSelectedOrder] = useState<number | null>(initialSelectedOrderId ?? null);

  // Navigation tab and archival toggles
  const [activeTab, setActiveTab] = useState<NavTab>(initialTab || "customers");
  const [showArchivedCustomers, setShowArchivedCustomers] = useState(false);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);

  // Owner profile state for Settings
  const [ownerProfile, setOwnerProfile] = useState<{
    name: string;
    phone: string | null;
    businessName: string | null;
  }>({
    name: initialOwnerName || "",
    phone: null,
    businessName: initialBusinessName || null,
  });

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/me`);
      if (res.data?.success && res.data?.data) {
        setOwnerProfile({
          name: res.data.data.name || "",
          phone: res.data.data.phone || null,
          businessName: res.data.data.businessName || null,
        });
      }
    } catch (err: any) {
      console.error("Failed to fetch owner profile:", err);
      handleAuthError(err);
    }
  };

  useEffect(() => {
    if (!initialOrders) {
      fetchProfile();
    }
  }, []);

  useEffect(() => {
    if (!initialOrders && activeTab === "settings") {
      fetchProfile();
    }
  }, [activeTab]);

  const openSection = (tab: NavTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  // Quick stats summary
  const [loadingInitial, setLoadingInitial] = useState(initialOrders ? false : true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadError, setOrdersLoadError] = useState("");
  const [, startTransition] = useTransition();

  // Customer Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [customerErrors, setCustomerErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  const [customerSuccess, setCustomerSuccess] = useState("");
  const [customerApiError, setCustomerApiError] = useState("");
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const customerSubmittingRef = useRef(false);
  const selectCreatedCustomerForOrder = useRef(false);

  // Order Form State
  const [customerId, setCustomerId] = useState("");
  const [itemName, setItemName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [advance, setAdvance] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [orderErrors, setOrderErrors] = useState<{
    customerId?: string;
    itemName?: string;
    totalAmount?: string;
    advance?: string;
    promisedDate?: string;
    stages?: string;
  }>({});
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderApiError, setOrderApiError] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const orderSubmittingRef = useRef(false);

  // Payment Form State per order
  const [paymentInputs, setPaymentInputs] = useState<
    Record<number, { amount: string; type: string }>
  >({});
  const [paymentErrors, setPaymentErrors] = useState<Record<number, string>>({});
  const [paymentSuccess, setPaymentSuccess] = useState<Record<number, string>>({});
  const [submittingPayment, setSubmittingPayment] = useState<
    Record<number, boolean>
  >({});
  const paymentSubmittingRef = useRef<Record<number, boolean>>({});

  // Stage update states
  const [updatingStage, setUpdatingStage] = useState<Record<number, boolean>>({});

  // Aggregated dashboard metrics from server
  const [dashboardStats, setDashboardStats] = useState<{
    totalOrders: number;
    totalCustomers: number;
    totalOrderValue: number;
    totalCollected: number;
    totalOutstanding: number;
    paidCount: number;
    partiallyPaidCount: number;
    pendingCount: number;
    recentOrders?: any[];
    recentPayments?: any[];
  } | null>(initialStats || null);

  // Filter & Search dashboard states
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");

  // Customer Editing State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [editCustomerErrors, setEditCustomerErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  const [editCustomerSuccess, setEditCustomerSuccess] = useState("");
  const [editCustomerApiError, setEditCustomerApiError] = useState("");
  const [isSubmittingCustomerEdit, setIsSubmittingCustomerEdit] = useState(false);
  const customerEditSubmittingRef = useRef(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const customerSearchRef = useRef("");
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerLoadError, setCustomerLoadError] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [archivedCustomerCount, setArchivedCustomerCount] = useState<number | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);

  // Custom Stages State for Order Creation
  const defaultStageTemplates = [
    "Order Placed",
    "Cutting",
    "Stitching",
    "Finishing",
    "Ready for Delivery",
  ];
  const [orderStages, setOrderStages] = useState<string[]>(defaultStageTemplates);
  const [newStageInput, setNewStageInput] = useState("");
  const [stageInputError, setStageInputError] = useState("");

  const handleAuthError = (error: any) => {
    if (error.response?.status === 401) {
      alert("Session expired. Please log in again.");
      onLogout();
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/dashboard/stats`);
      if (response.data?.success && response.data?.data) {
        setDashboardStats(response.data.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch dashboard stats:", error);
    }
  };

  const orderListQueryRef = useRef({
    page: 1,
    archived: false,
    search: "",
    status: "ALL",
  });
  const orderRequestSeq = useRef(0);
  const orderSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = async (options?: {
    page?: number;
    archived?: boolean;
    search?: string;
    status?: string;
  }): Promise<Order[] | null> => {
    const next = {
      page: options?.page ?? orderListQueryRef.current.page,
      archived: options?.archived ?? orderListQueryRef.current.archived,
      search: options?.search ?? orderListQueryRef.current.search,
      status: options?.status ?? orderListQueryRef.current.status,
    };
    orderListQueryRef.current = next;
    const requestId = ++orderRequestSeq.current;
    setOrdersLoading(true);
    setOrdersLoadError("");
    try {
      const response = await axios.get(
        `${API_BASE}/orders?${buildOrdersQuery(next)}`
      );
      if (requestId !== orderRequestSeq.current) return null;
      const fetchedOrders: Order[] = response.data.data ?? [];
      startTransition(() => {
        setOrders(fetchedOrders);
        if (response.data.pagination) {
          setOrderPagination(response.data.pagination);
        }
      });
      if (Array.isArray(fetchedOrders)) {
        fetchedOrders.forEach((o) => {
          if (!stages[o.id]) {
            axios
              .get(`${API_BASE}/orders/${o.id}/stages`)
              .then((res) => {
                if (requestId !== orderRequestSeq.current) return;
                if (res.data?.success && res.data.data) {
                  setStages((prev) => ({
                    ...prev,
                    [o.id]: res.data.data,
                  }));
                }
              })
              .catch(() => {});
          }
        });
      }
      return fetchedOrders;
    } catch (error: any) {
      if (requestId !== orderRequestSeq.current) return null;
      console.error("Failed to fetch orders:", error);
      handleAuthError(error);
      if (error?.response?.status !== 401) {
        setOrdersLoadError("Couldn't load orders. Please try again.");
      }
      return null;
    } finally {
      if (requestId === orderRequestSeq.current) {
        setOrdersLoading(false);
      }
    }
  };

  const applyOrderServerFilters = (status: string, archived: boolean) => {
    setPaymentStatusFilter(status);
    setShowArchivedOrders(archived);
    void fetchOrders({ page: 1, status, archived });
  };

  const handleOrderSearchChange = (value: string) => {
    setOrderSearchTerm(value);
    orderListQueryRef.current.search = value;
    if (orderSearchTimer.current) {
      clearTimeout(orderSearchTimer.current);
    }
    orderSearchTimer.current = setTimeout(() => {
      void fetchOrders({ page: 1, search: value });
    }, 300);
  };

  const fetchOrderCustomers = async () => {
    try {
      const response = await axios.get(
        `${API_BASE}/customers?page=1&limit=50&archived=false`
      );
      setOrderCustomers(response.data.data ?? []);
    } catch (error: any) {
      console.error("Failed to fetch customers for orders:", error);
      handleAuthError(error);
    }
  };

  const refreshArchivedCustomerCount = async () => {
    try {
      const response = await axios.get(`${API_BASE}/customers?page=1&limit=1&archived=true`);
      setArchivedCustomerCount(response.data.pagination?.total ?? 0);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        handleAuthError(error);
      }
    }
  };

  const fetchCustomers = async (
    page: number = customerPage,
    archived: boolean = showArchivedCustomers,
    search: string = customerSearchRef.current
  ) => {
    setCustomerLoading(true);
    setCustomerLoadError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        archived: String(archived),
      });
      const query = search.trim();
      if (query) {
        params.set("search", query);
      }
      const response = await axios.get(`${API_BASE}/customers?${params.toString()}`);
      startTransition(() => {
        setCustomers(response.data.data);
        if (response.data.pagination) {
          setCustomerPagination(response.data.pagination);
          setCustomerPage(response.data.pagination.page);
        }
      });
    } catch (error: any) {
      console.error("Failed to fetch customers:", error);
      handleAuthError(error);
      if (error?.response?.status !== 401) {
        setCustomerLoadError("Couldn't load customers. Please try again.");
      }
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    customerSearchRef.current = value;
    if (customerSearchTimer.current) {
      clearTimeout(customerSearchTimer.current);
    }
    customerSearchTimer.current = setTimeout(() => {
      fetchCustomers(1, showArchivedCustomers, value);
    }, 300);
  };

  const handleToggleArchivedCustomers = () => {
    const nextVal = !showArchivedCustomers;
    if (customerSearchTimer.current) {
      clearTimeout(customerSearchTimer.current);
    }
    setShowArchivedCustomers(nextVal);
    fetchCustomers(1, nextVal);
  };

  const handleArchiveCustomer = async (customerId: number) => {
    try {
      await axios.patch(`${API_BASE}/customers/${customerId}/archive`, {});
      await Promise.all([
        fetchCustomers(customerPage, showArchivedCustomers),
        fetchOrderCustomers(),
      ]);
      setCustomerId((current) => (current === String(customerId) ? "" : current));
      fetchDashboardStats().catch(() => {});
      refreshArchivedCustomerCount().catch(() => {});
    } catch (error: any) {
      console.error("Failed to archive customer:", error);
      handleAuthError(error);
      alert(error.response?.data?.message || "Failed to archive customer.");
    }
  };

  const handleRestoreCustomer = async (customerId: number) => {
    try {
      await axios.patch(`${API_BASE}/customers/${customerId}/restore`, {});
      await Promise.all([
        fetchCustomers(customerPage, showArchivedCustomers),
        fetchOrderCustomers(),
      ]);
      fetchDashboardStats().catch(() => {});
      refreshArchivedCustomerCount().catch(() => {});
    } catch (error: any) {
      console.error("Failed to restore customer:", error);
      handleAuthError(error);
      alert(error.response?.data?.message || "Failed to restore customer.");
    }
  };

  const handleDeleteCustomer = async (customerId: number) => {
    try {
      await axios.delete(`${API_BASE}/customers/${customerId}`);
      await Promise.all([
        fetchCustomers(customerPage, showArchivedCustomers),
        fetchOrderCustomers(),
      ]);
      setCustomerId((current) => (current === String(customerId) ? "" : current));
      fetchDashboardStats().catch(() => {});
      refreshArchivedCustomerCount().catch(() => {});
    } catch (error: any) {
      console.error("Failed to delete customer:", error);
      handleAuthError(error);
      alert(error.response?.data?.message || "Failed to delete customer.");
    }
  };

  const handleToggleArchivedOrders = () => {
    const nextVal = !showArchivedOrders;
    setShowArchivedOrders(nextVal);
    void fetchOrders({ page: 1, archived: nextVal });
  };

  const handleCancelOrder = async (orderId: number, reason: string) => {
    try {
      await axios.patch(`${API_BASE}/orders/${orderId}/cancel`, { reason });
      await fetchOrders();
      fetchDashboardStats().catch(() => {});
    } catch (error: any) {
      console.error("Failed to cancel order:", error);
      handleAuthError(error);
      alert(error.response?.data?.message || "Failed to cancel order.");
    }
  };

  const handleCancelPayment = async (orderId: number, paymentId: number) => {
    try {
      await axios.patch(`${API_BASE}/orders/${orderId}/payments/${paymentId}/cancel`, {});
      await Promise.all([
        fetchOrders(),
        fetchPayments(orderId),
      ]);
      fetchDashboardStats().catch(() => {});
    } catch (error: any) {
      console.error("Failed to cancel payment:", error);
      handleAuthError(error);
      alert(error.response?.data?.message || "Failed to cancel payment.");
    }
  };

  const handleArchiveOrder = async (orderId: number) => {
    try {
      await axios.patch(`${API_BASE}/orders/${orderId}/archive`, {});
      await fetchOrders();
      fetchDashboardStats().catch(() => {});
    } catch (error: any) {
      console.error("Failed to archive order:", error);
      handleAuthError(error);
      alert(error.response?.data?.message || "Failed to archive order.");
    }
  };

  const handleRestoreOrder = async (orderId: number) => {
    try {
      await axios.patch(`${API_BASE}/orders/${orderId}/restore`, {});
      await fetchOrders();
      fetchDashboardStats().catch(() => {});
    } catch (error: any) {
      console.error("Failed to restore order:", error);
      handleAuthError(error);
      alert(error.response?.data?.message || "Failed to restore order.");
    }
  };

  const fetchPayments = async (orderId: number) => {
    try {
      const response = await axios.get(`${API_BASE}/orders/${orderId}/payments`);
      setPayments((prev) => ({
        ...prev,
        [orderId]: response.data.data,
      }));
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      handleAuthError(error);
    }
  };

  const fetchStages = async (orderId: number) => {
    try {
      const response = await axios.get(`${API_BASE}/orders/${orderId}/stages`);
      setStages((prev) => ({
        ...prev,
        [orderId]: response.data.data,
      }));
    } catch (error) {
      console.error("Failed to fetch stages:", error);
      handleAuthError(error);
    }
  };

  const updateStageStatus = async (
    stageId: number,
    orderId: number,
    status: string
  ) => {
    if (updatingStage[stageId]) return;
    setUpdatingStage((prev) => ({ ...prev, [stageId]: true }));
    try {
      await axios.patch(`${API_BASE}/stages/${stageId}`, {
        status,
      });
      setStages((prev) => {
        const currentStages = prev[orderId] || [];
        return {
          ...prev,
          [orderId]: currentStages.map((st) =>
            st.id === stageId ? { ...st, status: status as any } : st
          ),
        };
      });
    } catch (error: any) {
      console.error("Failed to update stage:", error);
      handleAuthError(error);
      const msg = error.response?.data?.message || "Failed to update stage status";
      alert(msg);
      await fetchStages(orderId);
    } finally {
      setUpdatingStage((prev) => ({ ...prev, [stageId]: false }));
    }
  };

  const recordPayment = async (orderId: number) => {
    if (paymentSubmittingRef.current[orderId]) {
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    if (order.balance <= 0) {
      setPaymentErrors((prev) => ({
        ...prev,
        [orderId]: "This order is already fully paid.",
      }));
      return;
    }

    const payment = paymentInputs[orderId] || { amount: "", type: "ADVANCE" };
    const rawAmount = payment.amount.trim();
    const amountNum = Number(rawAmount);

    setPaymentErrors((prev) => ({ ...prev, [orderId]: "" }));
    setPaymentSuccess((prev) => ({ ...prev, [orderId]: "" }));

    if (
      !rawAmount ||
      Number.isNaN(amountNum) ||
      !Number.isSafeInteger(amountNum) ||
      amountNum <= 0
    ) {
      setPaymentErrors((prev) => ({
        ...prev,
        [orderId]: "Please enter a valid positive whole payment amount.",
      }));
      return;
    }

    if (amountNum > order.balance) {
      setPaymentErrors((prev) => ({
        ...prev,
        [orderId]: `Payment amount cannot exceed outstanding balance of ₹${order.balance.toLocaleString("en-IN")}.`,
      }));
      return;
    }

    paymentSubmittingRef.current[orderId] = true;
    setSubmittingPayment((prev) => ({ ...prev, [orderId]: true }));

    try {
      const response = await axios.post(
        `${API_BASE}/orders/${orderId}/payments`,
        {
          amount: amountNum,
          paymentType: payment.type || "ADVANCE",
        }
      );

      const result = response.data.data;

      setPaymentSuccess((prev) => ({
        ...prev,
        [orderId]: response.data.message || "Payment recorded successfully!",
      }));

      setPaymentInputs((prev) => ({
        ...prev,
        [orderId]: { amount: "", type: "ADVANCE" },
      }));

      if (result && result.updatedOrder) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  balance: result.updatedOrder.balance,
                  paymentStatus: result.updatedOrder.paymentStatus,
                }
              : o
          )
        );
      }
      if (result && result.payment) {
        setPayments((prev) => ({
          ...prev,
          [orderId]: [result.payment, ...(prev[orderId] || [])],
        }));
      }
      fetchDashboardStats().catch(() => {});
    } catch (error: any) {
      console.error("Payment error:", error);
      handleAuthError(error);
      const msg =
        error.response?.data?.message ||
        "Failed to record payment. Please try again.";
      setPaymentErrors((prev) => ({
        ...prev,
        [orderId]: msg,
      }));
    } finally {
      paymentSubmittingRef.current[orderId] = false;
      setSubmittingPayment((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const toggleOrderDetails = async (orderId: number) => {
    if (selectedOrder === orderId) {
      setSelectedOrder(null);
      return;
    }

    setSelectedOrder(orderId);

    if (!payments[orderId] || !stages[orderId]) {
      await Promise.all([fetchPayments(orderId), fetchStages(orderId)]);
    }
  };

  const handleViewRecentOrder = async (orderId: number) => {
    setActiveTab("orders");

    // Reset filters that could hide the recent order
    setPaymentStatusFilter("ALL");
    setOrderSearchTerm("");
    setShowArchivedOrders(false);
    if (orderSearchTimer.current) {
      clearTimeout(orderSearchTimer.current);
    }
    const loadedOrders = await fetchOrders({
      page: 1,
      search: "",
      status: "ALL",
      archived: false,
    });

    // If order is not loaded in current orders list, fetch it by ID
    let targetOrder = (loadedOrders ?? orders).find((o) => o.id === orderId);
    if (!targetOrder) {
      try {
        const res = await axios.get(`${API_BASE}/orders/${orderId}`);
        if (res.data?.success && res.data.data) {
          targetOrder = res.data.data;
          setOrders((prev) => [targetOrder!, ...prev.filter((o) => o.id !== orderId)]);
          if (targetOrder?.payments) {
            setPayments((prev) => ({ ...prev, [orderId]: targetOrder!.payments! }));
          }
          if (targetOrder?.stages) {
            setStages((prev) => ({ ...prev, [orderId]: targetOrder!.stages! }));
          }
        }
      } catch (err: any) {
        console.error("Failed to load order details for ID:", orderId, err);
        handleAuthError(err);
      }
    }

    setSelectedOrder(orderId);

    if (!payments[orderId] || !stages[orderId]) {
      await Promise.all([fetchPayments(orderId), fetchStages(orderId)]);
    }

    window.requestAnimationFrame(() => {
      const el =
        document.getElementById(`order-card-${orderId}`) ||
        document.getElementById(`order-row-${orderId}`) ||
        document.getElementById("orders-in-progress");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const openCustomerOrder = (customer: Customer, orderId?: number) => {
    setActiveTab("orders");
    setPaymentStatusFilter("ALL");
    setOrderSearchTerm(customer.phone);
    if (orderSearchTimer.current) {
      clearTimeout(orderSearchTimer.current);
    }
    void fetchOrders({ page: 1, search: customer.phone, status: "ALL" });
    if (orderId != null && selectedOrder !== orderId) {
      void toggleOrderDetails(orderId);
    }
    window.requestAnimationFrame(() => {
      const el = orderId
        ? document.getElementById(`order-card-${orderId}`) ||
          document.getElementById(`order-row-${orderId}`) ||
          document.getElementById("orders-in-progress")
        : document.getElementById("orders-in-progress");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleCreateOrderForCustomer = (customer: Customer) => {
    setCustomerId(String(customer.id));
    if (orderErrors.customerId) {
      setOrderErrors((prev) => ({ ...prev, customerId: undefined }));
    }
    openSection("new-order");
  };

  useEffect(() => {
    if (initialOrders) {
      setLoadingInitial(false);
      setCustomerLoading(false);
      return;
    }
    Promise.all([
      fetchOrders(),
      fetchCustomers(),
      fetchOrderCustomers(),
      fetchDashboardStats(),
      refreshArchivedCustomerCount(),
    ]).finally(() => {
      setLoadingInitial(false);
    });
    return () => {
      if (customerSearchTimer.current) {
        clearTimeout(customerSearchTimer.current);
      }
      if (orderSearchTimer.current) {
        clearTimeout(orderSearchTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (customerSuccess || customerApiError) {
      setShowCustomerForm(true);
    }
  }, [customerSuccess, customerApiError]);

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (!val.trim()) {
      setCustomerErrors((prev) => ({ ...prev, phone: undefined }));
      return;
    }

    const check = validateStrictIndianPhone(val);
    if (!check.isValid) {
      setCustomerErrors((prev) => ({ ...prev, phone: check.message }));
    } else {
      setCustomerErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const check = validateStrictIndianPhone(pasted);
    if (!check.isValid) {
      setCustomerErrors((prev) => ({
        ...prev,
        phone: check.message || "Invalid phone number pasted",
      }));
    } else {
      setCustomerErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (customerSubmittingRef.current) {
      return;
    }

    setCustomerErrors({});
    setCustomerSuccess("");
    setCustomerApiError("");

    const validationResult = customerSchema.safeParse({ name, phone, email });

    if (!validationResult.success) {
      const fieldErrors: { name?: string; phone?: string; email?: string } = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0] as "name" | "phone" | "email";
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setCustomerErrors(fieldErrors);
      return;
    }

    const validData = validationResult.data;

    const existing = [...orderCustomers, ...customers].find(
      (c) => c.phone === validData.phone
    );
    if (existing) {
      setCustomerErrors({
        phone: `Customer with phone ${validData.phone} already exists (${existing.name}).`,
      });
      return;
    }

    customerSubmittingRef.current = true;
    setIsSubmittingCustomer(true);

    try {
      const response = await axios.post(`${API_BASE}/customers`, {
        name: validData.name,
        phone: validData.phone,
        email: validData.email || null,
      });

      const newCustomer = response.data.data;

      setCustomerSuccess(
        response.data.message || "Customer created successfully!"
      );
      setName("");
      setPhone("");
      setEmail("");

      if (newCustomer) {
        if (selectCreatedCustomerForOrder.current) {
          setCustomerId(String(newCustomer.id));
          selectCreatedCustomerForOrder.current = false;
          setShowCustomerForm(false);
          openSection("new-order");
        }
        const query = customerSearchRef.current.trim().toLowerCase();
        const matchesVisibleList =
          !showArchivedCustomers &&
          (!query ||
            String(newCustomer.name || "").toLowerCase().includes(query) ||
            String(newCustomer.phone || "").includes(query));
        if (matchesVisibleList) {
          setCustomers((prev) => [newCustomer, ...prev.filter((c) => c.id !== newCustomer.id)]);
        }
        setOrderCustomers((prev) => [newCustomer, ...prev.filter((c) => c.id !== newCustomer.id)]);
      }
      fetchDashboardStats().catch(() => {});
    } catch (error: any) {
      console.error("Failed to create customer:", error);
      handleAuthError(error);
      const msg =
        error.response?.data?.message ||
        "Failed to create customer. Please try again.";
      setCustomerApiError(msg);
      if (error.response?.data?.errors?.phone?.[0]) {
        setCustomerErrors((prev) => ({
          ...prev,
          phone: error.response.data.errors.phone[0],
        }));
      }
      if (error.response?.data?.errors?.name?.[0]) {
        setCustomerErrors((prev) => ({
          ...prev,
          name: error.response.data.errors.name[0],
        }));
      }
      if (error.response?.data?.errors?.email?.[0]) {
        setCustomerErrors((prev) => ({
          ...prev,
          email: error.response.data.errors.email[0],
        }));
      }
    } finally {
      customerSubmittingRef.current = false;
      setIsSubmittingCustomer(false);
    }
  };

  const startEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.name);
    setEditCustomerPhone(customer.phone);
    setEditCustomerEmail(customer.email || "");
    setEditCustomerErrors({});
    setEditCustomerSuccess("");
    setEditCustomerApiError("");
  };

  const cancelEditCustomer = () => {
    setEditingCustomer(null);
    setEditCustomerName("");
    setEditCustomerPhone("");
    setEditCustomerEmail("");
    setEditCustomerErrors({});
    setEditCustomerSuccess("");
    setEditCustomerApiError("");
  };

  const updateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCustomer || customerEditSubmittingRef.current) {
      return;
    }

    setEditCustomerErrors({});
    setEditCustomerSuccess("");
    setEditCustomerApiError("");

    const validationResult = customerSchema.safeParse({
      name: editCustomerName,
      phone: editCustomerPhone,
      email: editCustomerEmail,
    });

    if (!validationResult.success) {
      const fieldErrors: { name?: string; phone?: string; email?: string } = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0] as "name" | "phone" | "email";
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setEditCustomerErrors(fieldErrors);
      return;
    }

    const validData = validationResult.data;

    // Check duplicate phone among existing customers excluding current customer
    const duplicate = [...orderCustomers, ...customers].find(
      (c) => c.phone === validData.phone && c.id !== editingCustomer.id
    );
    if (duplicate) {
      setEditCustomerErrors({
        phone: `Customer with phone ${validData.phone} already exists (${duplicate.name}).`,
      });
      return;
    }

    customerEditSubmittingRef.current = true;
    setIsSubmittingCustomerEdit(true);

    try {
      const response = await axios.patch(
        `${API_BASE}/customers/${editingCustomer.id}`,
        {
          name: validData.name,
          phone: validData.phone,
          email: validData.email || null,
        }
      );

      const updatedCustomer: Customer = response.data.data;

      setEditCustomerSuccess("Customer updated successfully!");
      setCustomers((prev) =>
        prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c))
      );
      setOrderCustomers((prev) =>
        prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c))
      );

      // Also update customer name/phone in loaded orders
      setOrders((prev) =>
        prev.map((ord) =>
          ord.customerId === updatedCustomer.id
            ? { ...ord, customer: updatedCustomer }
            : ord
        )
      );

      setTimeout(() => {
        cancelEditCustomer();
      }, 1200);
    } catch (error: any) {
      console.error("Failed to update customer:", error);
      handleAuthError(error);
      const msg =
        error.response?.data?.message ||
        "Failed to update customer. Please try again.";
      setEditCustomerApiError(msg);
      if (error.response?.data?.errors?.phone?.[0]) {
        setEditCustomerErrors((prev) => ({
          ...prev,
          phone: error.response.data.errors.phone[0],
        }));
      }
      if (error.response?.data?.errors?.name?.[0]) {
        setEditCustomerErrors((prev) => ({
          ...prev,
          name: error.response.data.errors.name[0],
        }));
      }
      if (error.response?.data?.errors?.email?.[0]) {
        setEditCustomerErrors((prev) => ({
          ...prev,
          email: error.response.data.errors.email[0],
        }));
      }
    } finally {
      customerEditSubmittingRef.current = false;
      setIsSubmittingCustomerEdit(false);
    }
  };

  const handleAddCustomStage = () => {
    setStageInputError("");
    const trimmed = capitalizeFirstLetter(newStageInput.trim());
    if (!trimmed) {
      setStageInputError("Stage name cannot be empty");
      return;
    }
    if (trimmed.length > 50) {
      setStageInputError("Stage name cannot exceed 50 characters");
      return;
    }
    if (orderStages.length >= 15) {
      setStageInputError("Cannot exceed 15 production stages");
      return;
    }
    const isDuplicate = orderStages.some(
      (s) => s.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setStageInputError(`A stage named "${trimmed}" is already in the list`);
      return;
    }

    setOrderStages((prev) => [...prev, trimmed]);
    setNewStageInput("");
  };

  const handleRemoveStage = (index: number) => {
    setStageInputError("");
    if (orderStages.length <= 1) {
      setStageInputError("At least one production stage is required");
      return;
    }
    setOrderStages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveStage = (index: number, direction: "up" | "down") => {
    setStageInputError("");
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderStages.length) return;

    setOrderStages((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleEditStageName = (index: number, newName: string) => {
    setStageInputError("");
    setOrderStages((prev) => {
      const copy = [...prev];
      copy[index] = capitalizeFirstLetter(newName);
      return copy;
    });
  };

  const handleResetDefaultStages = () => {
    setStageInputError("");
    setOrderStages(defaultStageTemplates);
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (orderSubmittingRef.current) {
      return;
    }

    setOrderErrors({});
    setOrderSuccess("");
    setOrderApiError("");

    const validationResult = orderFormSchema.safeParse({
      customerId,
      itemName,
      totalAmount,
      advance,
      promisedDate,
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const field = String(issue.path[0] || "form");
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setOrderErrors(fieldErrors);
      return;
    }

    const validData = validationResult.data;

    const stageError = validateOrderStages(orderStages);
    if (stageError) {
      setOrderErrors({ stages: stageError });
      return;
    }
    const sanitizedStages = sanitizeOrderStages(orderStages);

    orderSubmittingRef.current = true;
    setIsSubmittingOrder(true);

    try {
      const response = await axios.post(`${API_BASE}/orders`, {
        customerId: Number(validData.customerId),
        itemName: validData.itemName,
        totalAmount: Number(validData.totalAmount),
        advance: Number(validData.advance),
        promisedDate: validData.promisedDate,
        stages: sanitizedStages,
      });

      const newOrder = response.data.data;

      setOrderSuccess(response.data.message || "Order created successfully!");
      setCreatedOrderId(newOrder?.id ?? null);

      setItemName("");
      setTotalAmount("");
      setAdvance("");
      setCustomerId("");
      setPromisedDate("");
      setOrderStages(defaultStageTemplates);
      setNewStageInput("");
      setStageInputError("");

      if (newOrder) {
        setOrders((prev) => [newOrder, ...prev]);
      }
      fetchDashboardStats().catch(() => {});
    } catch (error: any) {
      console.error("Failed to create order:", error);
      handleAuthError(error);
      const msg =
        error.response?.data?.message ||
        "Failed to create order. Please try again.";
      setOrderApiError(msg);
      if (error.response?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(error.response.data.errors)) {
          if (Array.isArray(v) && v[0]) {
            apiErrors[k] = String(v[0]);
          }
        }
        setOrderErrors(apiErrors);
      }
    } finally {
      orderSubmittingRef.current = false;
      setIsSubmittingOrder(false);
    }
  };

  const totalOutstanding = dashboardStats ? dashboardStats.totalOutstanding : orders.reduce((sum, o) => sum + o.balance, 0);
  const totalRevenue = dashboardStats ? dashboardStats.totalCollected : 0;
  const totalCustomersCount = dashboardStats ? dashboardStats.totalCustomers : customers.length;

  return (
    <div className="admin-app-layout">
      <HeaderBar
        ownerEmail={ownerEmail}
        ownerName={ownerProfile.name}
        businessName={ownerProfile.businessName}
        onLogout={onLogout}
        activeTab={activeTab === "new-order" ? "orders" : activeTab}
        onTabChange={openSection}
      />

      <main className="admin-main-viewport">
        {activeTab === "settings" ? (
          <SettingsPage
            ownerEmail={ownerEmail}
            ownerName={ownerProfile.name}
            ownerPhone={ownerProfile.phone}
            businessName={ownerProfile.businessName}
            onLogout={onLogout}
            onProfileUpdated={(updated) => {
              setOwnerProfile({
                name: updated.name,
                phone: updated.phone,
                businessName: updated.businessName,
              });
            }}
          />
        ) : (
          <>
            {activeTab === "orders" && (
          <OrderList
            orders={orders}
            pagination={orderPagination}
            onPageChange={(p) => {
              void fetchOrders({ page: p });
            }}
            loadingInitial={loadingInitial}
            loading={ordersLoading}
            loadError={ordersLoadError}
            onRetry={() => {
              void fetchOrders();
            }}
            searchTerm={orderSearchTerm}
            statusFilter={paymentStatusFilter}
            selectedOrderId={selectedOrder}
            payments={payments}
            stages={stages}
            paymentInputs={paymentInputs}
            paymentErrors={paymentErrors}
            paymentSuccess={paymentSuccess}
            submittingPayment={submittingPayment}
            updatingStage={updatingStage}
            onSearchChange={handleOrderSearchChange}
            onStatusFilterChange={(status) => applyOrderServerFilters(status, showArchivedOrders)}
            onToggleDetails={toggleOrderDetails}
            onPaymentAmountChange={(orderId, amount) => {
              const sanitized = amount.replace(/\D/g, "");
              setPaymentInputs((prev) => ({
                ...prev,
                [orderId]: {
                  amount: sanitized,
                  type: prev[orderId]?.type || "ADVANCE",
                },
              }));
              if (paymentErrors[orderId]) {
                setPaymentErrors((prev) => ({
                  ...prev,
                  [orderId]: "",
                }));
              }
            }}
            onPaymentTypeChange={(orderId, type) => {
              setPaymentInputs((prev) => ({
                ...prev,
                [orderId]: {
                  amount: prev[orderId]?.amount || "",
                  type,
                },
              }));
            }}
            onRecordPayment={recordPayment}
            onReconcile={async (orderId) => {
              try {
                const res = await axios.post(`${API_BASE}/orders/${orderId}/reconcile`);
                alert(res.data.message || "Reconciliation complete.");
                await Promise.all([fetchOrders(), fetchPayments(orderId)]);
              } catch (err: any) {
                handleAuthError(err);
                alert(err.response?.data?.message || "Reconciliation failed.");
              }
            }}
            onCancelPayment={handleCancelPayment}
            onUpdateStageStatus={updateStageStatus}
            onCancelOrder={handleCancelOrder}
            onArchiveOrder={handleArchiveOrder}
            onRestoreOrder={handleRestoreOrder}
            showArchived={showArchivedOrders}
            onToggleArchived={handleToggleArchivedOrders}
            onCreateOrderClick={() => openSection("new-order")}
          />
          )}

          {activeTab === "customers" && (
          <section id="customer-management" className="boutique-section" aria-label="Customer Management">
            <div className="section-header-row">
              <div>
                <div className="section-title-wrap">
                  <h1 className="section-title">
                    {showArchivedCustomers ? "Archived Customers" : "Customers"}
                  </h1>
                  <span className="count-pill">
                    {showArchivedCustomers
                      ? (archivedCustomerCount ?? (customerPagination ? customerPagination.total : customers.length))
                      : totalCustomersCount}
                  </span>
                </div>
                <p className="section-subtitle">
                  {showArchivedCustomers
                    ? "Review and restore archived client profiles."
                    : "Manage client contact details and order histories."}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowCustomerForm((v) => !v);
                  if (!showCustomerForm) {
                    window.requestAnimationFrame(() => {
                      document.getElementById("add-customer")?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    });
                  }
                }}
              >
                {showCustomerForm ? "Close Form" : "+ Add Customer"}
              </button>
            </div>

            {showCustomerForm && (
              <CustomerCreateCard
                name={name}
                phone={phone}
                email={email}
                errors={customerErrors}
                apiError={customerApiError}
                successMessage={customerSuccess}
                isSubmitting={isSubmittingCustomer}
                onNameChange={(val) => {
                  setName(capitalizeFirstLetter(val));
                  if (customerErrors.name) {
                    setCustomerErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                onPhoneChange={handlePhoneChange}
                onEmailChange={(val) => {
                  setEmail(val);
                  if (customerErrors.email) {
                    setCustomerErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                onPhonePaste={handlePhonePaste}
                onSubmit={createCustomer}
                onClose={() => {
                  selectCreatedCustomerForOrder.current = false;
                  setShowCustomerForm(false);
                }}
              />
            )}

            <CustomerList
              customers={customers}
              pagination={customerPagination}
              onPageChange={(p) => fetchCustomers(p, showArchivedCustomers)}
              editingCustomer={editingCustomer}
              editCustomerName={editCustomerName}
              editCustomerPhone={editCustomerPhone}
              editCustomerEmail={editCustomerEmail}
              editCustomerErrors={editCustomerErrors}
              editCustomerApiError={editCustomerApiError}
              editCustomerSuccess={editCustomerSuccess}
              isSubmittingCustomerEdit={isSubmittingCustomerEdit}
              onStartEdit={startEditCustomer}
              onCancelEdit={cancelEditCustomer}
              onEditNameChange={(val) => {
                setEditCustomerName(capitalizeFirstLetter(val));
                if (editCustomerErrors.name) {
                  setEditCustomerErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              onEditPhoneChange={(val) => {
                const digits = val.replace(/\D/g, "").slice(0, 10);
                setEditCustomerPhone(digits);
                if (!digits) {
                  setEditCustomerErrors((prev) => ({ ...prev, phone: undefined }));
                  return;
                }
                const check = validateStrictIndianPhone(digits);
                if (!check.isValid) {
                  setEditCustomerErrors((prev) => ({ ...prev, phone: check.message }));
                } else {
                  setEditCustomerErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              onEditEmailChange={(val) => {
                setEditCustomerEmail(val);
                if (editCustomerErrors.email) {
                  setEditCustomerErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              onUpdateCustomerSubmit={updateCustomer}
              onArchiveCustomer={handleArchiveCustomer}
              onRestoreCustomer={handleRestoreCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              showArchived={showArchivedCustomers}
              onToggleArchived={handleToggleArchivedCustomers}
              searchTerm={customerSearch}
              onSearchChange={handleCustomerSearchChange}
              loading={customerLoading}
              loadError={customerLoadError}
              onRetry={() => fetchCustomers(customerPage, showArchivedCustomers)}
              orders={orders}
              payments={payments}
              onOpenOrder={openCustomerOrder}
              onCreateOrderForCustomer={handleCreateOrderForCustomer}
            />
          </section>
          )}

          {activeTab === "new-order" && (
          <section id="create-order" className="boutique-section" aria-label="Create Order">
            <div className="section-header-row">
              <div>
                <h1 className="section-title">Create Order</h1>
                <p className="section-subtitle">
                  Record new bespoke clothing, agreed deposits, and tailor milestones.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => openSection("orders")}
              >
                ← Back to Orders
              </button>
            </div>

            <OrderCreateForm
              customers={orderCustomers}
              customerId={customerId}
              itemName={itemName}
              totalAmount={totalAmount}
              advance={advance}
              promisedDate={promisedDate}
              orderErrors={orderErrors}
              orderSuccess={orderSuccess}
              orderApiError={orderApiError}
              isSubmittingOrder={isSubmittingOrder}
              onDismissSuccess={() => {
                setOrderSuccess("");
                setCreatedOrderId(null);
              }}
              orderStages={orderStages}
              newStageInput={newStageInput}
              stageInputError={stageInputError}
              onCustomerIdChange={(val) => {
                setCustomerId(val);
                if (orderErrors.customerId) {
                  setOrderErrors((prev) => ({ ...prev, customerId: undefined }));
                }
              }}
              onItemNameChange={(val) => {
                setItemName(capitalizeFirstLetter(val));
                if (orderErrors.itemName) {
                  setOrderErrors((prev) => ({ ...prev, itemName: undefined }));
                }
              }}
              onTotalAmountChange={(val) => {
                const digits = val.replace(/\D/g, "");
                setTotalAmount(digits);
                if (orderErrors.totalAmount) {
                  setOrderErrors((prev) => ({ ...prev, totalAmount: undefined }));
                }
              }}
              onAdvanceChange={(val) => {
                const digits = val.replace(/\D/g, "");
                setAdvance(digits);
                if (orderErrors.advance) {
                  setOrderErrors((prev) => ({ ...prev, advance: undefined }));
                }
              }}
              onPromisedDateChange={(val) => {
                setPromisedDate(val);
                if (orderErrors.promisedDate) {
                  setOrderErrors((prev) => ({ ...prev, promisedDate: undefined }));
                }
              }}
              onNewStageInputChange={(val) => setNewStageInput(capitalizeFirstLetter(val))}
              onAddStage={handleAddCustomStage}
              onRemoveStage={handleRemoveStage}
              onMoveStage={handleMoveStage}
              onEditStageName={handleEditStageName}
              onResetDefaultStages={handleResetDefaultStages}
              onSubmit={createOrder}
              onStartAddCustomer={() => {
                selectCreatedCustomerForOrder.current = true;
                setShowCustomerForm(true);
                openSection("customers");
              }}
              onViewCreatedOrder={
                createdOrderId
                  ? () => {
                      void handleViewRecentOrder(createdOrderId);
                    }
                  : undefined
              }
            />
          </section>
          )}

          {activeTab === "payments" && (
            <PaymentsPage
              totalCollected={totalRevenue}
              totalOutstanding={totalOutstanding}
              recentPayments={dashboardStats?.recentPayments ?? []}
              orders={orders}
              onOpenOrder={(orderId) => {
                void handleViewRecentOrder(orderId);
              }}
            />
          )}

          {activeTab === "reports" && (
            <ReportsPage stats={dashboardStats} />
          )}
        </>
      )}
      </main>
    </div>
  );
}

// ----------------------------------------------------
// ROOT APP COMPONENT (Router & Session Check)
// ----------------------------------------------------
function OwnerPortal() {
  // Owner Auth Session state
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [view, setView] = useState<"login" | "signup">("login");
  const [loginNotice, setLoginNotice] = useState("");

  const checkSession = async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/me`);
      if (res.data?.success && res.data?.data?.role === "owner") {
        setIsAuthenticated(true);
        setOwnerEmail(res.data.data.email);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setSessionChecked(true);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLoginSuccess = (email: string) => {
    setIsAuthenticated(true);
    setOwnerEmail(email);
  };

  const handleRegistrationSuccess = (ownerProfile: { email: string; name?: string; businessName?: string | null }) => {
    setIsAuthenticated(true);
    setOwnerEmail(ownerProfile.email);
    setLoginNotice("");
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`);
    } catch {
      // Proceed with local logout regardless of network
    } finally {
      setIsAuthenticated(false);
      setOwnerEmail("");
    }
  };

  if (!sessionChecked) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (view === "signup") {
      return (
        <OwnerSignUpPage
          onSwitchToLogin={() => setView("login")}
          onRegistrationSuccess={handleRegistrationSuccess}
        />
      );
    }

    return (
      <OwnerLoginPage
        onLoginSuccess={handleLoginSuccess}
        onSwitchToSignUp={() => setView("signup")}
        successNotice={loginNotice}
      />
    );
  }

  return <AdminApp ownerEmail={ownerEmail} onLogout={handleLogout} />;
}

import {
  PREVIEW_CUSTOMERS,
  PREVIEW_ORDERS,
  PREVIEW_PAYMENTS,
  PREVIEW_STAGES,
  PREVIEW_STATS,
} from "./preview-fixtures";

function App() {
  const path = window.location.pathname;
  const match = path.match(/^\/track\/([^/]+)$/);

  // 1. Customer tracking page is always public
  if (match) {
    return <CustomerOrderPage token={match[1]} />;
  }

  // 2. UI Preview Harness (active when ?preview=true)
  if (typeof window !== "undefined" && window.location.search.includes("preview=true")) {
    const params = new URLSearchParams(window.location.search);
    const tab = (params.get("tab") as NavTab) || "orders";
    const orderIdParam = params.get("orderId");
    return (
      <AdminApp
        ownerEmail="owner@saffronbridal.com"
        onLogout={() => {}}
        initialTab={tab}
        initialOrders={PREVIEW_ORDERS}
        initialCustomers={PREVIEW_CUSTOMERS}
        initialStats={PREVIEW_STATS}
        initialStages={PREVIEW_STAGES}
        initialPayments={PREVIEW_PAYMENTS}
        initialBusinessName="Saffron Bridal Studio"
        initialOwnerName="Anusha Rao"
        initialSelectedOrderId={orderIdParam ? Number(orderIdParam) : undefined}
      />
    );
  }

  return <OwnerPortal />;
}

export default App;
