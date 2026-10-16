# Official UIArc source — SOPFlow

Upstream official MIT repository: https://github.com/kuratlielia/arc-library.
All vendored TSX/CSS Modules in `packages/react/src/components/arc` originated from the official registry. The MIT license remains in `packages/react/src/components/arc/LICENSE`; the official Motion tokens are in `components/arc/lib/motion-tokens.ts`.

## Integration contracts
- Official Arc Button, Input, Textarea, Select, MultiSelect, DropdownMenu, Dialog, Tooltip and Alert render interactive generic controls. SOPFlow retains only thin callbacks/props and domain adapters.
- Arc Accordion and SegmentedControl are vendored but unused where their semantics conflict with always-expanded inspector sections or diagram tabs with disabled states.
- Exported SOPFlow `Button` and `Select` public APIs are preserved. The native Select export is legacy compatibility only, not an internally preferred component.
- Import paths use `.js` NodeNext extensions where required by the package. `motion`, Radix and Lucide versions are pinned through `pnpm-lock.yaml`.
- Scope Arc tokens to `[data-sopflow-root]`; portaled dialogs, selects and tooltips carry this data attribute. Never import a global `:root` Arc stylesheet in a published component package.
- Arc Motion owns control interactions; no custom animation timing duplicated in SOPFlow domain modules. Reduced-motion remains supported.
- Upstream compatibility adaptations: compact labelled field rendering (without duplicate FormField label), safe ResizeObserver absence, React exact optional props, disabled tap gesture behavior, and SOPFlow dialog focus semantics. Do not remove those without corresponding regression proof.

The dependency graph is `Host → SopWorkspace → SopEditor → Arc UI adapter → official primitive → Motion/Radix`, with mutations independently handled by `@sopflow/core`.

Implementation graph, detailed status and outstanding release gates: [design-graph-uiarc-migration.md](design-graph-uiarc-migration.md).
