-- The only list a campaign send should ever read from. Anyone who has
-- unsubscribed is excluded here, so a future send physically cannot include
-- them even if someone writes the recipient query by hand.
-- Each row carries that address's own unsubscribe token for substitution
-- into its copy of the email.
CREATE OR REPLACE VIEW public.campaign_recipients AS
SELECT p.email, p.unsub_token
FROM public.email_preferences p
WHERE p.unsubscribed_at IS NULL;

REVOKE ALL ON public.campaign_recipients FROM anon, authenticated;
GRANT SELECT ON public.campaign_recipients TO service_role;
