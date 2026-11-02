/* The document editor runs in /playground/. Marketing JavaScript only supports copy. */
(() => {
  const button = document.getElementById("copyCode");
  const code = document.getElementById("codeSnippet");
  if (!button || !code) return;

  let resetTimer;
  button.addEventListener("click", async () => {
    const snippet = code.textContent.trim();
    try {
      await navigator.clipboard.writeText(snippet);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy unavailable";
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { button.textContent = "Copy"; }, 1600);
  });
})();
