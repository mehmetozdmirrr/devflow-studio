import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ErrorBoundary } from "../components/ErrorBoundary";

let shouldThrow = true;

function Bomb() {
  if (shouldThrow) {
    throw new Error("boom");
  }
  return <div>Recovered content</div>;
}

describe("ErrorBoundary", () => {
  it("renders an accessible error state instead of crashing", () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("recovers when retry is pressed after the error condition clears", async () => {
    const user = userEvent.setup();
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    shouldThrow = false;
    await user.click(screen.getByText("Try again"));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });
});
