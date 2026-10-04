"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserDialer } from "./browser-dialer";
import { browserDependencies } from "./voice-sdk-adapter";

export function useBrowserDialer() {
  const controller = useRef<BrowserDialer | null>(null);
  const [snapshot, setSnapshot] = useState(() => new BrowserDialer(browserDependencies).snapshot);
  useEffect(() => {
    // A fresh controller per effect also handles React StrictMode remounts.
    const dialer = new BrowserDialer(browserDependencies);
    controller.current = dialer;
    const unsubscribe = dialer.subscribe(() => setSnapshot(dialer.snapshot));
    void dialer.recover();
    const interrupt = () => dialer.interrupt();
    const visibility = () => { if (document.visibilityState !== "visible") interrupt(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dialer.snapshot.locked) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("offline", interrupt);
    window.addEventListener("pagehide", interrupt);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      unsubscribe(); dialer.dispose(); controller.current = null;
      window.removeEventListener("offline", interrupt);
      window.removeEventListener("pagehide", interrupt);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return { snapshot, controller };
}
