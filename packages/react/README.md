# @sopflow/react

React primitives and default compositions for editing and presenting a `SOPDocument`.

## Package boundary

The package owns reusable SOP presentation and editing behavior. It does not own routing, backend requests, autosave scheduling, approval workflow, role permissions, comments, version history, or other application state.

## Default editor

`SopEditor` provides a controlled convenience composition:

```tsx
<SopEditor
  value={document}
  onChange={setDocument}
  header={header}
  onHeaderChange={setHeader}
/>
```

Desktop defaults to:

```text
A4 document (210mm) | property inspector (A4 / 3)
```

The inspector is intentionally limited to header metadata and actors.

The document owns procedure interaction:

```text
SOP header

[ Langkah / Diagram ] [ Edit Manual ] | [ Flowchart | BPMN ]

preview:
formal SOP-AP flowchart matrix with path overlay
or BPMN lanes

Langkah mode:
inline procedure spreadsheet editor
```

`Langkah` replaces the diagram preview with the inline procedure editor. It does not open a step editor in the inspector.

`Edit Manual` edits flowchart paths on the formal SOP-AP preview. Manual path state is presentation state, not part of `SOPDocument`.

The default editor does not expose undo/redo or zoom controls.

The inspector width is a presentation default and can be overridden:

```css
.my-editor {
  --sopflow-inspector-width: 320px;
}
```

## Composable primitives

Consumers can build another composition from the lower-level exports:

```tsx
<SopHeaderView document={document} header={header} />

<SopProcedureView
  document={document}
  selectedStepId={selectedStepId}
  onSelectedStepChange={setSelectedStepId}
/>

<SopBpmn
  document={document}
  selectedStepId={selectedStepId}
  onSelectedStepChange={setSelectedStepId}
/>

<SopHeaderFields
  document={document}
  header={header}
  onDocumentChange={setDocument}
  onHeaderChange={setHeader}
/>

<SopStepFields
  document={document}
  stepId={selectedStepId}
  onOperation={applyOperation}
  onOperations={applyOperations}
/>

<ActorsEditor
  document={document}
  onOperation={applyOperation}
  onOperations={applyOperations}
/>
```

Relevant boundaries:

```text
SopHeaderView     header presentation
SopProcedureView  formal SOP-AP flowchart matrix + path overlay
SopBpmn           BPMN presentation
SopHeaderFields   controlled header editing
SopStepFields     optional standalone step-fields primitive
ActorsEditor      controlled actor operations
```

`SopStepFields` remains available for consumers that want a custom master-detail layout, but it is not used by the default Sopflow workbench.

The existing `SopDiagram` and `SopFlowchart` exports remain available as lower-level/alternate diagram primitives for compatibility.

## Styles

Import the stylesheet once:

```ts
import "@sopflow/react/styles.css";
```

When composing lower-level primitives directly, place them under an element with `data-sopflow-root` so the token contract applies.
