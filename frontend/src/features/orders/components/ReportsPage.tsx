import { inr } from "../order-utils";

export interface ReportStats {
  totalOrders: number;
  totalCustomers: number;
  totalOrderValue: number;
  totalCollected: number;
  totalOutstanding: number;
  paidCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
}

export function ReportsPage({ stats }: { stats: ReportStats | null }) {
  if (!stats) {
    return (
      <section className="boutique-section" aria-label="Reports and analytics">
        <div className="section-header-row">
          <div>
            <h1 className="section-title">Reports & Analytics</h1>
            <p className="section-subtitle">Financial and order performance metrics.</p>
          </div>
        </div>
        <div className="empty-state-card">
          <div className="empty-spinner" />
          <p>Loading analytics data from the server...</p>
        </div>
      </section>
    );
  }

  // Calculations for real data visualizations
  const totalVal = Math.max(1, stats.totalOrderValue);
  const collectedPct = Math.min(100, Math.round((stats.totalCollected / totalVal) * 100));
  const outstandingPct = Math.min(100, Math.round((stats.totalOutstanding / totalVal) * 100));

  const totalOrderCount = Math.max(1, stats.totalOrders);
  const paidPct = Math.round((stats.paidCount / totalOrderCount) * 100);
  const partialPct = Math.round((stats.partiallyPaidCount / totalOrderCount) * 100);
  const pendingPct = Math.round((stats.pendingCount / totalOrderCount) * 100);

  return (
    <section className="boutique-section" aria-label="Reports and analytics">
      {/* ── 1. HEADER ── */}
      <div className="section-header-row">
        <div>
          <h1 className="section-title">Reports & Analytics</h1>
          <p className="section-subtitle">
            Verified financial summaries and order status breakdowns across your boutique.
          </p>
        </div>
      </div>

      {/* ── 2. PRIMARY REVENUE KPI CARDS ── */}
      <div className="financial-kpi-grid">
        <div className="kpi-card kpi-card-collected">
          <div className="kpi-head">
            <span className="kpi-label">Revenue Collected</span>
            <span className="kpi-badge badge-paid">Verified</span>
          </div>
          <strong className="kpi-value text-paid">{inr(stats.totalCollected)}</strong>
          <span className="kpi-footer">Completed & captured payments</span>
        </div>

        <div className="kpi-card kpi-card-outstanding">
          <div className="kpi-head">
            <span className="kpi-label">Outstanding Balance</span>
            <span className="kpi-badge badge-pending">Due</span>
          </div>
          <strong className="kpi-value text-balance">{inr(stats.totalOutstanding)}</strong>
          <span className="kpi-footer">Unpaid balance on active orders</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label">Total Order Value</span>
            <span className="kpi-badge badge-active">Gross</span>
          </div>
          <strong className="kpi-value text-slate">{inr(stats.totalOrderValue)}</strong>
          <span className="kpi-footer">Cumulative bespoke order total</span>
        </div>
      </div>

      {/* ── 3. SECONDARY METRICS ROW ── */}
      <div className="report-metrics-row">
        <div className="mini-stat-card">
          <span className="mini-label">Total Orders</span>
          <strong className="mini-num">{stats.totalOrders}</strong>
        </div>
        <div className="mini-stat-card">
          <span className="mini-label">Total Customers</span>
          <strong className="mini-num">{stats.totalCustomers}</strong>
        </div>
        <div className="mini-stat-card">
          <span className="mini-label">Fully Paid</span>
          <strong className="mini-num text-paid">{stats.paidCount}</strong>
        </div>
        <div className="mini-stat-card">
          <span className="mini-label">Partially Paid</span>
          <strong className="mini-num text-brand">{stats.partiallyPaidCount}</strong>
        </div>
        <div className="mini-stat-card">
          <span className="mini-label">Awaiting Payment</span>
          <strong className="mini-num text-balance">{stats.pendingCount}</strong>
        </div>
      </div>

      {/* ── 4. REAL-DATA CHARTS & VISUALIZATIONS ── */}
      <div className="charts-two-col-grid">
        {/* Visualization 1: Payment Collection Breakdown */}
        <div className="analytics-chart-card">
          <div className="chart-card-header">
            <h3>Payment Collection Breakdown</h3>
            <span className="chart-tag">Cash Flow</span>
          </div>
          <p className="chart-desc">
            Comparison of collected revenue vs outstanding balance across total order value.
          </p>

          <div className="segmented-bar-track">
            <div
              className="segmented-bar-fill fill-collected"
              style={{ width: `${collectedPct}%` }}
              title={`Collected: ${collectedPct}%`}
            />
            <div
              className="segmented-bar-fill fill-outstanding"
              style={{ width: `${outstandingPct}%` }}
              title={`Outstanding: ${outstandingPct}%`}
            />
          </div>

          <div className="chart-legend-grid">
            <div className="legend-item">
              <span className="legend-dot dot-collected" />
              <div className="legend-text">
                <span className="legend-name">Collected Revenue</span>
                <strong className="legend-val text-paid">{inr(stats.totalCollected)} ({collectedPct}%)</strong>
              </div>
            </div>

            <div className="legend-item">
              <span className="legend-dot dot-outstanding" />
              <div className="legend-text">
                <span className="legend-name">Outstanding Balance</span>
                <strong className="legend-val text-balance">{inr(stats.totalOutstanding)} ({outstandingPct}%)</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Visualization 2: Order Status Distribution */}
        <div className="analytics-chart-card">
          <div className="chart-card-header">
            <h3>Order Payment Distribution</h3>
            <span className="chart-tag">Order Volume</span>
          </div>
          <p className="chart-desc">
            Breakdown of active orders by settlement status.
          </p>

          <div className="segmented-bar-track">
            <div
              className="segmented-bar-fill fill-paid"
              style={{ width: `${paidPct}%` }}
              title={`Paid: ${paidPct}%`}
            />
            <div
              className="segmented-bar-fill fill-partial"
              style={{ width: `${partialPct}%` }}
              title={`Partially Paid: ${partialPct}%`}
            />
            <div
              className="segmented-bar-fill fill-pending"
              style={{ width: `${pendingPct}%` }}
              title={`Pending: ${pendingPct}%`}
            />
          </div>

          <div className="chart-legend-grid">
            <div className="legend-item">
              <span className="legend-dot dot-paid" />
              <div className="legend-text">
                <span className="legend-name">Paid in Full</span>
                <strong className="legend-val text-paid">{stats.paidCount} orders ({paidPct}%)</strong>
              </div>
            </div>

            <div className="legend-item">
              <span className="legend-dot dot-partial" />
              <div className="legend-text">
                <span className="legend-name">Partially Paid</span>
                <strong className="legend-val text-brand">{stats.partiallyPaidCount} orders ({partialPct}%)</strong>
              </div>
            </div>

            <div className="legend-item">
              <span className="legend-dot dot-pending" />
              <div className="legend-text">
                <span className="legend-name">Pending Payment</span>
                <strong className="legend-val text-balance">{stats.pendingCount} orders ({pendingPct}%)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
