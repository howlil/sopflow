import { DiagramRegressionSmoke } from "./DiagramRegressionSmoke.js";
import { ReactPackageSmoke } from "./ReactPackageSmoke.js";
import { UnifiedConsumerRegression } from "./UnifiedConsumerRegression.js";

function App() {
  const diagramRegression = new URLSearchParams(window.location.search).has(
    "diagram-regression",
  );

  if (diagramRegression) {
    return <DiagramRegressionSmoke />;
  }

  if (new URLSearchParams(window.location.search).has("unified-regression")) {
    return <UnifiedConsumerRegression />;
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-surface">
      <ReactPackageSmoke />
    </main>
  );
}

export { App };
