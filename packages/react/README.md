# @sopflow/react

React primitives and default compositions for editing and presenting a `SOPDocument`.

## Package boundary

The package owns reusable SOP presentation and editing behavior. It does not own application concerns such as routing, backend requests, autosave scheduling, approval workflow, role permissions, comments, version history, or application workbench state.

## Default editor

`SopEditor` provides a convenient controlled composition:

```tsx
<SopEditor
  value={document}
  onChange={setDocument}
  header={header}
  onHeaderChange={setHeader}
/>
```

The default desktop layout uses an A4 document surface and a contextual property inspector:

```text
A4 document (210mm) | inspector (A4 / 3)
```

The A4 surface is presentation-first. Header and procedure values render as document content; editing controls live in the inspector.

When no procedure row is selected, the inspector edits document metadata and actors. Selecting a row switches the inspector to that step.

The inspector width is a presentation default, not a domain contract. Consumers can override it:

```css
.my-editor {
  --sopflow-inspector-width: 320px;
}
```

## Composable primitives

Consumers that own their own layout can compose the lower-level exports directly:

```tsx
<SopHeaderView document={document} header={header} />

<SopProcedureView
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

The important boundary is:

```text
SopHeaderView     = header presentation only
SopProcedureView  = procedure presentation + selection only
SopHeaderFields   = controlled header editing
SopStepFields     = controlled selected-step editing
ActorsEditor      = controlled actor operations
```

Application code decides where those primitives live and what other panels or workflow controls surround them.

## Styles

Import the package stylesheet once in the consumer application:

```ts
import "@sopflow/react/styles.css";
```

The high-level components establish the Sopflow token root. When composing lower-level primitives directly, place them under an element with `data-sopflow-root` so the same CSS token contract applies.
