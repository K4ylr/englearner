// Youdao free dictionary audio CDN — no API key required.
// type=0 is US English, type=1 is UK English.

export function youdaoAudio(
  word: string,
  variant: "us" | "uk" = "us"
): string {
  const type = variant === "uk" ? 1 : 0;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
    word
  )}&type=${type}`;
}
