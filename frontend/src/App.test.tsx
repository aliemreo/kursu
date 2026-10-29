import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "./App";
import { AuthProvider } from "./features/auth/AuthContext";

describe("App", () => {
  it("redirects a signed-out user to the login page", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Giriş yap" })).toBeInTheDocument();
  });
});
