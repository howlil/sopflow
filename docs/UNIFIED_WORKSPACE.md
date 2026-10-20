# Unified SOP workspace

The `SopUnifiedWorkspace` component is an **opt-in** shell shipped by `@sopflow/react`. It reuses `SopWorkspace`, the existing diagram engine, A4 document pagination, and the SOP header and steps editors.

```tsx
import { SopUnifiedWorkspace } from "@sopflow/react";
import "@sopflow/react/styles.css";

<SopUnifiedWorkspace
  value={document}
  onChange={setDocument}
  header={header}
  onHeaderChange={setHeader}
  error={diagramError}
/>;
```

The host owns semantic document persistence. The shell manages the active Flowchart/BPMN/Steps view, route editing, viewport-only zoom, inspector sizing and visibility, and an expandable Problems footer. Its readiness issues derive from SOPFlow validation and cannot be dismissed by collapsing Problems. Navigation takes header issues to the corresponding field and step issues to the step editor.

The top bar stays outside the A4 paper; browser print resets preview zoom and hides shell chrome. To preserve legacy integrations, consumers of `SopWorkspace` and `SopEditor` retain their original toolbar and 100% zoom unless opting into the new APIs.

## Release and consumer contract

- **Do not** alias playground imports to local `packages/*/src`; `apps/playground` must use the published registry package.
- Publish the React package version containing these APIs via the Changesets/version-PR workflow, then update playground's explicit `npmjs:` pin and `pnpm-lock.yaml` together.
- Before publishing, run `pnpm check`, the package-packing metadata gate, and browser diagram/OPC regressions.
- After consumer integration, perform a browser smoke for mode transitions, Problems navigation, Fit/zoom, compact inspector and print A4 geometry on the npm package. Treat screenshot and PDF artifacts as evidence, **not** as passing pixel-golden tests unless explicit assertions are added.
