const $=id=>document.getElementById(id);let events=[],selected=null,generated=null,selectedFile="";
const kinds=["click","fill","select","check","uncheck","press","navigate","wait","assert-visible","assert-text","assert-url","assert-value"];
const title=k=>({"click":"Click","fill":"Fill input","select":"Select option","check":"Check","uncheck":"Uncheck","press":"Press key","navigate":"Navigate","wait":"Wait","assert-visible":"Assert visible","assert-text":"Assert text","assert-url":"Assert URL","assert-value":"Assert value"}[k]||k);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const q=s=>JSON.stringify(String(s??""));
const xpathLiteral=value=>{const s=String(value??"");if(!s.includes("'"))return "'"+s+"'";if(!s.includes('"'))return '"'+s+'"';return "concat("+s.split("'").map(part=>"'"+part+"'").join(", \"'\", ")+")";};
function seleniumRoleXPath(role,name){const r=String(role||"");const native={button:"self::button or self::input[@type='button' or @type='submit' or @type='reset'] or self::summary or @role='button'",link:"self::a[@href] or @role='link'",textbox:"self::input[not(@type='hidden' or @type='checkbox' or @type='radio' or @type='button' or @type='submit' or @type='reset' or @type='file')] or self::textarea or @role='textbox'",checkbox:"self::input[@type='checkbox'] or @role='checkbox'",radio:"self::input[@type='radio'] or @role='radio'",combobox:"self::select or @role='combobox'",option:"self::option or @role='option'",tab:"@role='tab'",menuitem:"@role='menuitem'",switch:"@role='switch'"};const roleMatch=native[r]||"@role="+xpathLiteral(r);const n=xpathLiteral(name);return "//*["+roleMatch+"][(normalize-space(.)="+n+" or @aria-label="+n+" or @title="+n+" or @placeholder="+n+" or ancestor::label[normalize-space(.)="+n+"]) ]";}
function seleniumLabelXPath(value){const n=xpathLiteral(value);return "//*[@id=//label[normalize-space(.)="+n+"]/@for] | //label[normalize-space(.)="+n+"]/descendant-or-self::*[self::input or self::textarea or self::select]";}
function msg(s,kind=""){ $("status").textContent=s;$("status").style.borderColor=kind==="error"?"#754b36":kind==="success"?"#25665a":"#314264"; }
function proj(){return{name:$("name").value.trim(),url:$("url").value.trim(),engine:$("engine").value,framework:$("framework").value};}
function locatorHealth(e){const candidates=(window.Record2POMCore?.rankLocators(e.locators)||[]).filter(c=>["testId","role","label","placeholder","css"].includes(c.strategy));if(!candidates.length)return "Locator: missing · click to correct";const c=candidates[0],assessment=window.Record2POMCore?.assessLocator(c);return "Locator: "+(assessment?.status||"unverified")+(Number.isFinite(c.matchCount)?" · "+c.matchCount+" match(es) when recorded":" · verify before running");}
function render(){ $("count").textContent=events.length;$("exportRecording").disabled=events.length===0;$("empty").hidden=events.length>0;$("timeline").innerHTML=events.map((e,i)=>'<div class="action '+(selected===e.id?'selected':'')+'" data-id="'+esc(e.id)+'" tabindex="0" role="button"><span class="num">'+(i+1)+'</span><div><strong>'+esc(e.description||title(e.kind))+'</strong><small>'+esc(title(e.kind)+' · '+(e.url||(e.target?.name||e.target?.label||e.target?.placeholder||e.target?.testId||e.target?.css||e.value||'Target not identified')) )+'</small><small class="locator-health">'+esc(locatorHealth(e))+'</small></div>'+(e.assertion?'<span class="badge">ASSERTION</span>':'')+'</div>').join("");document.querySelectorAll(".action").forEach(el=>{const fn=()=>{selected=el.dataset.id;render();edit();};el.onclick=fn;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fn();}};});}
function exportReviewedRecording(){if(!events.length){msg("Add or import actions before exporting a recording.","error");return;}const payload={schemaVersion:1,targetUrl:proj().url,metadata:{exportedAt:new Date().toISOString(),exporter:"Record2POM Studio"},events};const normalized=window.Record2POMCore?.normalizeRecording(payload);if(!normalized?.ok){msg("Cannot export recording: "+(normalized?.errors||["recording core unavailable"]).join("; "),"error");return;}const blob=new Blob([JSON.stringify(normalized.recording,null,2)+"\\n"],{type:"application/json;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;const filename=(proj().name||"recording").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"recording";a.download=filename+"-recording.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);msg("Exported reviewed JSON. Sensitive values are omitted by the canonical normalizer.","success");}
$("exportRecording").onclick=exportReviewedRecording;
function edit(){const e=events.find(x=>x.id===selected);if(!e)return;let d=prompt("Action description",e.description||title(e.kind));if(d===null)return;e.description=d.slice(0,150);if(e.kind==="navigate"){let v=prompt("Navigation URL",e.url||proj().url);if(v!==null)e.url=v;}else if(["fill","select","press","assert-text","assert-url"].includes(e.kind)){let v=prompt(e.redacted?"Environment variable name":"Value / expected value",e.redacted?(e.envVar||"RECORDED_INPUT_"+e.sequence):(e.assertion?.expected??e.value??""));if(v!==null){if(e.redacted)e.envVar=v.replace(/[^A-Z0-9_]/gi,"_").toUpperCase();else if(e.assertion)e.assertion.expected=v;else e.value=v;}}else if(e.target){const prior=e.locators?.[0],strategy=prompt("Locator strategy: testId, role, label, placeholder, css",prior?.strategy||"role");if(strategy!==null){const s=strategy.trim();if(!["testId","role","label","placeholder","css"].includes(s)){msg("Unsupported locator strategy. Use testId, role, label, placeholder, or css.","error");return;}let value,name;if(s==="role"){value=prompt("ARIA role (button, link, textbox, checkbox, etc.)",prior?.strategy==="role"?prior.value:(e.target.role||"button"));if(value===null)return;name=prompt("Accessible name",prior?.strategy==="role"?(prior.name||""):(e.target.name||""));if(name===null)return;}else{value=prompt("Locator value",prior?.strategy===s?prior.value:(e.target[s==="testId"?"testId":s==="label"?"label":s==="placeholder"?"placeholder":"css"]||""));if(value===null)return;}e.locators=[{strategy:s,value:value.trim(),...(s==="role"?{name:name.trim()}:{} )}];e.target={...e.target};if(s==="role"){e.target.role=value.trim();e.target.name=name.trim();}else if(s==="testId")e.target.testId=value.trim();else if(s==="label")e.target.label=value.trim();else if(s==="placeholder")e.target.placeholder=value.trim();else e.target.css=value.trim();}}render();}
function add(k){const base={click:{description:"Click element",target:{role:"button",name:""},locators:[]},fill:{description:"Fill input",target:{label:""},locators:[],value:""},select:{description:"Select option",target:{label:""},locators:[],value:""},check:{description:"Check control",target:{label:""},locators:[]},uncheck:{description:"Uncheck control",target:{label:""},locators:[]},press:{description:"Press key",target:{label:""},locators:[],value:"Enter"},navigate:{description:"Navigate",url:proj().url},wait:{description:"Wait",milliseconds:500},"assert-visible":{description:"Assert visible",target:{role:"button",name:""},locators:[],assertion:{expected:"visible"}},"assert-text":{description:"Assert text",value:"",assertion:{expected:""}},"assert-url":{description:"Assert URL",assertion:{expected:""}},"assert-value":{description:"Assert value",target:{label:""},locators:[],assertion:{expected:""}}};let e={id:"e-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),sequence:events.length+1,kind:k,...(base[k]||base.click),timestamp:new Date().toISOString(),source:"manual"};events.push(e);selected=e.id;render();edit();}
$("addBtn").onclick=()=>{let k=(prompt("Action type: "+kinds.join(", "),"click")||"").trim().toLowerCase();if(!k)return;if(!kinds.includes(k)){msg("Unsupported action type: "+k,"error");return;}add(k);};$("manualAction").onclick=()=>add("click");$("clearBtn").onclick=()=>{if(!events.length||confirm("Clear all actions?")){events=[];selected=null;generated=null;$("files").innerHTML="";$("preview").hidden=true;$("download").hidden=true;render();msg("Actions cleared. No test results are implied.");}};
$("importBtn").onclick=()=>$("file").click();$("file").onchange=async ev=>{const f=ev.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text()),normalized=window.Record2POMCore?.normalizeRecording(d);if(!normalized)throw Error("Recording core is unavailable; reload the dashboard.");if(!normalized.ok)throw Error(normalized.errors.join("\n"));events=normalized.recording.events.map(e=>{if(e.target?.accessibleName&&!e.target.name)e.target.name=e.target.accessibleName;return e;});selected=events[0]?.id||null;if(normalized.recording.targetUrl)$("url").value=normalized.recording.targetUrl;render();msg("Imported "+events.length+" event(s) into the canonical recording format. Review actions and locators before generation.","success");}catch(e){msg("Import failed: "+e.message,"error");}finally{$("file").value="";}};
$("engine").onchange=()=>{$("framework").value=$("engine").value==="playwright"?"pytest":"unittest";};
function locator(e,engine){
  const t=e.target||{},ranked=window.Record2POMCore?window.Record2POMCore.rankLocators(e.locators).filter(x=>["testId","role","label","placeholder","css"].includes(x.strategy)):(e.locators||[]);
  const candidates=[...ranked];
  const add=(strategy,value,name)=>{if(value)candidates.push({strategy,value,...(name?{name}:{})});};
  add("testId",t.testId);add("role",t.role,t.name);add("label",t.label);add("placeholder",t.placeholder);add("css",t.css);add("text",t.text);
  const expressions=[],seen=new Set();
  for(const c of candidates){
    if(!c||!c.value)continue;
    let expr=null;
    if(engine==="playwright"){
      if(c.strategy==="testId")expr="self.page.get_by_test_id("+q(c.value)+")";
      else if(c.strategy==="role"&&c.name)expr="self.page.get_by_role("+q(c.value)+", name="+q(c.name)+", exact=True)";
      else if(c.strategy==="label")expr="self.page.get_by_label("+q(c.value)+")";
      else if(c.strategy==="placeholder")expr="self.page.get_by_placeholder("+q(c.value)+")";
      else if(c.strategy==="css")expr="self.page.locator("+q(c.value)+")";
      else if(c.strategy==="text")expr="self.page.get_by_text("+q(c.value)+", exact=True)";
    }else{
      if(c.strategy==="testId")expr="self.driver.find_elements(By.CSS_SELECTOR, "+q('[data-testid="'+c.value+'"]')+")";
      else if(c.strategy==="role"&&c.name)expr="self.driver.find_elements(By.XPATH, "+q(seleniumRoleXPath(c.value,c.name))+")";
      else if(c.strategy==="label")expr="self.driver.find_elements(By.XPATH, "+q(seleniumLabelXPath(c.value))+")";
      else if(c.strategy==="placeholder")expr="self.driver.find_elements(By.CSS_SELECTOR, "+q('[placeholder="'+c.value+'"]')+")";
      else if(c.strategy==="css")expr="self.driver.find_elements(By.CSS_SELECTOR, "+q(c.value)+")";
      else if(c.strategy==="text")expr="self.driver.find_elements(By.XPATH, "+q("//*[normalize-space(.)="+JSON.stringify(c.value)+"]")+")";
    }
    if(expr&&!seen.has(expr)){seen.add(expr);expressions.push("lambda: "+expr);}
  }
  if(!expressions.length)throw Error("Action "+e.sequence+" has no locator. Add a role/name, label, test ID, placeholder or CSS selector.");
  return "self._resolve_locator(["+expressions.join(", ")+"])";
}
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
function generate(){let p=proj(),errs=[];if(!p.name)errs.push("Project name is required.");try{if(!["http:","https:"].includes(new URL(p.url).protocol))errs.push("Target URL must use HTTP or HTTPS.");}catch{errs.push("Enter a valid HTTP/HTTPS target URL.");}if(!events.length)errs.push("Import a recording or add an action.");if(p.engine==="playwright"&&p.framework!=="pytest")errs.push("Playwright is supported with pytest only.");if(p.engine==="selenium"&&p.framework!=="unittest")errs.push("Selenium is supported with unittest only.");events.forEach((e,i)=>{if(!kinds.includes(e.kind))errs.push("Unsupported action "+(i+1)+": "+e.kind);});if(errs.length)throw Error(errs.join("\n"));let steps=events.map((e,i)=>renderStep({...e,sequence:i+1},i,p.engine)).join("\n\n"),page,test,requirements,commands;if(p.engine==="playwright"){page="import os\nfrom playwright.sync_api import Page\n\nclass RecordedPage:\n    \"\"\"Page object generated from reviewed recording; inspect locators before use.\"\"\"\n    def __init__(self, page: Page): self.page = page\n    def _resolve_locator(self, candidates):\n        errors = []\n        for candidate in candidates:\n            try:\n                locator = candidate()\n                count = locator.count()\n                if count == 1: return locator\n                errors.append(f'matched {count} elements')\n            except Exception as exc:\n                errors.append(str(exc))\n        raise LookupError('No locator candidate matched exactly one element: ' + '; '.join(errors))\n    def run(self):\n"+steps.replace(/(?<!self\\.)page\\./g,"self.page.")+"\n";test="import os\nfrom playwright.sync_api import Page\nfrom pages.recorded_page import RecordedPage\nBASE_URL=os.environ.get('BASE_URL', "+q(p.url)+")\ndef test_recorded_journey(page: Page):\n    page.goto(BASE_URL)\n    RecordedPage(page).run()\n";requirements="pytest>=8,<9\npytest-playwright>=0.5,<1\n";commands="python -m playwright install chromium\npython -m pytest -v";}else{page="import os\nimport time\nfrom selenium.webdriver.common.by import By\nfrom selenium.webdriver.common.keys import Keys\nfrom selenium.webdriver.support.ui import Select\n\nclass RecordedPage:\n    \"\"\"Page object generated from reviewed recording; inspect locators before use.\"\"\"\n    def __init__(self, driver): self.driver = driver\n    def _resolve_locator(self, candidates):\n        errors = []\n        for candidate in candidates:\n            try:\n                matches = candidate()\n                if len(matches) == 1: return matches[0]\n                errors.append(f'matched {len(matches)} elements')\n            except Exception as exc:\n                errors.append(str(exc))\n        raise LookupError('No locator candidate matched exactly one element: ' + '; '.join(errors))\n    def run(self):\n"+steps.split("\n").map(x=>x.replaceAll("page.goto(","self.driver.get(").replaceAll("page.url","self.driver.current_url").replaceAll("page.wait_for_timeout(","time.sleep(").replace(/(?<!self\\.)driver\\./g,"self.driver.")).join("\n")+"\n";test="import os,unittest\nfrom selenium import webdriver\nfrom pages.recorded_page import RecordedPage\nBASE_URL=os.environ.get('BASE_URL', "+q(p.url)+")\nclass RecordedJourneyTest(unittest.TestCase):\n def setUp(self):\n  opts=webdriver.ChromeOptions()\n  if os.environ.get('HEADLESS','1')!='0': opts.add_argument('--headless=new')\n  self.driver=webdriver.Chrome(options=opts);self.driver.get(BASE_URL)\n def tearDown(self): self.driver.quit()\n def test_recorded_journey(self): RecordedPage(self.driver).run()\nif __name__=='__main__': unittest.main()\n";requirements="selenium>=4.20,<5\n";commands="python -m unittest discover -s tests -v";}let safe=p.name.replace(/[^a-zA-Z0-9_-]+/g,"-")||"recorded-project",readme="# "+safe+"\n\nGenerated from reviewed actions. Generation is not proof of passing tests.\n\n## Setup\nPython 3.10+ required. Create a virtual environment, install requirements.txt, then run `python run_tests.py`. This runner has a bounded timeout and writes reports/run-results.json and reports/run.log. Playwright projects also request reports/junit.xml from pytest. Review generated code first; the runner executes code locally and is not a security sandbox.\n\nSet BASE_URL to override the target. Review selectors and assertions before running against an authorized test environment. Redacted values require environment variables.\n";return{name:safe,files:{"README.md":readme,"requirements.txt":requirements,"run_tests.py":runnerPy,"pages/__init__.py":"","pages/recorded_page.py":page,"tests/__init__.py":"","tests/test_recorded_journey.py":test,"pytest.ini":"[pytest]\ntestpaths = tests\n",".env.example":"BASE_URL="+p.url+"\nHEADLESS=1\n",".gitignore":".venv/\n__pycache__/\n.pytest_cache/\nreports/\n.env\n"}};}
$("generate").onclick=()=>{try{generated=generate();$("files").innerHTML=Object.keys(generated.files).map(path=>'<div class="file"><span>'+esc(path)+'</span><button data-path="'+esc(path)+'">Preview</button></div>').join("");document.querySelectorAll("[data-path]").forEach(b=>b.onclick=()=>preview(b.dataset.path));$("download").hidden=false;preview("README.md");msg("Generated "+events.length+" action(s). Static generation only; tests have NOT been executed.","success");}catch(e){msg(e.message,"error");}};
function preview(path){selectedFile=path;$("preview").hidden=false;$("filename").textContent=path;$("code").textContent=generated.files[path];}
$("download").onclick=()=>{let b=zip(generated.files),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=generated.name+".zip";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function crc(a){let c=-1;for(let b of a){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^-1)>>>0;}function u16(n){return[n&255,n>>>8&255]}function u32(n){return[n&255,n>>>8&255,n>>>16&255,n>>>24&255]}function zip(files){let enc=new TextEncoder(),local=[],central=[],offset=0;for(let [name,content] of Object.entries(files)){let n=enc.encode(name),d=enc.encode(content),c=crc(d);local.push(new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...n,...d]));central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(d.length),...u32(d.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]));offset+=local[local.length-1].length;}let size=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(central.length),...u16(central.length),...u32(size),...u32(offset),...u16(0)]);return new Blob([...local,...central,end],{type:"application/zip"});}
render();


