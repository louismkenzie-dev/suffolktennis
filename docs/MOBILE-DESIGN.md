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
