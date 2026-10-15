# UIArc source integration and design graph

Official source: https://github.com/kuratlielia/arc-library (MIT).
Original Button and CSS Module are copied, with only the internal motion-token import adjusted. The exact upstream motion presets live under `components/arc/lib`.
The public SOPFlow Button is a thin backward-compatible adapter.
Current slice migrates the button primitive; the remaining planned UIArc-native select, textarea, dialog, tooltip and segmented controls require verified API adapters and dependency support.

`Host → SopWorkspace → SopEditor → Button/Editor controls → official Arc primitive → Arc Motion`

Domain operations and graph projection still go to `@sopflow/core` and `@sopflow/diagram`; no UIArc logic enters those packages. The workbook's toolbar, inspector, document and graph projections keep their current layout and semantics. Scoped tokens under `data-sopflow-root` avoid changing host app styles.
