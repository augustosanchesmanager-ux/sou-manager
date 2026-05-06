BEGIN;

-- ============================================================
-- Migration: 20260505000000_fix_expense_due_date_timezone
-- Target: public.transactions
-- Column: date (TIMESTAMPTZ -> stores date as UTC timestamp)
-- Bug: Frontend sends 'YYYY-MM-DD' via new Date(str).toISOString()
--      which adds timezone offset, causing day shift in UTC-3.
--
-- Root cause:
-- Frontend: normalizeDateForDb('2026-05-15')
--   -> new Date('2026-05-15T00:00:00').toISOString()
--   -> '2026-05-15T03:00:00.000Z' (Brazil UTC-3 + 3h)
--
-- Stored in TIMESTAMPTZ as UTC: 2026-05-15 03:00:00+00
-- When CAST to DATE (depends on session timezone):
--   If session TZ = UTC: DATE('2026-05-15T03:00:00+00') = '2026-05-15' ✓
--   If session TZ = UTC-3: DATE('2026-05-15T03:00:00+00') = '2026-05-14' ✗ (previous day!)
--
-- Solution:
-- 1. Add expense_date DATE column (timezone-naive, stores exact day)
-- 2. Trigger auto-populates expense_date from date TIMESTAMPTZ using Brazil TZ
-- 3. Frontend sends expense_date with pure 'YYYY-MM-DD' string
-- 4. Keep date column for audit (stores UTC timestamp of insertion)
-- ============================================================

-- Step 1: Add expense_date column (DATE type - no timezone)
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS expense_date DATE;

-- Step 2: Create trigger function to auto-set expense_date from date
CREATE OR REPLACE FUNCTION public.set_expense_date_from_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set expense_date if NOT explicitly provided by frontend
    -- This preserves correct expense_date while backfilling old records
    IF NEW.expense_date IS NULL THEN
        IF NEW.date IS NOT NULL THEN
            -- Calculate from date TIMESTAMPTZ using Brazil timezone
            NEW.expense_date := (NEW.date AT TIME ZONE 'America/Sao_Paulo')::DATE;
        ELSE
            -- Default to current date in Brazil timezone when no date provided
            NEW.expense_date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
        END IF;
    END IF;
    -- If expense_date WAS provided (by frontend or existing record), preserve it
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger (fires on INSERT and UPDATE for expense/recurring)
DROP TRIGGER IF EXISTS trg_set_expense_date ON public.transactions;
CREATE TRIGGER trg_set_expense_date
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    WHEN (NEW.type = 'expense' OR NEW.type = 'recurring')
    EXECUTE FUNCTION public.set_expense_date_from_timestamp();

-- Step 4: Backfill expense_date for existing expense/recurring records
UPDATE public.transactions
SET expense_date = (date AT TIME ZONE 'America/Sao_Paulo')::DATE
WHERE expense_date IS NULL
  AND date IS NOT NULL
  AND (type = 'expense' OR type = 'recurring');

-- Step 5: Add comment
COMMENT ON COLUMN public.transactions.expense_date IS
'Date-only (YYYY-MM-DD) for expense/revenue transactions. Avoids TIMESTAMPTZ timezone issues. Auto-populated via trigger from date column using Brazil/Sao_Paulo timezone.';

-- Step 6: Add index for date queries (reports, dashboards)
CREATE INDEX IF NOT EXISTS idx_transactions_expense_date
    ON public.transactions(expense_date DESC)
    WHERE expense_date IS NOT NULL;

-- Step 7: Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- FRONTEND CHANGES REQUIRED:
--
-- 1. pages/Expenses.tsx - normalizeDateForDb changed:
--
-- OLD (problematic):
-- const normalizeDateForDb = (value: string) => {
--     if (!value) return new Date().toISOString();
--     return value.includes('T') ? value : new Date(`${value}T00:00:00`).toISOString();
-- };
--
-- const payload = {
--     date: normalizeDateForDb(formData.date),
--     ...
-- };
--
-- NEW (correct):
-- const normalizeDateForDb = (value: string) => {
--     if (!value) return null;
--     return value;  // Already in 'YYYY-MM-DD' format from DatePickerInput
-- };
--
-- const payload = {
--     expense_date: normalizeDateForDb(formData.date),
--     date: new Date().toISOString(),
--     ...
-- };
--
-- 2. src/hooks/useRecurringBills.ts - markAsPaid updated:
-- UPDATE { status: 'paid', expense_date: today, date: new Date().toISOString() }
--
-- ============================================================
