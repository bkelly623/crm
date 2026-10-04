// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent } from '@testing-library/react';
import { DialerPanel } from '@/components/dialer/dialer-panel';
import { renderReviewDialer } from './support/render-review-dialer';
afterEach(cleanup);
it('keeps queue filters in a native disclosure without hiding load or errors', async () => {
 vi.stubGlobal('fetch', vi.fn(async () => Response.json({error:'synthetic failure'}, {status:500})));
 await renderReviewDialer(<DialerPanel smartViews={[]} />);
 const summary = screen.getByText('Queue filters');
 expect(summary.tagName).toBe('SUMMARY');
 expect(summary.parentElement?.hasAttribute('open')).toBe(false);
 expect(screen.getByRole('button',{name:'Load Lead'}).closest('details')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Load Lead'}));
 expect((await screen.findByRole('alert')).closest('details')).toBeNull();
});
