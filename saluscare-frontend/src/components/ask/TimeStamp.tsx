/** WhatsApp-style little timestamp under a chat bubble. Renders nothing for
 * turns loaded from session history, which carry no trusted timestamp. */
export function TimeStamp({
  at,
  tone = "light",
}: {
  at?: Date | null;
  /** "dark" = sits on the near-black user bubble, "light" = on white cards. */
  tone?: "light" | "dark";
}) {
  if (!at) return null;
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      className={`mt-0.5 text-right text-[10px] leading-none ${
        tone === "dark"
          ? "text-white/55 dark:text-[#1A1613]/55"
          : "text-[#A8A29E] dark:text-[#78716C]"
      }`}
    >
      {time}
    </div>
  );
}
