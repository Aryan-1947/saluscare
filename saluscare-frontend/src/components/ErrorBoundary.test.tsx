import { describe, expect, it, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(cleanup);

// ErrorBoundary logs the caught error; silence it for clean test output.
vi.spyOn(console, "error").mockImplementation(() => {});

function Bomb({ errorMessage }: { errorMessage: string }): ReactNode {
  throw new Error(errorMessage);
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows the generic fallback for a normal error with a Try again button", () => {
    render(
      <ErrorBoundary>
        <Bomb errorMessage="boom" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("shows the chunk-load fallback when a lazy chunk fails", () => {
    render(
      <ErrorBoundary>
        <Bomb errorMessage="Failed to fetch dynamically imported module: https://app/assets/x.js" />
      </ErrorBoundary>
    );
    expect(screen.getByText("A new version is available")).toBeInTheDocument();
    expect(screen.getByText("Reload")).toBeInTheDocument();
  });

  it("Try again resets the boundary and re-renders children", () => {
    let shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary>
        {shouldThrow ? <Bomb errorMessage="boom" /> : <p>recovered</p>}
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Parent supplies fixed content first (like a chunk-load recovery), then
    // the user resets the boundary via the button.
    shouldThrow = false;
    rerender(
      <ErrorBoundary>
        {shouldThrow ? <Bomb errorMessage="boom" /> : <p>recovered</p>}
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("recovered")).toBeInTheDocument();
  });
});
