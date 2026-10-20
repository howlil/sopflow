# SOPFlow React UI

## Intent
A compact, neutral, spreadsheet-like SOP editor with predictable in-place forms,
modals and floating menus. The A4 document and BPMN geometry remain formal,
unmodified projections of the same SOP document.

## Hierarchy / density
- Single-row fields: 36px; dense input radius 10px.
- Menus: 14px rounded surface; menu rows 32–36px with 8px radius.
- Dialogs: 16px surface, three explicit regions (header/body/footer), no nested
  vertical padding; prefer content-height over fixed heights.
- Actors: title + action first; short explanatory copy must not squeeze inputs.
- Primary/secondary action buttons can remain pill; icon actions circular.
- Use existing Plus Jakarta Sans styling where available, but do not inject
  global host typography from the library.

## Floating layers
Portals have their own `data-sopflow-root` token context, escape scroll clipping,
and must remain visible within the browser viewport. Focus returns to the
invoking trigger after dismissing a modal/menu.

## Avoid
- 9999px radius on popup panels/options.
- Popover option truncation/wrapping caused solely by a narrow trigger.
- Duplicate header/body/footer padding.
- Component-local positioning patches for shared dropdowns.
- Shadows or gradients on standard input/inline metadata.
- Changing document print layout or domain operations to solve UI spacing.
