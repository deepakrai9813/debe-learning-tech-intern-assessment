"use client";

import { useEffect, useState } from "react";

/**
 * True only after the component has hydrated in the browser.
 *
 * Session times are rendered in the PARENT's local timezone, which the Node.js
 * server cannot know (it formats dates in its own locale/timezone — e.g. UTC
 * or en-US). Rendering timezone-dependent output during SSR would cause a
 * hydration mismatch: the server HTML would show one time, the client another,
 * React would regenerate the tree, and the user would see a flash of the wrong
 * time. Deferring time formatting until after mount keeps SSR output
 * timezone-agnostic (placeholders) and renders real local times only in the
 * browser. See SessionCard / SessionWidget.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
