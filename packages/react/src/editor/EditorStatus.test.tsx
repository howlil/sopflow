import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EditorStatus } from "./EditorStatus.js";

describe("EditorStatus", () => {
  it("lets the user dismiss an error until it changes or recovers", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EditorStatus error="Graph gagal dibuat" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Graph gagal dibuat");

    await user.click(screen.getByRole("button", { name: "Tutup pesan error" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<EditorStatus error="Graph gagal dibuat" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<EditorStatus error="Graph berubah dan gagal dibuat" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Graph berubah dan gagal dibuat",
    );

    rerender(<EditorStatus error={null} />);
    rerender(<EditorStatus error="Graph gagal dibuat" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Graph gagal dibuat");
  });
});
