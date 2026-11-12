export interface PaymentReceiptEmailData {
  boutiqueName?: string | null;
  customerName: string;
  orderId: number;
  itemName: string;
  amountReceived: number;
  totalAmount: number;
  remainingBalance: number;
  paymentMethod: "Online (Razorpay)" | "Cash" | "Cash (Store Receipt)";
  paymentDate: string;
  referenceId?: string | null;
}

export function generatePaymentReceiptHtml(data: PaymentReceiptEmailData): string {
  const {
    boutiqueName,
    customerName,
    orderId,
    itemName,
    amountReceived,
    totalAmount,
    remainingBalance,
    paymentMethod,
    paymentDate,
    referenceId,
  } = data;

  const brandName = boutiqueName || "Advance Pay";
  const isFullyPaid = remainingBalance <= 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt — Advance Pay</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f7f5f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #2b2322;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f7f5f0;
      padding: 36px 0;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e7ded0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(128, 0, 32, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #4a0404 0%, #800020 100%);
      color: #ffffff;
      padding: 32px 28px;
      text-align: center;
      border-bottom: 3px solid #d4af37;
    }
    .header h1 {
      margin: 0 0 6px;
      font-size: 26px;
      letter-spacing: 1.5px;
      font-weight: 700;
      color: #ffffff;
      text-transform: uppercase;
    }
    .header p {
      margin: 0;
      font-size: 13px;
      letter-spacing: 2px;
      color: #f3e5ab;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 30px;
    }
    .salutation {
      font-size: 17px;
      font-weight: 600;
      color: #800020;
      margin-bottom: 12px;
    }
    .badge {
      display: inline-block;
      background-color: #f0fdf4;
      border: 1px solid #86efac;
      color: #166534;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 8px 0 20px;
    }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0 24px;
      background-color: #fdfbf7;
      border: 1px solid #ebdcc5;
      border-radius: 8px;
    }
    .receipt-table td {
      padding: 12px 16px;
      font-size: 14px;
      border-bottom: 1px solid #ebdcc5;
    }
    .receipt-table tr:last-child td {
      border-bottom: none;
    }
    .receipt-label {
      color: #786c5f;
      font-weight: 500;
      width: 45%;
    }
    .receipt-value {
      color: #2b2322;
      font-weight: 600;
      text-align: right;
    }
    .highlight-row {
      background-color: #fbf5ea;
    }
    .amount-received {
      color: #800020;
      font-size: 18px;
      font-weight: 700;
    }
    .balance-status {
      padding: 14px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
      font-size: 14px;
      font-weight: 600;
    }
    .fully-paid {
      background-color: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .partially-paid {
      background-color: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .footer {
      background-color: #f7f5f0;
      border-top: 1px solid #ebdcc5;
      padding: 24px 28px;
      text-align: center;
      font-size: 12px;
      color: #786c5f;
      line-height: 1.6;
    }
    .footer strong {
      color: #800020;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>${brandName}</h1>
        <p>Official Payment Receipt</p>
      </div>

      <div class="content">
        <div class="salutation">Dear ${escapeHtml(customerName)},</div>
        <p style="margin: 0 0 10px; line-height: 1.5; font-size: 14px; color: #4a403d;">
          Thank you for choosing Advance Pay. We have received and verified your payment. Below is your official boutique payment confirmation.
        </p>

        <div style="text-align: center;">
          <div class="badge">✓ Payment Status: Successful</div>
        </div>

        <table class="receipt-table" role="presentation">
          <tr>
            <td class="receipt-label">Order Reference</td>
            <td class="receipt-value">#${orderId}</td>
          </tr>
          <tr>
            <td class="receipt-label">Item Description</td>
            <td class="receipt-value">${escapeHtml(itemName)}</td>
          </tr>
          <tr>
            <td class="receipt-label">Payment Date & Time</td>
            <td class="receipt-value">${escapeHtml(paymentDate)}</td>
          </tr>
          <tr>
            <td class="receipt-label">Payment Mode</td>
            <td class="receipt-value">${escapeHtml(paymentMethod)}</td>
          </tr>
          ${referenceId ? `
          <tr>
            <td class="receipt-label">Gateway Reference ID</td>
            <td class="receipt-value" style="font-family: monospace; font-size: 13px;">${escapeHtml(referenceId)}</td>
          </tr>
          ` : ""}
          <tr class="highlight-row">
            <td class="receipt-label"><strong>Amount Received</strong></td>
            <td class="receipt-value amount-received">₹${amountReceived.toLocaleString("en-IN")}</td>
          </tr>
          <tr>
            <td class="receipt-label">Total Order Value</td>
            <td class="receipt-value">₹${totalAmount.toLocaleString("en-IN")}</td>
          </tr>
          <tr class="highlight-row">
            <td class="receipt-label"><strong>Outstanding Balance</strong></td>
            <td class="receipt-value" style="color: ${isFullyPaid ? "#166534" : "#b91c1c"}; font-weight: 700;">
              ₹${remainingBalance.toLocaleString("en-IN")}
            </td>
          </tr>
        </table>

        <div class="balance-status ${isFullyPaid ? "fully-paid" : "partially-paid"}">
          ${isFullyPaid
            ? "✓ Congratulations! Your order is fully paid. Our master tailors are putting the finishing touches on your creation."
            : `Remaining balance of ₹${remainingBalance.toLocaleString("en-IN")} is due prior to final delivery.`}
        </div>
      </div>

      <div class="footer">
        <p style="margin: 0 0 6px;">
          <strong>Advance Pay Boutique Studio</strong>
        </p>
        <p style="margin: 0;">
          This is an automatically generated receipt for your custom order. If you have questions regarding your order, please contact the boutique desk.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
