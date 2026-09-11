# Mobile design system (Parent, Coach, Admin)

The signed-in product is designed phone-first and shares one shell and one set
of primitives. Everything lives in `src/components/app/`.

## Shell
- `AppShell` — 56px top bar (mark · section title · account), page, and on
  phones a bottom tab bar with up to four destinations plus **More** (a sheet
  with the rest, the Parent/Coach/Admin view switcher and sign out). On
  desktop the same bar shows the wordmark, a horizontal section nav and the
  view switcher. Sections are deep-linkable with `?tab=`.
- `FlowShell` — standalone flows (booking, ticket, scanner): a back link and
  the mark, no navigation.

## Surfaces and tokens
- `.app-shell` scopes the calmer palette: off-white page, white surfaces,
  hairline borders, one restrained shadow, sentence-case headings. Dialogs,
  alert dialogs and selects carry the class themselves because they portal
  out of the tree.
- Suffolk blue is reserved for the active tab, the primary action, selection
  and the odd highlight. Status uses `StatusBadge` tones.

## Primitives
`PageHeader`, `Section`, `ListGroup` + `ListRow`, `Avatar`, `SegmentedControl`,
`SearchField`, `Chip`/`ChipRow`, `FilterButton` + `FilterSheet`, `StatusBadge`
(+ `bookingStatus`), `EmptyState`, `SkeletonRows`/`SkeletonCards`/`SkeletonBlock`,
`KeyValueList`, `IdentityHeader`, `Field`, `FormGroup`, `ActionBar`, `InlineNote`,
`FormListLayout` (desktop: editor beside the list; phone: list first, editor in
a sheet).

## Rules of thumb
- Tables stay on `md+`; phones get rows (`ListRow`) with the important facts and
  a chevron. Detail lives in a sheet, not in extra columns.
- `Dialog` is a bottom sheet below `md` and a centred modal above — the same
  JSX works for both.
- Controls are 44px on phones (buttons, inputs, selects, chips), 40px from `md`.
- Motion is 150–250ms and honours `prefers-reduced-motion`.
- Loading = skeletons that match the content; empty = `EmptyState` with a
  sentence about what will appear there.

## Admin navigation (regrouped 11 Sep 2026)

Thirteen top-level tabs wrapped to two lines on a laptop, so the Admin Hub
now has five sections grouped by the job in hand, plus the Scanner link:

| Section  | Pages (second-level strip)                                    |
| -------- | ------------------------------------------------------------- |
| Bookings | programmes, events, invitations, payments                     |
| People   | Children · Parents · Player database · Coaches · Admins       |
| Progress | Reports · Goals                                               |
| Website  | Events page · News · Player Watch · Venues                    |
| Email    | campaigns                                                     |

The second level renders through AppShell's `subheader` slot: a
`SegmentedControl` on desktop (one group, one selected — the Apple/Airbnb
pattern) and a scrolling `Chip` row on phones. It is sticky with the header,
so the strip stays in reach while a long list scrolls. People carries one
search box: in that strip from md up, and at the top of the page body on
phones so the sticky header never passes ~110px. The query follows the admin
across its five pages, so "Hatch" typed under Children still filters Parents
and the player database when they switch.

The section is labelled Progress, not Coaching: the view switcher already has
a Coach pill and the staff list lives under People > Coaches, so three
Coach-ish words in one header would send an admin to the wrong place. Each section remembers its last page, and the URL
is `/admin?tab=<section>&view=<page>`; the old `?tab=families` style links
still resolve (see `LEGACY_TABS` in `src/pages/AdminHub.tsx`).
