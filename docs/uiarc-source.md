# UIArc source integration and design graph

Official source: https://github.com/kuratlielia/arc-library (MIT).
Original Button and CSS Module are copied, with only the internal motion-token import adjusted. The exact upstream motion presets live under `components/arc/lib`.
The public SOPFlow Button is a thin backward-compatible adapter.
Current slice migrates the button primitive; the remaining planned UIArc-native select, textarea, dialog, tooltip and segmented controls require verified API adapters and dependency support.

`Host → SopWorkspace → SopEditor → Button/Editor controls → official Arc primitive → Arc Motion`

Domain operations and graph projection still go to `@sopflow/core` and `@sopflow/diagram`; no UIArc logic enters those packages. The workbook's toolbar, inspector, document and graph projections keep their current layout and semantics. Scoped tokens under `data-sopflow-root` avoid changing host app styles.

## Design-graph verification

Job → Flow → Surface<C,V,N> → Moves → Environment → Proof.

For button interactions: the SOP document remains canonical; button actions
call existing SOPFlow handlers; Arc handles hover/press/label motion; focus,
disabled and reduced-motion states require DOM-level tests. UI changes cannot
alter authored steps, formal workflow projection, or A4 output.

## Dependency and compiler compatibility

Motion is installed as a direct runtime dependency in `@sopflow/react`, with
`pnpm-lock.yaml` resolved by pnpm in CI and committed. Official source requires
two build-target adaptations: the relative JS import extension for NodeNext,
and an empty `whileTap` animation when the button must not scale. Other
upstream behavior and its MIT attribution remain intact.
