# Run via browser_exec in an isolated session after new_tab(loopback3092).
# Actual components and CSS; all account, transport, SDK and writes SYNTHETIC.
import json, pathlib, time
out = pathlib.Path('/home/precision_focused_solutions/crm/docs/preimport-evidence')
out.mkdir(exist_ok=True)
def wait(expr):
    for _ in range(80):
        if js(expr): return
        time.sleep(.1)
    raise AssertionError(expr)
def button(name):
    return '[...document.querySelectorAll("button")].find(e=>e.textContent==='+json.dumps(name)+')'
def tap(name):
    expr=button(name)
    js(f'{expr}.scrollIntoView({{block:"center"}})')
    b=js(f'{expr}.getBoundingClientRect().toJSON()')
    assert not js(f'{expr}.disabled'), name
    click_at_xy(b['x']+b['width']/2,b['y']+b['height']/2)
    time.sleep(.15)
def change(selector,value):
    js('(()=>{const e=document.querySelector('+json.dumps(selector)+'); const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,'+json.dumps(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()')
def shot(name):
    out.joinpath(name+'.png').write_bytes(pathlib.Path(capture_screenshot()).read_bytes())
for width in [320,390,412]:
    cdp('Emulation.setDeviceMetricsOverride',width=width,height=844,deviceScaleFactor=1,mobile=True)
    goto_url('http://127.0.0.1:3092/tests/mobile-harness/index.html?screen=dialer&scenario=sequential');wait_for_load()
    wait('Boolean(window.syntheticSession)')
    cdp('Page.bringToFront')
    wait('document.visibilityState==="visible"')
    tap('Load lists');change('select','synthetic-list')
    tap('Load numbers')
    # Label wraps the select; select by its option rather than synthetic ARIA.
    js('document.querySelectorAll("select").forEach(e=>{if([...e.options].some(o=>o.value.startsWith("PN")))e.id="synthetic-caller-select"})')
    change('#synthetic-caller-select','PN'+'1'*32)
    tap('Start session');wait('window.syntheticSession.posts===1')
    tap('Notes & follow-up');wait('document.querySelector("textarea")&&!document.querySelector("textarea").disabled')
    assert js('window.syntheticSession.disconnects')==0
    change('textarea','SYNTHETIC preserved provenance; callback requested')
    change('section[aria-label="Inline lead work"] label:nth-of-type(2) textarea','SYNTHETIC follow-up task')
    change('input[type="datetime-local"]','2026-10-12T10:30')
    js('document.querySelector("input[type=datetime-local]").scrollIntoView({block:"center"})')
    measure=js('(()=>{const e=[...document.querySelectorAll("button")].find(e=>e.textContent==="Hang up current call"),r=e.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,hangup:{x:r.x,y:r.y,width:r.width,height:r.height},toolbarPosition:getComputedStyle(e.closest("[data-inline-call-toolbar]")).position,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()')
    assert measure['scrollWidth']==width,measure
    assert measure['hangup']['y']>=0 and measure['hangup']['y']+measure['hangup']['height']<=844 and measure['hit'],measure
    shot(f'editor-{width}')
    # Reduced viewport is a geometry proxy only, not a real software keyboard.
    cdp('Emulation.setDeviceMetricsOverride',width=width,height=500,deviceScaleFactor=1,mobile=True)
    js('document.querySelector("input[type=datetime-local]").scrollIntoView({block:"center"})')
    short=js('(()=>{const e=[...document.querySelectorAll("button")].find(e=>e.textContent==="Hang up current call"),r=e.getBoundingClientRect();return {height:innerHeight,scrollWidth:document.documentElement.scrollWidth,top:r.top,bottom:r.bottom,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()')
    assert short['scrollWidth']==width and short['top']>=0 and short['bottom']<=500 and short['hit'],short
    measure['reducedViewport']=short
    shot(f'editor-short-{width}')
    cdp('Emulation.setDeviceMetricsOverride',width=width,height=844,deviceScaleFactor=1,mobile=True)
    tap('Save notes');wait('document.body.innerText.includes("Notes saved. Calling remains paused.")')
    tap('Add follow-up');wait('document.body.innerText.includes("Follow-up created. Calling remains paused.")')
    assert js('window.syntheticSession.posts')==1
    # Coordinate-click the visible sticky Hang up, without scrolling it into view.
    js('document.querySelector("input[type=datetime-local]").scrollIntoView({block:"center"})')
    b=js(button('Hang up current call')+'.getBoundingClientRect().toJSON()')
    click_at_xy(b['x']+b['width']/2,b['y']+b['height']/2)
    wait('window.syntheticSession.disconnects===1')
    js('window.syntheticSession.finish()')
    wait('Boolean('+button('Complete wrap-up')+')')
    time.sleep(6)
    assert js('window.syntheticSession.posts')==1
    tap('Complete wrap-up');tap('Close notes & follow-up')
    time.sleep(6)
    assert js('window.syntheticSession.posts')==1
    # Manual Resume enables saving disposition; it is not automatic session resume.
    js('document.querySelector("details").open=true')
    tap('Resume')
    js('document.querySelectorAll("select").forEach(e=>{if([...e.options].some(o=>o.value==="follow_up_needed"))e.id="synthetic-disposition"})')
    change('#synthetic-disposition','follow_up_needed')
    tap('Save & Next');wait('document.body.innerText.includes("SYNTHETIC synthetic-two")')
    tap('Start session');wait('window.syntheticSession.posts===2')
    tap('End session')
    writes=js('window.syntheticSession.writes')
    assert len(writes)==3,writes
    assert writes[0]['body']=={'notes':'SYNTHETIC preserved provenance; callback requested'}
    assert writes[1]['body']['leadId']=='synthetic-one'
    assert writes[2]['body']=={'sdrStatus':'follow_up_needed'}
    measure.update(synthetic=True,notesSaved=True,taskSaved=True,noAutoResume=True,stickyHangupClicked=True,manualWrapupResumeSaveNextStart=True,writes=writes)
    out.joinpath(f'check-{width}.json').write_text(json.dumps(measure,indent=2))
rows=[json.loads(out.joinpath(f'check-{w}.json').read_text()) for w in [320,390,412]]
assert len(rows)==3
print(json.dumps(rows,indent=2))
