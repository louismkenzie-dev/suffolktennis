-- Bookings are open site-wide.
--
-- `bookings_status` was a pre-launch wall from the period when Stripe ran on
-- sandbox keys: create-booking-checkout refused to create a PaymentIntent and
-- the booking page showed a "booking opens soon" panel unless it read 'open'.
-- Stripe is live (app_settings.payments_mode = 'live', end-to-end verified
-- 10 Sep 2026), so the wall is gone from the code and nothing reads this key
-- any more.
--
-- The row is set to 'open' rather than deleted so that any edge function still
-- running the old build during the deploy lets bookings through instead of
-- failing closed. It can be dropped once every function is redeployed.
UPDATE public.app_settings
SET value = 'open', updated_at = now()
WHERE key = 'bookings_status';
