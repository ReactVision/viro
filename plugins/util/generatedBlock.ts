const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const markerPattern = (tag: string, comment: string) =>
  new RegExp(
    `^[ \\t]*${escapeRegExp(comment)} @generated begin ${escapeRegExp(tag)}\\b[^\\n]*\\n[\\s\\S]*?^[ \\t]*${escapeRegExp(
      comment
    )} @generated end ${escapeRegExp(tag)}\\b[^\\n]*(?:\\n|$)`,
    "gm"
  );

/**
 * Wraps `body` in begin/end marker comments so a later run can find the block
 * and replace it instead of appending a second copy.
 */
export function wrapGeneratedBlock(tag: string, body: string, comment = "#", indent = ""): string {
  return (
    `${indent}${comment} @generated begin ${tag} - managed by @reactvision/react-viro\n` +
    `${body}\n` +
    `${indent}${comment} @generated end ${tag}`
  );
}

/** Removes every marked block with this tag. */
export function removeGeneratedBlock(contents: string, tag: string, comment = "#"): string {
  return contents.replace(markerPattern(tag, comment), "");
}
