"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readStoredMode } from "./study-mode-selector";

// Tiny client-only helper: if the user lands on /study with no ?mode=
// param, check localStorage for the mode they used last time and rewrite
// the URL. Does nothing if they had "recognize" last time (that's the
// default, no redirect needed).
export function StoredModeRedirect() {
  const router = useRouter();
  useEffect(() => {
    const saved = readStoredMode();
    if (saved !== "recognize") {
      router.replace(`/study?mode=${saved}`);
    }
  }, [router]);
  return null;
}
