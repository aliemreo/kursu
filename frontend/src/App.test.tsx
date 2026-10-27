import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the title and the backend status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<App />);

    expect(screen.getByRole("heading", { name: "Kürsü" })).toBeTruthy();
    expect(await screen.findByText("Sunucu çalışıyor")).toBeTruthy();
  });
});
