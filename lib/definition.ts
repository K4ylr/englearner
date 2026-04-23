// Tidy ECDICT-style definitions for display. Raw entries look like:
//   "v.&vi.是，在，做\n[计] 四位字节\n[医] 比特"
// where "\n" is the literal two-character escape sequence (a backslash plus an
// 'n'), and leading "[xx]" tags mark subject fields (计=computing, 医=medical,
// 化=chem, 物=physics, etc.). We split on the escape, trim whitespace, drop
// empties, and surface the tag as a separate label so the UI can render it as
// a small badge.

export type DefinitionSense = {
  tag: string | null;
  text: string;
};

const TAG_RE = /^\[([^\]]+)\]\s*/;

export function parseDefinition(raw: string | null | undefined): DefinitionSense[] {
  if (!raw) return [];
  // The seed data contains the literal backslash-n sequence, not a real \n.
  // Normalise both just in case.
  const unescaped = raw.replace(/\\n/g, "\n");
  return unescaped
    .split(/[\n;；]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const m = line.match(TAG_RE);
      if (m) {
        return { tag: m[1].trim(), text: line.slice(m[0].length).trim() };
      }
      return { tag: null, text: line };
    })
    .filter((s) => s.text.length > 0);
}

// One-line flat form, for places where we can't afford vertical space.
export function flattenDefinition(raw: string | null | undefined): string {
  const senses = parseDefinition(raw);
  if (senses.length === 0) return "";
  return senses
    .map((s) => (s.tag ? `[${s.tag}] ${s.text}` : s.text))
    .join("；");
}
