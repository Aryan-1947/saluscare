import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render/lifecycle errors anywhere below the router and shows a
 * recoverable fallback instead of a white screen. Also used at each lazy
 * route so a failed chunk load (e.g. after a deploy invalidates old hashes)
 * offers a reload instead of an endless spinner.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Hook a reporting service (Sentry etc.) in here later.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      const isChunkError =
        this.state.error.name === "ChunkLoadError" ||
        /dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i.test(
          this.state.error.message
        );

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
          <p className="text-5xl font-bold gradient-text mb-3">{isChunkError ? "Update" : "Oops"}</p>
          <h1 className="text-lg font-semibold text-[#0F172A] dark:text-white mb-1.5">
            {isChunkError ? "A new version is available" : "Something went wrong"}
          </h1>
          <p className="text-sm text-[#64748B] dark:text-neutral-400 mb-6 max-w-sm">
            {isChunkError
              ? "The page was updated while you were away. Reload to get the latest version."
              : "An unexpected error occurred while rendering this page."}
          </p>
          <button
            onClick={() => (isChunkError ? window.location.reload() : this.setState({ error: null }))}
            className="rounded-[10px] bg-[#0F172A] dark:bg-[#0EA5A4] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {isChunkError ? "Reload" : "Try again"}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
