// Harness-only boundary: never access a real microphone, SDK or provider.
import { enabled, syntheticDependencies } from './session-fixture';
export const browserDependencies = enabled ? syntheticDependencies : {
 fetch: (...args: Parameters<typeof fetch>) => window.fetch(...args),
 microphone: async () => { throw new Error('Synthetic harness: microphone disabled'); },
 createDevice: async () => { throw new Error('Synthetic harness: SDK disabled'); },
 schedule: (callback: () => void, delay: number) => setTimeout(callback, delay),
 cancel: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
};
