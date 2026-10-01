/**
 * Visible "being listened to" feedback for voice dictation: an animated
 * equalizer pill shown above the chat input while the microphone is active.
 */
export function ListeningIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-2 flex items-center gap-2.5 px-3 py-1.5 rounded-[8px] bg-[#FFF3EA] dark:bg-[#EA580C]/10 border border-[#EA580C]/25 w-fit"
    >
      <span className="flex items-end gap-[3px] h-3.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="eq-bar w-[3px] h-full rounded-full bg-[#EA580C]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-[#EA580C]">Listening&hellip;</span>
    </div>
  );
}