// Readiness pre-flight: explains blockers and risks before code generation.
function checkReadiness(){
  const p=proj(),items=[];
  const addItem=(level,label,detail)=>items.push({level,label,detail});
  if(!p.name)addItem("block","Project name is missing","Enter a name for the generated ZIP and project folder.");
  else if(!/^[a-zA-Z0-9_-]+$/.test(p.name))addItem("warn","Project name will be sanitized","Use letters, numbers, hyphens or underscores for a predictable folder name.");
  else addItem("pass","Project name is set",p.name);
  try{
    const u=new URL(p.url);
    if(!["http:","https:"].includes(u.protocol))addItem("block","Target URL must use HTTP or HTTPS","Use a full URL such as https://example.test.");
    else addItem("pass","Target URL is valid",u.origin);
  }catch{addItem("block","Target URL is missing or invalid","Enter a full URL beginning with https:// or http://.");}
  if((p.engine==="playwright"&&p.framework==="pytest")||(p.engine==="selenium"&&p.framework==="unittest"))addItem("pass","Engine and framework match",p.engine+" + "+p.framework);
  else addItem("block","Engine and framework do not match","Choose Playwright + pytest or Selenium + unittest.");
  if(!events.length)addItem("block","No recorded actions","Import a recording JSON, use Add action, or install the extension and record a journey.");
  else addItem("pass",events.length+" action(s) loaded","Review the action timeline in sequence before generating.");
  let missing=0,ambiguous=0,unverified=0,redacted=0,assertions=0;
  const needsLocator=new Set(["click","fill","select","check","uncheck","press","assert-visible","assert-value"]);
  events.forEach((e,i)=>{
    if(needsLocator.has(e.kind)){
      const candidates=(window.Record2POMCore?.rankLocators(e.locators)||[]).filter(c=>["testId","role","label","placeholder","css"].includes(c.strategy));
      const chosen=candidates[0];
      if(!chosen||(!chosen.value)|| (chosen.strategy==="role"&&!chosen.name&&p.engine==="selenium"))missing++;
      else if(chosen.matchCount>1)ambiguous++;
      else if(typeof chosen.matchCount!=="number")unverified++;
    }
    if(e.redacted&&e.kind==="fill")redacted++;
    if(String(e.kind).startsWith("assert-"))assertions++;
  });
  if(missing)addItem("block",missing+" action(s) need a usable locator","Select an action in the timeline and correct its locator before generating.");
  else addItem("pass","Required actions have locators","This is a structural check, not proof that selectors still match the live page.");
  if(ambiguous)addItem("warn",ambiguous+" locator(s) were ambiguous","Choose a more specific test ID, role/name, label, placeholder or CSS selector.");
  if(unverified)addItem("warn",unverified+" locator(s) are unverified","Their uniqueness was not measured. Verify the locator in the target site before running.");
  if(redacted)addItem("warn",redacted+" sensitive input(s) need environment variables","Set the generated RECORDED_INPUT_* variable(s) locally; passwords and other secrets are not exported.");
  if(!assertions)addItem("warn","No explicit assertions found","Add Assert visible, Assert text, Assert URL or Assert value so the test verifies an outcome.");
  else addItem("pass",assertions+" assertion(s) included","Assertions provide checks beyond simply replaying actions.");
  addItem("note","Execution happens on your machine","The dashboard only generates files; it does not run tests or verify the target site.");
  const blockers=items.filter(x=>x.level==="block").length,warnings=items.filter(x=>x.level==="warn").length;
  $("readinessSummary").textContent=blockers?blockers+" blocker(s) · "+warnings+" warning(s)":"Ready to generate · "+warnings+" warning(s)";
  $("readinessSummary").className="readiness-summary "+(blockers?"has-blockers":warnings?"has-warnings":"is-ready");
  $("readinessList").innerHTML=items.map(x=>'<li class="'+x.level+'"><span class="readiness-icon">'+({pass:"✓",block:"!",warn:"△",note:"i"}[x.level]||"•")+'</span><div><strong>'+esc(x.label)+'</strong><small>'+esc(x.detail)+'</small></div></li>').join("");
  if(blockers)msg("Readiness check found "+blockers+" blocker(s). Fix them before generating.","error");
  else msg("Readiness check complete. Review warnings and locators; generation still does not execute tests.",warnings?"":"success");
  return {blockers,warnings,items};
}
$("checkReadiness").onclick=checkReadiness;

