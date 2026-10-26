const $=id=>document.getElementById(id);let events=[],selected=null,generated=null,selectedFile="";
const kinds=["click","fill","select","check","uncheck","press","navigate","wait","assert-visible","assert-text","assert-url","assert-value"];
const title=k=>({"click":"Click","fill":"Fill input","select":"Select option","check":"Check","uncheck":"Uncheck","press":"Press key","navigate":"Navigate","wait":"Wait","assert-visible":"Assert visible","assert-text":"Assert text","assert-url":"Assert URL","assert-value":"Assert value"}[k]||k);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const q=s=>JSON.stringify(String(s??""));
function msg(s,kind=""){ $("status").textContent=s;$("status").style.borderColor=kind==="error"?"#754b36":kind==="success"?"#25665a":"#314264"; }
function proj(){return{name:$("name").value.trim(),url:$("url").value.trim(),engine:$("engine").value,framework:$("framework").value};}
function render(){ $("count").textContent=events.length;$("empty").hidden=events.length>0;$("timeline").innerHTML=events.map((e,i)=>'<div class="action '+(selected===e.id?'selected':'')+'" data-id="'+esc(e.id)+'" tabindex="0" role="button"><span class="num">'+(i+1)+'</span><div><strong>'+esc(e.description||title(e.kind))+'</strong><small>'+esc(title(e.kind)+' · '+(e.url||(e.target?.name||e.target?.label||e.target?.placeholder||e.target?.testId||e.target?.css||e.value||'Target not identified')) )+'</small></div>'+(e.assertion?'<span class="badge">ASSERTION</span>':'')+'</div>').join("");document.querySelectorAll(".action").forEach(el=>{const fn=()=>{selected=el.dataset.id;render();edit();};el.onclick=fn;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fn();}};});}
function edit(){const e=events.find(x=>x.id===selected);if(!e)return;let d=prompt("Action description",e.description||title(e.kind));if(d===null)return;e.description=d.slice(0,150);if(e.kind==="navigate"){let v=prompt("Navigation URL",e.url||proj().url);if(v!==null)e.url=v;}else if(["fill","select","press","assert-text","assert-url"].includes(e.kind)){let v=prompt(e.redacted?"Environment variable name":"Value / expected value",e.redacted?(e.envVar||"RECORDED_INPUT_"+e.sequence):(e.assertion?.expected??e.value??""));if(v!==null){if(e.redacted)e.envVar=v.replace(/[^A-Z0-9_]/gi,"_").toUpperCase();else if(e.assertion)e.assertion.expected=v;else e.value=v;}}else if(e.target){let v=prompt("Accessible name, label, test ID, placeholder, or CSS selector",e.target.name||e.target.label||e.target.testId||e.target.placeholder||e.target.css||"");if(v!==null){e.target={...e.target,name:v,label:v};e.locators=[{strategy:"role",value:e.target.role||"button",name:v}];}}render();}
function add(k){const base={click:{description:"Click element",target:{role:"button",name:""},locators:[]},fill:{description:"Fill input",target:{label:""},locators:[],value:""},select:{description:"Select option",target:{label:""},locators:[],value:""},check:{description:"Check control",target:{label:""},locators:[]},uncheck:{description:"Uncheck control",target:{label:""},locators:[]},press:{description:"Press key",target:{label:""},locators:[],value:"Enter"},navigate:{description:"Navigate",url:proj().url},wait:{description:"Wait",milliseconds:500},"assert-visible":{description:"Assert visible",target:{role:"button",name:""},locators:[],assertion:{expected:"visible"}},"assert-text":{description:"Assert text",value:"",assertion:{expected:""}},"assert-url":{description:"Assert URL",assertion:{expected:""}},"assert-value":{description:"Assert value",target:{label:""},locators:[],assertion:{expected:""}}};let e={id:"e-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),sequence:events.length+1,kind:k,...(base[k]||base.click),timestamp:new Date().toISOString(),source:"manual"};events.push(e);selected=e.id;render();edit();}
$("addBtn").onclick=()=>{let k=(prompt("Action type: "+kinds.join(", "),"click")||"").trim().toLowerCase();if(!k)return;if(!kinds.includes(k)){msg("Unsupported action type: "+k,"error");return;}add(k);};$("manualAction").onclick=()=>add("click");$("clearBtn").onclick=()=>{if(!events.length||confirm("Clear all actions?")){events=[];selected=null;generated=null;$("files").innerHTML="";$("preview").hidden=true;$("download").hidden=true;render();msg("Actions cleared. No test results are implied.");}};
$("importBtn").onclick=()=>$("file").click();$("file").onchange=async ev=>{const f=ev.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text()),normalized=window.Record2POMCore?.normalizeRecording(d);if(!normalized)throw Error("Recording core is unavailable; reload the dashboard.");if(!normalized.ok)throw Error(normalized.errors.join("\n"));events=normalized.recording.events.map(e=>{if(e.target?.accessibleName&&!e.target.name)e.target.name=e.target.accessibleName;return e;});selected=events[0]?.id||null;if(normalized.recording.targetUrl)$("url").value=normalized.recording.targetUrl;render();msg("Imported "+events.length+" event(s) into the canonical recording format. Review actions and locators before generation.","success");}catch(e){msg("Import failed: "+e.message,"error");}finally{$("file").value="";}};
$("engine").onchange=()=>{$("framework").value=$("engine").value==="playwright"?"pytest":"unittest";};
function locator(e,engine){let t=e.target||{},ranked=window.Record2POMCore?window.Record2POMCore.rankLocators(e.locators).filter(x=>["testId","role","label","placeholder","css"].includes(x.strategy)):[],c=ranked[0]||(e.locators||[]).find(x=>x.strategy==="testId"&&x.value)||(e.locators||[]).find(x=>x.strategy==="role"&&x.value&&x.name)||(e.locators||[]).find(x=>x.strategy==="label"&&x.value)||(e.locators||[]).find(x=>x.strategy==="placeholder"&&x.value)||(e.locators||[]).find(x=>x.strategy==="css"&&x.value);if(c){if(engine==="playwright"){if(c.strategy==="testId")return"page.get_by_test_id("+q(c.value)+")";if(c.strategy==="role")return"page.get_by_role("+q(c.value)+", name="+q(c.name)+")";if(c.strategy==="label")return"page.get_by_label("+q(c.value)+")";if(c.strategy==="placeholder")return"page.get_by_placeholder("+q(c.value)+")";if(c.strategy==="css")return"page.locator("+q(c.value)+")";}else{if(c.strategy==="testId")return"driver.find_element(By.CSS_SELECTOR, "+q('[data-testid="'+c.value+'"]')+")";if(c.strategy==="role"&&c.name)return"driver.find_element(By.XPATH, "+q("//*[@role="+JSON.stringify(c.value)+" and normalize-space(.)="+JSON.stringify(c.name)+"]")+")";if(c.strategy==="label")return"driver.find_element(By.XPATH, "+q("//label[normalize-space(.)="+JSON.stringify(c.value)+"]")+")";if(c.strategy==="placeholder")return"driver.find_element(By.CSS_SELECTOR, "+q('[placeholder="'+c.value+'"]')+")";if(c.strategy==="css")return"driver.find_element(By.CSS_SELECTOR, "+q(c.value)+")";}}if(t.testId)return engine==="playwright"?"page.get_by_test_id("+q(t.testId)+")":"driver.find_element(By.CSS_SELECTOR, "+q('[data-testid="'+t.testId+'"]')+")";if(t.role&&t.name)return engine==="playwright"?"page.get_by_role("+q(t.role)+", name="+q(t.name)+")":"driver.find_element(By.XPATH, "+q("//*[@role="+JSON.stringify(t.role)+" and normalize-space(.)="+JSON.stringify(t.name)+"]")+")";if(t.label)return engine==="playwright"?"page.get_by_label("+q(t.label)+")":"driver.find_element(By.XPATH, "+q("//label[normalize-space(.)="+JSON.stringify(t.label)+"]")+")";if(t.placeholder)return engine==="playwright"?"page.get_by_placeholder("+q(t.placeholder)+")":"driver.find_element(By.CSS_SELECTOR, "+q('[placeholder="'+t.placeholder+'"]')+")";if(t.css)return engine==="playwright"?"page.locator("+q(t.css)+")":"driver.find_element(By.CSS_SELECTOR, "+q(t.css)+")";if(t.text)return engine==="playwright"?"page.get_by_text("+q(t.text)+", exact=True)":"driver.find_element(By.XPATH, "+q("//*[normalize-space(.)="+JSON.stringify(t.text)+"]")+")";throw Error("Action "+e.sequence+" has no locator. Add a role/name, label, test ID, placeholder or CSS selector.");}
function renderStep(e,i,engine){let head="# Step "+(i+1)+": "+String(e.description||e.kind).replace(/[\r\n]/g," ").slice(0,100);if(e.kind==="navigate")return head+"\n        page.goto("+q(e.url||"")+")";if(e.kind==="wait")return head+"\n        page.wait_for_timeout("+Math.min(5000,Math.max(0,Number(e.milliseconds)||500))+")";if(e.kind==="assert-url")return head+"\n        assert "+(engine==="playwright"?"page.url":"driver.current_url")+" == "+q(e.assertion?.expected||e.value||"");if(e.kind==="assert-text")return head+"\n        assert "+(engine==="playwright"?"page.get_by_text("+q(e.assertion?.expected||e.value||"")+", exact=True).is_visible()":"("+q(e.assertion?.expected||e.value||"")+" in driver.find_element(By.TAG_NAME, 'body').text)");let l=locator(e,engine);if(e.kind==="assert-visible")return head+"\n        assert "+l+(engine==="playwright"?".is_visible()":".is_displayed()");if(e.kind==="assert-value")return head+"\n        assert "+l+(engine==="playwright"?".input_value() == ":".get_attribute('value') == ")+q(e.assertion?.expected||e.value||"");if(e.kind==="click")return head+"\n        "+l+".click()";if(e.kind==="fill"){let env=e.envVar||"RECORDED_INPUT_"+(i+1),v=e.redacted?"os.environ.get("+q(env)+", '')":q(e.value||"");return head+"\n        "+(e.redacted?"assert "+q(env)+" in os.environ, 'Set environment variable "+env+"'\n        ":"")+l+(engine==="playwright"?".fill("+v+")":".clear()\n        "+l+".send_keys("+v+")");}if(e.kind==="select")return head+"\n        "+(engine==="playwright"?l+".select_option(label="+q(e.value||"")+")":"Select("+l+").select_by_visible_text("+q(e.value||"")+")");if(e.kind==="check"||e.kind==="uncheck")return head+"\n        "+(engine==="playwright"?l+(e.kind==="check"?".check()":".uncheck()"):"("+l+".click() if "+l+".is_selected() == "+(e.kind==="check"?"False":"True")+" else None)");if(e.kind==="press"){const keys={Enter:"Keys.ENTER",Tab:"Keys.TAB",Escape:"Keys.ESCAPE",Backspace:"Keys.BACKSPACE",Delete:"Keys.DELETE",ArrowDown:"Keys.ARROW_DOWN",ArrowUp:"Keys.ARROW_UP",ArrowLeft:"Keys.ARROW_LEFT",ArrowRight:"Keys.ARROW_RIGHT"};return head+"\n        "+(engine==="playwright"?l+".press("+q(e.value||"Enter")+")":l+".send_keys("+(keys[e.value||"Enter"]||q(e.value||"Enter"))+")");}throw Error("Unsupported action "+e.kind);}
const runnerPy = String.raw`#!/usr/bin/env python3
"""Run this generated project's declared test framework and write truthful local reports."""
from __future__ import annotations
import json
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPORTS = ROOT / "reports"
TIMEOUT_SECONDS = os.environ.get("RECORD2POM_TIMEOUT_SECONDS", "300")
MAX_TIMEOUT_SECONDS = 1800

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def main():
    if len(sys.argv) > 1 and sys.argv[1] not in ("--help", "-h"):
        print("Usage: python run_tests.py [--help]", file=sys.stderr)
        return 2
    if len(sys.argv) > 1:
        print("Runs the generated project tests locally; this is not a sandbox.")
        print("Review the generated test code and only run it against authorized targets.")
        return 0
    try:
        timeout = max(1, min(int(TIMEOUT_SECONDS), MAX_TIMEOUT_SECONDS))
    except ValueError:
        timeout = 300
    requirements_file = ROOT / "requirements.txt"
    requirements_text = requirements_file.read_text(encoding="utf-8") if requirements_file.exists() else ""
    selenium_test = ROOT / "tests" / "test_recorded_journey.py"
    if "pytest-playwright" in requirements_text:
        command = [sys.executable, "-m", "pytest", "-v", "--junitxml=reports/junit.xml"]
        engine = "playwright"
    elif selenium_test.exists():
        command = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"]
        engine = "selenium"
    else:
        print("Cannot identify a supported generated test project.", file=sys.stderr)
        return 2
    REPORTS.mkdir(parents=True, exist_ok=True)
    started = utc_now()
    start = time.monotonic()
    status = "error"
    exit_code = None
    timed_out = False
    stdout = ""
    stderr = ""
    error = None
    try:
        proc = subprocess.run(command, cwd=ROOT, shell=False, capture_output=True,
                              text=True, timeout=timeout, check=False)
        exit_code = proc.returncode
        stdout = proc.stdout[-200_000:]
        stderr = proc.stderr[-200_000:]
        status = "passed" if exit_code == 0 else "failed"
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        status = "timeout"
        stdout = (exc.stdout or "")[-200_000:] if isinstance(exc.stdout, str) else ""
        stderr = (exc.stderr or "")[-200_000:] if isinstance(exc.stderr, str) else ""
        error = f"Test command exceeded {timeout} seconds."
    except OSError as exc:
        status = "error"
        error = f"Could not start test command: {exc}"
    finished = utc_now()
    result = {
        "schemaVersion": 1,
        "project": ROOT.name,
        "engine": engine,
        "framework": "pytest" if engine == "playwright" else "unittest",
        "status": status,
        "exitCode": exit_code,
        "timedOut": timed_out,
        "startedAt": started,
        "finishedAt": finished,
        "durationSeconds": round(time.monotonic() - start, 3),
        "timeoutSeconds": timeout,
        "command": command,
        "stdout": stdout,
        "stderr": stderr,
        "error": error,
        "junitReport": "reports/junit.xml" if engine == "playwright" else None,
        "note": "This report reflects the local process exit status; review output and artifacts."
    }
    (REPORTS / "run-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (REPORTS / "run.log").write_text(
        "COMMAND: " + json.dumps(command) + "\nSTATUS: " + status + "\n\nSTDOUT:\n" + stdout +
        "\nSTDERR:\n" + stderr + ("\nERROR:\n" + error if error else ""), encoding="utf-8")
    print(f"Record2POM run status: {status}")
    print(f"Report: {REPORTS / 'run-results.json'}")
    if engine == "playwright":
        print(f"JUnit: {REPORTS / 'junit.xml'} (created by pytest when available)")
    if error:
        print(error, file=sys.stderr)
    return 0 if status == "passed" else (124 if timed_out else (exit_code if exit_code not in (None, 0) else 1))

if __name__ == "__main__":
    raise SystemExit(main())
`;
function generate(){let p=proj(),errs=[];if(!p.name)errs.push("Project name is required.");try{if(!["http:","https:"].includes(new URL(p.url).protocol))errs.push("Target URL must use HTTP or HTTPS.");}catch{errs.push("Enter a valid HTTP/HTTPS target URL.");}if(!events.length)errs.push("Import a recording or add an action.");if(p.engine==="playwright"&&p.framework!=="pytest")errs.push("Playwright is supported with pytest only.");if(p.engine==="selenium"&&p.framework!=="unittest")errs.push("Selenium is supported with unittest only.");events.forEach((e,i)=>{if(!kinds.includes(e.kind))errs.push("Unsupported action "+(i+1)+": "+e.kind);});if(errs.length)throw Error(errs.join("\n"));let steps=events.map((e,i)=>renderStep({...e,sequence:i+1},i,p.engine)).join("\n\n"),page,test,requirements,commands;if(p.engine==="playwright"){page="import os\nfrom playwright.sync_api import Page\n\nclass RecordedPage:\n    \"\"\"Page object generated from reviewed recording; inspect locators before use.\"\"\"\n    def __init__(self, page: Page): self.page = page\n    def run(self):\n"+steps.replaceAll("page.","self.page.")+"\n";test="import os\nfrom playwright.sync_api import Page\nfrom pages.recorded_page import RecordedPage\nBASE_URL=os.environ.get('BASE_URL', "+q(p.url)+")\ndef test_recorded_journey(page: Page):\n    page.goto(BASE_URL)\n    RecordedPage(page).run()\n";requirements="pytest>=8,<9\npytest-playwright>=0.5,<1\n";commands="python -m playwright install chromium\npython -m pytest -v";}else{page="import os\nimport time\nfrom selenium.webdriver.common.by import By\nfrom selenium.webdriver.common.keys import Keys\nfrom selenium.webdriver.support.ui import Select\n\nclass RecordedPage:\n    \"\"\"Page object generated from reviewed recording; inspect locators before use.\"\"\"\n    def __init__(self, driver): self.driver = driver\n    def run(self):\n"+steps.split("\n").map(x=>x.replaceAll("page.goto(","driver.get(").replaceAll("page.url","driver.current_url").replaceAll("page.wait_for_timeout(","time.sleep(").replaceAll("driver.","self.driver.")).join("\n")+"\n";test="import os,unittest\nfrom selenium import webdriver\nfrom pages.recorded_page import RecordedPage\nBASE_URL=os.environ.get('BASE_URL', "+q(p.url)+")\nclass RecordedJourneyTest(unittest.TestCase):\n def setUp(self):\n  opts=webdriver.ChromeOptions()\n  if os.environ.get('HEADLESS','1')!='0': opts.add_argument('--headless=new')\n  self.driver=webdriver.Chrome(options=opts);self.driver.get(BASE_URL)\n def tearDown(self): self.driver.quit()\n def test_recorded_journey(self): RecordedPage(self.driver).run()\nif __name__=='__main__': unittest.main()\n";requirements="selenium>=4.20,<5\n";commands="python -m unittest discover -s tests -v";}let safe=p.name.replace(/[^a-zA-Z0-9_-]+/g,"-")||"recorded-project",readme="# "+safe+"\n\nGenerated from reviewed actions. Generation is not proof of passing tests.\n\n## Setup\nPython 3.10+ required. Create a virtual environment, install requirements.txt, then run `python run_tests.py`. This runner has a bounded timeout and writes reports/run-results.json and reports/run.log. Playwright projects also request reports/junit.xml from pytest. Review generated code first; the runner executes code locally and is not a security sandbox.\n\nSet BASE_URL to override the target. Review selectors and assertions before running against an authorized test environment. Redacted values require environment variables.\n";return{name:safe,files:{"README.md":readme,"requirements.txt":requirements,"run_tests.py":runnerPy,"pages/__init__.py":"","pages/recorded_page.py":page,"tests/__init__.py":"","tests/test_recorded_journey.py":test,"pytest.ini":"[pytest]\ntestpaths = tests\n",".env.example":"BASE_URL="+p.url+"\nHEADLESS=1\n",".gitignore":".venv/\n__pycache__/\n.pytest_cache/\nreports/\n.env\n"}};}
$("generate").onclick=()=>{try{generated=generate();$("files").innerHTML=Object.keys(generated.files).map(path=>'<div class="file"><span>'+esc(path)+'</span><button data-path="'+esc(path)+'">Preview</button></div>').join("");document.querySelectorAll("[data-path]").forEach(b=>b.onclick=()=>preview(b.dataset.path));$("download").hidden=false;preview("README.md");msg("Generated "+events.length+" action(s). Static generation only; tests have NOT been executed.","success");}catch(e){msg(e.message,"error");}};
function preview(path){selectedFile=path;$("preview").hidden=false;$("filename").textContent=path;$("code").textContent=generated.files[path];}
$("download").onclick=()=>{let b=zip(generated.files),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=generated.name+".zip";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function crc(a){let c=-1;for(let b of a){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^-1)>>>0;}function u16(n){return[n&255,n>>>8&255]}function u32(n){return[n&255,n>>>8&255,n>>>16&255,n>>>24&255]}function zip(files){let enc=new TextEncoder(),local=[],central=[],offset=0;for(let [name,content] of Object.entries(files)){let n=enc.encode(name),d=enc.encode(content),c=crc(d);local.push(new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]));central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]));offset+=local[local.length-1].length;}let size=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(central.length),...u16(central.length),...u32(size),...u32(offset),...u16(0)]);return new Blob([...local,...central,end],{type:"application/zip"});}
render();