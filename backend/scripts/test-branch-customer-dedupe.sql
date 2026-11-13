-- Test branch only: advance-pay-migration-test
-- Endpoint: ep-flat-mouse-bd7brl8f
-- Database: neondb
--
-- Reassign Order #9 from Customer #7 to Customer #6, then delete
-- duplicate Customers #3, #4, #5, and #7.
-- Retain Customer #2 (phone 9876543210) and Customer #6 (phone 8801778275).
-- Do not run this against production. Do not run it until explicitly approved.

BEGIN;

DO $$
DECLARE
  v_endpoint text;
  v_customers integer;
  v_orders integer;
  v_payments integer;
  v_stages integer;
  v_owners integer;
  v_moved integer;
  v_deleted integer;
  v_customer_fks integer;
  v_remaining_customers integer;
  v_duplicate_phones integer;
  v_changed_orders integer;
  v_changed_payments integer;
  v_changed_stages integer;
  v_order9_customer integer;
  v_order9_stages_before integer;
  v_order9_stages_after integer;
BEGIN
  v_endpoint := current_setting('neon.endpoint_id', true);
  IF v_endpoint IS DISTINCT FROM 'ep-flat-mouse-bd7brl8f' THEN
    RAISE EXCEPTION 'ABORTED: endpoint % is not the test branch', COALESCE(v_endpoint, '<missing>');
  END IF;

  IF current_database() IS DISTINCT FROM 'neondb' THEN
    RAISE EXCEPTION 'ABORTED: database % is not neondb', current_database();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Customer'
      AND column_name = 'ownerId'
  ) THEN
    RAISE EXCEPTION 'ABORTED: Customer.ownerId already exists. This cleanup is valid only before the tenant migration.';
  END IF;

  SELECT COUNT(*) INTO v_customer_fks
  FROM pg_constraint
  WHERE contype = 'f'
    AND confrelid = '"Customer"'::regclass
    AND conname <> 'Order_customerId_fkey';

  IF v_customer_fks <> 0 THEN
    RAISE EXCEPTION 'ABORTED: unexpected foreign keys reference Customer.';
  END IF;

  SELECT COUNT(*) INTO v_customers FROM "Customer";
  SELECT COUNT(*) INTO v_orders FROM "Order";
  SELECT COUNT(*) INTO v_payments FROM "Payment";
  SELECT COUNT(*) INTO v_stages FROM "OrderStage";
  SELECT COUNT(*) INTO v_owners FROM "Owner";

  IF v_customers <> 9 OR v_orders <> 7 OR v_payments <> 0 OR v_stages <> 35 OR v_owners <> 1 THEN
    RAISE EXCEPTION
      'ABORTED: unexpected counts customers=% orders=% payments=% stages=% owners=%',
      v_customers, v_orders, v_payments, v_stages, v_owners;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE id = 2 AND phone = '9876543210'
  ) OR NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE id = 3 AND phone = '9876543210'
  ) OR NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE id = 4 AND phone = '9876543210'
  ) THEN
    RAISE EXCEPTION 'ABORTED: customers 2, 3, and 4 are not the confirmed duplicate group.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE id = 6 AND phone = '8801778275'
  ) OR NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE id = 5 AND phone = '8801778275'
  ) OR NOT EXISTS (
    SELECT 1 FROM "Customer" WHERE id = 7 AND phone = '8801778275'
  ) THEN
    RAISE EXCEPTION 'ABORTED: customers 5, 6, and 7 are not the confirmed duplicate group.';
  END IF;

  IF (
    SELECT COUNT(*) FROM "Order" WHERE "customerId" = 2 AND id IN (1, 2)
  ) <> 2 OR EXISTS (
    SELECT 1 FROM "Order" WHERE "customerId" = 2 AND id NOT IN (1, 2)
  ) THEN
    RAISE EXCEPTION 'ABORTED: customer 2 does not have exactly orders 1 and 2.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Order" WHERE "customerId" IN (3, 4, 5)) THEN
    RAISE EXCEPTION 'ABORTED: customers 3, 4, or 5 already have orders.';
  END IF;

  IF (
    SELECT COUNT(*) FROM "Order" WHERE "customerId" = 6 AND id IN (3, 4, 5)
  ) <> 3 OR EXISTS (
    SELECT 1 FROM "Order" WHERE "customerId" = 6 AND id NOT IN (3, 4, 5)
  ) THEN
    RAISE EXCEPTION 'ABORTED: customer 6 does not have exactly orders 3, 4, and 5.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "Order" WHERE id = 9 AND "customerId" = 7
  ) OR (
    SELECT COUNT(*) FROM "Order" WHERE "customerId" = 7
  ) <> 1 THEN
    RAISE EXCEPTION 'ABORTED: customer 7 does not have exactly order 9.';
  END IF;

  SELECT COUNT(*) INTO v_order9_stages_before
  FROM "OrderStage"
  WHERE "orderId" = 9;

  IF v_order9_stages_before <> 5 THEN
    RAISE EXCEPTION 'ABORTED: order 9 has % stages, expected 5.', v_order9_stages_before;
  END IF;

  PERFORM id FROM "Customer" ORDER BY id FOR UPDATE;
  PERFORM id FROM "Order" ORDER BY id FOR UPDATE;
  PERFORM id FROM "Payment" ORDER BY id FOR UPDATE;
  PERFORM id FROM "OrderStage" ORDER BY id FOR UPDATE;

  CREATE TEMP TABLE customer_before ON COMMIT DROP AS
    SELECT id, phone FROM "Customer";
  CREATE TEMP TABLE order_before ON COMMIT DROP AS
    SELECT id, "customerId" FROM "Order";
  CREATE TEMP TABLE payment_before ON COMMIT DROP AS
    SELECT id, "orderId", amount, status, "paymentType" FROM "Payment";
  CREATE TEMP TABLE stage_before ON COMMIT DROP AS
    SELECT id, "orderId", name, status FROM "OrderStage";

  UPDATE "Order"
  SET "customerId" = 6
  WHERE id = 9
    AND "customerId" = 7;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  IF v_moved <> 1 THEN
    RAISE EXCEPTION 'ABORTED: expected to reassign 1 order, changed %.', v_moved;
  END IF;

  DELETE FROM "Customer"
  WHERE id IN (3, 4, 5, 7);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 4 THEN
    RAISE EXCEPTION 'ABORTED: expected to delete 4 customers, deleted %.', v_deleted;
  END IF;

  SELECT COUNT(*) INTO v_remaining_customers FROM "Customer";
  SELECT COUNT(*) INTO v_orders FROM "Order";
  SELECT COUNT(*) INTO v_payments FROM "Payment";
  SELECT COUNT(*) INTO v_stages FROM "OrderStage";
  SELECT COUNT(*) INTO v_owners FROM "Owner";
  SELECT "customerId" INTO v_order9_customer FROM "Order" WHERE id = 9;
  SELECT COUNT(*) INTO v_order9_stages_after FROM "OrderStage" WHERE "orderId" = 9;

  SELECT COUNT(*) INTO v_duplicate_phones
  FROM (
    SELECT phone
    FROM "Customer"
    GROUP BY phone
    HAVING COUNT(*) > 1
  ) duplicates;

  SELECT COUNT(*) INTO v_changed_orders
  FROM "Order" o
  JOIN order_before b ON b.id = o.id
  WHERE o.id <> 9
    AND o."customerId" IS DISTINCT FROM b."customerId";

  SELECT COUNT(*) INTO v_changed_payments
  FROM (
    SELECT id, "orderId", amount, status, "paymentType" FROM "Payment"
    EXCEPT
    SELECT id, "orderId", amount, status, "paymentType" FROM payment_before
  ) changed_payments;

  SELECT COUNT(*) INTO v_changed_stages
  FROM (
    SELECT id, "orderId", name, status FROM "OrderStage"
    EXCEPT
    SELECT id, "orderId", name, status FROM stage_before
  ) changed_stages;

  IF v_remaining_customers <> 5
    OR v_orders <> 7
    OR v_payments <> 0
    OR v_stages <> 35
    OR v_owners <> 1
    OR v_order9_customer IS DISTINCT FROM 6
    OR v_order9_stages_after IS DISTINCT FROM v_order9_stages_before
    OR v_duplicate_phones <> 0
    OR v_changed_orders <> 0
    OR v_changed_payments <> 0
    OR v_changed_stages <> 0
    OR EXISTS (SELECT 1 FROM "Customer" WHERE id IN (3, 4, 5, 7))
    OR NOT EXISTS (SELECT 1 FROM "Customer" WHERE id = 2 AND phone = '9876543210')
    OR NOT EXISTS (SELECT 1 FROM "Customer" WHERE id = 6 AND phone = '8801778275')
    OR EXISTS (SELECT 1 FROM "Order" WHERE "customerId" IN (3, 4, 5, 7))
    OR EXISTS (
      SELECT 1
      FROM customer_before b
      JOIN "Customer" c ON c.id = b.id
      WHERE b.id NOT IN (3, 4, 5, 7)
        AND c.phone IS DISTINCT FROM b.phone
    )
    OR EXISTS (
      SELECT 1
      FROM customer_before b
      WHERE b.id NOT IN (3, 4, 5, 7)
        AND NOT EXISTS (SELECT 1 FROM "Customer" c WHERE c.id = b.id)
    )
    OR (SELECT COUNT(*) FROM "Order" o JOIN order_before b ON b.id = o.id) <> 7
  THEN
    RAISE EXCEPTION 'ABORTED: postcondition failed. Transaction will roll back.';
  END IF;
END $$;

COMMIT;
