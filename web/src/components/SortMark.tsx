/** Authored sort chevrons, one 1.5px stroke: up, down, or both (unsorted). */
export function SortMark({ dir }: { dir?: "ascending" | "descending" }) {
  return (
    <svg className="sort-mark" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" focusable="false">
      <path d="M2 5.5 5 2.5 8 5.5" className={dir === "descending" ? "off" : ""} />
      <path d="M2 8.5 5 11.5 8 8.5" className={dir === "ascending" ? "off" : ""} />
    </svg>
  );
}
