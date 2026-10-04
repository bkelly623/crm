# Execute with browser_exec in an isolated named session after starting both Vite servers.
# All fixtures are synthetic; no preparation, calling, submissions or real auth.
import base64, json, pathlib, time
out = pathlib.Path('/home/precision_focused_solutions/crm/docs/mobile-evidence')
out.mkdir(exist_ok=True)
def shot(name):
    out.joinpath(name + '.png').write_bytes(pathlib.Path(capture_screenshot()).read_bytes())
def tap(selector):
    box = js(f'document.querySelector({json.dumps(selector)}).getBoundingClientRect().toJSON()')
    click_at_xy(box['x'] + box['width']/2, box['y'] + box['height']/2)
    time.sleep(.1)
for phase, port in [('before',3093), ('after',3092)]:
    rows=[]
    for width in [320,390,412,1280]:
        cdp('Emulation.setDeviceMetricsOverride',width=width,height=844,deviceScaleFactor=1,mobile=width<500)
        for screen in ['dialer','leads','detail','users','settings','tasks','calls','home']:
            goto_url(f'http://127.0.0.1:{port}/tests/mobile-harness/index.html?screen={screen}'); wait_for_load()
            assert js('document.body.innerText.includes("SYNTHETIC COMPONENT HARNESS")')
            row=js('''({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,chrome:document.querySelector('aside').getBoundingClientRect().height,small:[...document.querySelectorAll('button,input,select,a,summary')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().width&&e.getBoundingClientRect().height<44).map(e=>({text:e.textContent?.slice(0,45),height:e.getBoundingClientRect().height})),loadTop:[...document.querySelectorAll('button')].find(e=>e.textContent==='Load Lead')?.getBoundingClientRect().top})''')
            if screen in ['dialer','leads','detail']: shot(f'{phase}-{screen}-{width}')
            if screen=='dialer' and width<500:
                assert js('document.querySelector("button[aria-expanded]").checkVisibility()')
                assert not js('document.querySelector("nav").checkVisibility()')
                tap('button[aria-expanded]')
                assert js('document.querySelector("nav").checkVisibility()')
                assert js('document.querySelector("button[aria-expanded]").getAttribute("aria-expanded")')=='true'
                shot(f'{phase}-nav-open-{width}')
                tap('button[aria-expanded]')
                assert not js('document.querySelector("nav").checkVisibility()')
                row['menuTogglePassed']=True
                if phase=='after':
                    assert row['chrome']<=70 and row['loadTop']<500
            if phase=='after' and screen in ['dialer','leads','detail']:
                assert row['scrollWidth']<=width and not row['small'],row
            rows.append(dict(screen=screen,requestedWidth=width,**row))
    out.joinpath(phase+'.json').write_text(json.dumps(rows,indent=2))
print('Verified actual navigation toggle at all 3 phone widths before AND after; 64 screen measurements saved.')
