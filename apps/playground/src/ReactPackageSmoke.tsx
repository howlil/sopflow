import { useMemo, useState } from "react";
import { buildDiagram } from "@sopflow/diagram";
import { SopUnifiedWorkspace } from "@sopflow/react";
import "@sopflow/react/styles.css";
import {
  demoDocument,
  demoHeader,
  isValidationScenario,
  validationDocument,
  validationHeader,
} from "./demoFixtures.js";

/**
 * Default playground is ready-to-use. Visit ?scenario=issues to exercise
 * Problems → exact field navigation with a missing input and header list.
 */
export function ReactPackageSmoke() {
  const [document, setDocument] = useState(() =>
    isValidationScenario(window.location.search)
      ? validationDocument
      : demoDocument,
  );
  const [header, setHeader] = useState(() =>
    isValidationScenario(window.location.search) ? validationHeader : demoHeader,
  );

  const diagramError = useMemo(() => {
    try {
      buildDiagram(document);
      return null;
    } catch (cause) {
      return cause instanceof Error
        ? cause.message
        : "Diagram tidak dapat dibangun karena kesalahan yang tidak diketahui.";
    }
  }, [document]);

  return (
    <section
      className="h-full min-h-0 w-full overflow-hidden print:h-auto print:overflow-visible"
      aria-label="Playground SOP"
    >
      <SopUnifiedWorkspace
        value={document}
        onChange={setDocument}
        header={header}
        onHeaderChange={setHeader}
        error={diagramError}
      />
    </section>
  );
}
