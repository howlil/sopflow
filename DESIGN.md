# Sopflow Playground Design

## Direction

The playground is a compact route workbench for developers inspecting a typed
workflow. It should feel like a working technical artifact: the graph is the
hero, step records are scannable, and validation reads as evidence rather than
as a decorative status card.

## Surface contract

- First viewport: document identity, route projection, and step records are
  visible without opening a menu.
- Primary move: select a route node, inspect its incoming/outgoing edges, and
  change a core operation.
- Secondary moves: run JSON operations, parse/export a document, inspect
  validation evidence, undo, redo, and reset.
- Invalid states stay visible and explain the failed core constraint.
- The same information survives narrow layouts by stacking the rail, route,
  records, diagnostics, and inspector.

## Visual grammar

- Paper surfaces and navy ink reference route cards and engineering workbenches.
- Vermilion marks the active operation; yellow marks health and attention.
- Rules, spacing, and typography provide structure; elevation is intentionally
  quiet and never used to turn every section into a floating card.
- IBM Plex Mono is reserved for identifiers, diagnostics, and measurements.
- IBM Plex Sans carries titles and controls.
- The graph projection is a horizontal route with explicit terminal treatment;
  it is not a metric dashboard.
- Lower tools share one ruled workspace so validation, operations, and document
  JSON read as supporting instruments rather than unrelated cards.

## States

The surface names ready, invalid, selected, disabled, empty inspector, malformed
JSON, draft batch, and strict batch outcomes. Focus rings remain visible and
reduced motion disables transitions.
