"use client";
import type { RefObject } from "react";
import type { BrowserDialer } from "./browser-dialer";
import { filterControl } from "@/components/leads/organizer-select";
const labels: Record<string, string> = {
  recovering: "Checking previous call…", review: "Review mode — browser audio not prepared", ready: "Browser audio prepared",
  dialing: "Connecting browser — recipient not yet confirmed", ringing: "Recipient ringing", connected: "Recipient connected",
  reconciling: "Reconciling — queue held until server confirmation", wrapup: "Call settled by server — complete your wrap-up",
};
export function BrowserCallControls({ voice, controller, disabled }: { voice: BrowserDialer["snapshot"]; controller: RefObject<BrowserDialer | null>; disabled: boolean }) {
  const button = filterControl + " min-h-[48px]";
  return <section aria-label="Browser calling" className="min-w-0 space-y-3 rounded-xl border border-border bg-surface p-4">
    <p aria-live="polite">{labels[voice.phase]}</p>
    {voice.pollingPaused && voice.locked && <p className="text-sm">Automatic status checks paused after the bounded check window. Use Check server status; this never redials or releases a hold without server proof.</p>}
    {voice.error && <p role="alert">{voice.error}</p>}
    {!voice.locked && <>
      <p className="text-sm">Keep this HTTPS page open in Android Chrome. Allow microphone access; check audio volume. Screen lock, app switching and cellular calls can interrupt audio. No automatic redial.</p>
      <button className={button} disabled={disabled || voice.preparing} onClick={() => void controller.current?.prepare()}>{voice.preparing ? "Preparing microphone…" : "Prepare browser calling"}</button>
    </>}
    {voice.locked && <>
      <p className="text-sm">Lead, list and caller ID are held. Browser disconnect does not end the server call. If this is a recovered call, audio cannot be reattached; wait for completion, then check server status. Do not start another call.</p>
      <button className={button} disabled={voice.checking} onClick={() => void controller.current?.reconcile()}>Check server status</button>
      {voice.phase === "wrapup" && <button className={button} disabled={disabled} onClick={() => controller.current?.wrapUp()}>Complete wrap-up</button>}
    </>}
    {voice.locked && !voice.hasCall && voice.phase === "dialing" && <button className={button + " border-red-600 text-red-700"} onClick={() => controller.current?.hangUp()}>Hang up</button>}
    {voice.hasCall && <div className="sticky bottom-2 z-10 space-y-3 rounded-xl border border-border bg-surface p-3">
      <div className="grid grid-cols-2 gap-3">
        <button className={button} aria-pressed={voice.muted} onClick={() => controller.current?.mute()}>{voice.muted ? "Unmute" : "Mute"}</button>
        <button className={button + " border-red-600 text-red-700"} onClick={() => controller.current?.hangUp()}>Hang up</button>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="Touch tone keypad">
        {"123456789*0#".split("").map(digit => <button key={digit} className={button} aria-label={`DTMF ${digit}`} onClick={() => controller.current?.digits(digit)}>{digit}</button>)}
      </div>
    </div>}
    <p className="text-sm">Recording off. Calling requires server authorization.</p>
  </section>;
}
