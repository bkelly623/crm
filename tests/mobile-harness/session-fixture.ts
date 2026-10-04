// Browser-only synthetic session, never imported by application source.
import { lead } from './server';
import type { VoiceCall } from '../../src/components/dialer/browser-dialer';
export const enabled = new URLSearchParams(location.search).get('scenario') === 'sequential';
let posts = 0;
let settled = false;
let call: VoiceCall | undefined;
let listeners: Record<string, () => void> = {};
export const fixture = {
 get posts() { return posts; },
 finish() { settled = true; listeners.disconnect?.(); },
};
if (enabled) Object.assign(window, { syntheticSession: fixture });
export async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response | undefined> {
 if (!enabled) return;
 const url = String(input);
 if (url.includes('/api/twilio/token')) return Response.json({ token: 'synthetic-not-a-real-token' });
 if (url.includes('/api/lead-organizers/lists')) return Response.json({items:[{id:'synthetic-list',name:'SYNTHETIC two-lead list'}],nextCursor:null});
 if (url.includes('/api/dialer/next-lead')) {
  const excludes = new URL(url,location.origin).searchParams.getAll('exclude');
  const id = ['synthetic-one','synthetic-two'].find(id=>!excludes.includes(id));
  return Response.json({lead:id?{...lead,id,businessName:`SYNTHETIC ${id}`}:null});
 }
 if (url.includes('/api/dialer/intents')) {
  if (init?.method==='POST' && new URL(url,location.origin).pathname === '/api/dialer/intents') { posts++; settled=false; return Response.json({intent:{id:`synthetic-intent-${posts}`},callingAvailable:true,recording:'do-not-record'},{status:201}); }
  return Response.json({intent:posts?{id:`synthetic-intent-${posts}`,leadId:posts===1?'synthetic-one':'synthetic-two',state:settled?'terminal':'connected',parentStatus:settled?'completed':'in-progress',childStatus:settled?'completed':'in-progress',locked:!settled,canStartNewIntent:settled,recording:'do-not-record',expiresAt:'2099-01-01',finishedAt:settled?'2026-01-01':null}:null});
 }
}
export const syntheticDependencies = {
 fetch: (...args: Parameters<typeof fetch>) => window.fetch(...args),
 microphone: async () => {},
 createDevice: async () => ({on:()=>{},updateToken:()=>{},destroy:()=>{},connect:async()=>{
  listeners={}; call={on:(event:string,fn:()=>void)=>{listeners[event]=fn;},disconnect:()=>listeners.disconnect?.(),mute:()=>{},sendDigits:()=>{}};
  return call;
 }}),
 schedule:(callback:()=>void,delay:number)=>setTimeout(callback,delay),
 cancel:(timer:ReturnType<typeof setTimeout>)=>clearTimeout(timer),
};
