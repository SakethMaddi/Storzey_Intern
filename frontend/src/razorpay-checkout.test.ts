import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRazorpayCheckoutOptions } from "./features/tracking/razorpay-checkout.ts";

describe("Razorpay Checkout UPI options", () => {
  it("requests UPI Intent and QR without a VPA field and keeps other methods", () => {
    const options = buildRazorpayCheckoutOptions({
      keyId: "rzp_test_checkout",
      amount: 25000,
      currency: "INR",
      description: "ADVANCE payment for Blouse",
      orderId: "order_test_upi",
      customerName: "Asha",
      handler: () => undefined,
      onDismiss: () => undefined,
    });

    const instrument = options.config.display.blocks.upi.instruments[0];
    assert.equal(instrument?.method, "upi");
    assert.deepEqual(instrument?.flows, ["intent", "qr"]);
    assert.deepEqual(instrument?.apps, ["google_pay", "phonepe", "paytm"]);
    assert.equal(options.config.display.preferences.show_default_blocks, true);
    assert.deepEqual(options.config.display.sequence, ["block.upi"]);
    assert.deepEqual(options.config.display.hide, [{ method: "upi" }]);
    assert.equal(
      options.config.display.hide.some((item) =>
        ["card", "netbanking", "wallet"].includes(item.method)
      ),
      false
    );
    assert.equal("vpa" in options, false);
    assert.equal("method" in options, false);
    assert.equal(options.order_id, "order_test_upi");
    assert.equal(options.prefill.name, "Asha");
    assert.equal("contact" in options.prefill, false);
    assert.equal("email" in options.prefill, false);
  });
});
