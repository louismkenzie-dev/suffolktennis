-- Pre-launch wall for the booking system.
--
-- The Stripe integration is still running on sandbox (test) keys, so while
-- the county announcement drives traffic to the site nobody should be able to
-- reach a payment form. create-booking-checkout refuses to create a
-- PaymentIntent or subscription unless this reads 'open', and the booking page
-- shows a "booking opens soon" panel instead of the checkout.
--
-- Go live with:
--   update public.app_settings set value = 'open', updated_at = now()
--   where key = 'bookings_status';
INSERT INTO public.app_settings (key, value)
VALUES ('bookings_status', 'coming_soon')
ON CONFLICT (key) DO NOTHING;
