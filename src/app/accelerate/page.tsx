"use client";

import AccelerateApp from "@/components/AccelerateApp";
import { fixGroupNames } from "@/data/name-fix";
import { PRELOADED } from "@/data/preloaded-data";

if (PRELOADED?.groups) {
  PRELOADED.groups = fixGroupNames(PRELOADED.groups);
}

export default function AcceleratePage() {
  return <AccelerateApp />;
}
