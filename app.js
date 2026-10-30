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
  const t=e.target||{},source=Array.isArray(e.locators)?[...e.locators]:[];
  if(e.selectedLocator&&typeof e.selectedLocator==="object")source.unshift({...e.selectedLocator,selected:true});
  const ranked=window.Record2POMCore?window.Record2POMCore.rankLocators(source).filter(x=>["testId","role","label","placeholder","css"].includes(x.strategy)):source;
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
function renderStep(e,i,engine){let head="# Step "+(i+1)+": "+String(e.description||e.kind).replace(/[\r\n]/g," ").slice(0,100);if(e.kind==="navigate")return head+"\n        page.goto("+q(e.url||"")+")";if(e.kind==="wait")return head+"\n        page.wait_for_timeout("+Math.min(5000,Math.max(0,Number(e.milliseconds)||500))+")";if(e.kind==="assert-url")return head+"\n        "+(engine==="playwright"?"expect(self.page).to_have_url("+q(e.assertion?.expected||e.value||"")+", timeout=10000)":"WebDriverWait(self.driver, 10).until(EC.url_to_be("+q(e.assertion?.expected||e.value||"")+"))");if(e.kind==="assert-text")return head+"\n        "+(engine==="playwright"?"expect(page.get_by_text("+q(e.assertion?.expected||e.value||"")+", exact=True)).to_be_visible(timeout=10000)":"WebDriverWait(self.driver, 10).until(lambda d: "+q(e.assertion?.expected||e.value||"")+" in d.find_element(By.TAG_NAME, 'body').text)");let l=locator(e,engine);if(e.kind==="assert-visible")return head+"\n        "+(engine==="playwright"?"expect("+l+").to_be_visible(timeout=10000)":"WebDriverWait(self.driver, 10).until(EC.visibility_of("+l+"))");if(e.kind==="assert-value")return head+"\n        "+(engine==="playwright"?"expect("+l+").to_have_value("+q(e.assertion?.expected||e.value||"")+", timeout=10000)":"WebDriverWait(self.driver, 10).until(lambda d: "+l+".get_attribute('value') == "+q(e.assertion?.expected||e.value||"")+"))");if(e.kind==="click")return head+"\n        "+l+".click()";if(e.kind==="fill"){let env=e.envVar||"RECORDED_INPUT_"+(i+1),v=e.redacted?"os.environ.get("+q(env)+", '')":q(e.value||"");return head+"\n        "+(e.redacted?"assert "+q(env)+" in os.environ and os.environ["+q(env)+"], 'Missing "+env+": copy .env.example to .env and set this value, or export "+env+" in your shell.'\n        ":"")+l+(engine==="playwright"?".fill("+v+")":".clear()\n        "+l+".send_keys("+v+")");}if(e.kind==="select")return head+"\n        "+(engine==="playwright"?"self._resolve_select_locator("+q(e.value||"")+").select_option(label="+q(e.value||"")+")":"Select("+l+").select_by_visible_text("+q(e.value||"")+")");if(e.kind==="check"||e.kind==="uncheck")return head+"\n        "+(engine==="playwright"?l+(e.kind==="check"?".check()":".uncheck()"):"("+l+".click() if "+l+".is_selected() == "+(e.kind==="check"?"False":"True")+" else None)");if(e.kind==="press"){const keys={Enter:"Keys.ENTER",Tab:"Keys.TAB",Escape:"Keys.ESCAPE",Backspace:"Keys.BACKSPACE",Delete:"Keys.DELETE",ArrowDown:"Keys.ARROW_DOWN",ArrowUp:"Keys.ARROW_UP",ArrowLeft:"Keys.ARROW_LEFT",ArrowRight:"Keys.ARROW_RIGHT"};return head+"\n        "+(engine==="playwright"?l+".press("+q(e.value||"Enter")+")":l+".send_keys("+(keys[e.value||"Enter"]||q(e.value||"Enter"))+")");}throw Error("Unsupported action "+e.kind);}
const validatorPy = String.raw`#!/usr/bin/env python3
"""Preflight validation for generated Record2POM projects; does not execute tests."""
import ast, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REQUIRED = ["README.md", "requirements.txt", "config.py", "data/recorded_test_data.json", "pages/recorded_page.py", "tests/test_recorded_journey.py", "run_tests.py"]
def main():
    errors = [f"Missing required file: {p}" for p in REQUIRED if not (ROOT / p).is_file()]
    data_path = ROOT / "data/recorded_test_data.json"
    if data_path.is_file():
        try:
            data = json.loads(data_path.read_text(encoding="utf-8"))
            if not isinstance(data.get("steps"), list) or not data["steps"]:
                errors.append("Test data must contain a non-empty steps array.")
            for i, step in enumerate(data.get("steps", []), 1):
                if not isinstance(step, dict) or not step.get("kind"):
                    errors.append(f"Step {i} has no action kind.")
                elif step.get("redacted") and step.get("value") is not None:
                    errors.append(f"Step {i} is marked redacted but contains a value.")
        except Exception as exc:
            errors.append(f"Invalid recorded test data JSON: {exc}")
    for relative in ("config.py", "pages/recorded_page.py", "tests/test_recorded_journey.py", "run_tests.py"):
        path = ROOT / relative
        if path.is_file():
            try: ast.parse(path.read_text(encoding="utf-8"), filename=relative)
            except SyntaxError as exc: errors.append(f"Python syntax error in {relative}:{exc.lineno}: {exc.msg}")
    if errors:
        print("Record2POM preflight FAILED:")
        for error in errors: print(" - " + error)
        return 1
    print("Record2POM preflight PASSED: files, JSON, redaction flags and Python syntax checked.")
    print("This does not prove that locators match the live target website.")
    return 0
if __name__ == "__main__": raise SystemExit(main())
`;
const runnerPy = String.raw`#!/usr/bin/env python3
"""Run this generated project's declared test framework and write truthful local reports."""
from __future__ import annotations
import hashlib
import json
import mimetypes
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
    if engine == "playwright":
        stale_junit = REPORTS / "junit.xml"
        if stale_junit.exists():
            stale_junit.unlink()
    screenshot_dir = REPORTS / "screenshots"
    if screenshot_dir.exists():
        for stale_image in screenshot_dir.glob("*.png"):
            stale_image.unlink()
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
    diagnostics = {
        "schemaVersion": 1,
        "status": status,
        "generatedAt": finished,
        "summary": "Tests passed." if status == "passed" else (
            error or ("The test process timed out." if timed_out else "One or more tests failed; inspect the evidence below.")
        ),
        "failureCount": 0,
        "failures": [],
        "locatorHints": [],
        "repairSuggestions": [],
        "artifacts": ["reports/run-results.json", "reports/run.log"],
    }
    junit_path = REPORTS / "junit.xml"
    if junit_path.exists():
        try:
            import xml.etree.ElementTree as ET
            root = ET.parse(junit_path).getroot()
            for case in root.iter("testcase"):
                problem = case.find("failure")
                if problem is None:
                    problem = case.find("error")
                if problem is not None:
                    diagnostics["failures"].append({
                        "test": case.get("name", "unknown test"),
                        "class": case.get("classname", ""),
                        "message": problem.get("message", ""),
                        "details": (problem.text or "")[-12000:],
                    })
            diagnostics["failureCount"] = len(diagnostics["failures"])
            diagnostics["artifacts"].append("reports/junit.xml")
        except (OSError, ValueError, ET.ParseError) as exc:
            diagnostics["failures"].append({"test": "JUnit parsing", "message": str(exc), "details": ""})
    combined_output = (stdout + "\n" + stderr + "\n" + (error or ""))
    for line in combined_output.splitlines():
        if "No locator candidate matched exactly one element" in line or "LookupError:" in line:
            diagnostics["locatorHints"].append(line[-2000:])
    if status != "passed" and not diagnostics["failures"]:
        tail = (stderr or stdout or error or "No process output was captured.")[-12000:]
        diagnostics["failures"].append({
            "test": "Test process",
            "message": error or f"Process exited with status {status} (exit code {exit_code}).",
            "details": tail,
        })
        diagnostics["failureCount"] = len(diagnostics["failures"])
    failure_text = " ".join(
        str(f.get(key, "")) for f in diagnostics["failures"] for key in ("message", "details")
    ).lower()
    suggestions = []
    def suggest(code, title, reason, actions):
        suggestions.append({"code": code, "title": title, "reason": reason, "actions": actions})
    if diagnostics["locatorHints"] or "no locator candidate matched exactly one element" in failure_text or "lookuperror" in failure_text:
        suggest("locator-not-unique", "Repair the locator candidates",
                "The generated page object could not find exactly one matching element.",
                ["Inspect the failing step and candidate match counts.",
                 "Prefer a stable data-testid or a specific role plus accessible name.",
                 "Avoid broad text and CSS selectors; re-record the action after confirming the intended element."])
    if "timeout" in failure_text or "timed out" in failure_text or timed_out:
        suggest("timeout", "Check readiness and waiting conditions",
                "The run reported a timeout or an operation did not finish in time.",
                ["Confirm the page and target element are ready before interacting.",
                 "Use a condition-based wait for the expected state rather than increasing timeouts blindly.",
                 "Check network requests, overlays, and navigation that may block the step."])
    if "strict mode" in failure_text or "multiple elements" in failure_text or "matched 0 elements" in failure_text or "matched 2 elements" in failure_text:
        suggest("ambiguous-or-missing", "Narrow or refresh the selector",
                "The selector may match zero elements or more than one element.",
                ["Inspect the live DOM at the failing step.",
                 "Add a stable test ID or refine the role/name, label, placeholder, or CSS selector.",
                 "Re-run the readiness check and verify uniqueness before trusting the test."])
    if "assertionerror" in failure_text or "assert " in failure_text or "failed" in status:
        suggest("assertion-or-state", "Verify the expected application state",
                "The test failed; the application may have changed or the assertion may no longer match intended behavior.",
                ["Compare actual page state with the expected result.",
                 "Check whether the action completed successfully before the assertion.",
                 "Update expected values only after confirming the product requirement."])
    if "stale element" in failure_text or "staleelementreference" in failure_text:
        suggest("stale-element", "Re-query the element after page updates",
                "The page may have re-rendered after the element was located.",
                ["Wait for the relevant update to complete.",
                 "Resolve the locator again after navigation or re-rendering.",
                 "Avoid caching Selenium WebElement objects across page updates."])
    if not suggestions and status == "passed":
        suggest("passed", "No repair needed from captured output",
                "The test process exited successfully; this is not proof of complete application correctness.",
                ["Review assertions and artifacts to confirm they cover the intended journey."])
    diagnostics["repairSuggestions"] = suggestions
    screenshot_files = sorted(screenshot_dir.glob("*.png")) if screenshot_dir.exists() else []
    diagnostics["screenshots"] = [path.relative_to(ROOT).as_posix() for path in screenshot_files]
    diagnostics["artifacts"].extend(diagnostics["screenshots"])
    (REPORTS / "diagnostics.json").write_text(json.dumps(diagnostics, indent=2), encoding="utf-8")
    diagnostics["artifacts"].append("reports/diagnostics.json")
    html_escape = __import__("html").escape
    suggestion_cards = []
    for item in suggestions:
        action_list = "".join("<li>" + html_escape(action) + "</li>" for action in item["actions"])
        suggestion_cards.append("<article><h2>" + html_escape(item["title"]) + "</h2><p>" +
                                html_escape(item["reason"]) + "</p><ol>" + action_list + "</ol></article>")
    rows = [];
    for failure in diagnostics["failures"]:
        rows.append("<article class='failure'><h2>" + html_escape(failure.get("test", "Test failure")) +
                    "</h2><p>" + html_escape(failure.get("message", "")) + "</p><pre>" +
                    html_escape(failure.get("details", "")) + "</pre></article>")
    locator_rows = "".join("<li><code>" + html_escape(item) + "</code></li>" for item in diagnostics["locatorHints"])
    if not rows:
        rows = ["<article><h2>" + ("All tests passed" if status == "passed" else "No structured test failure found") +
                "</h2><p>" + html_escape(diagnostics["summary"]) + "</p></article>"]
    screenshot_cards = "".join("<figure><a href='" + html_escape(path.relative_to(REPORTS).as_posix()) + "'><img loading='lazy' style='max-width:100%;height:auto;border:1px solid #ccd3df;border-radius:8px' src='" + html_escape(path.relative_to(REPORTS).as_posix()) + "' alt='Screenshot captured for a failed test'></a><figcaption>" + html_escape(path.name) + "</figcaption></figure>" for path in screenshot_files)
    step_file = REPORTS / "steps.json"
    step_records = json.loads(step_file.read_text(encoding="utf-8")) if step_file.exists() else []
    step_rows = "".join("<tr><td>" + html_escape(str(item.get("sequence", ""))) + "</td><td>" + html_escape(str(item.get("step", "Step"))) + "</td><td class='status-" + html_escape(str(item.get("status", "unknown"))) + "'>" + html_escape(str(item.get("status", "unknown")).upper()) + "</td><td>" + html_escape(str(item.get("durationMs", "—"))) + " ms</td><td><pre>" + html_escape(str(item.get("error", ""))) + "</pre></td></tr>" for item in step_records)
    timeline_html = "<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Record2POM Step Timeline</title><style>body{font:16px system-ui;max-width:1100px;margin:32px auto;padding:0 16px;color:#202633}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #d5dbe5;vertical-align:top}th{background:#f3f5f8}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.status-passed{color:#167344;font-weight:700}.status-failed{color:#b42318;font-weight:700}.status-running{font-weight:700}@media(max-width:700px){table{font-size:13px}th,td{padding:6px}}</style><h1>Step execution timeline</h1><p>Each row reflects an instrumented generated page-object action. Duration is measured in milliseconds.</p><table><thead><tr><th>#</th><th>Step</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead><tbody>" + (step_rows or "<tr><td colspan='5'>No step timeline was produced. Confirm the generated page object ran.</td></tr>") + "</tbody></table><p><a href='diagnostics.html'>Back to execution diagnostics</a></p></html>"
    (REPORTS / "steps.html").write_text(timeline_html, encoding="utf-8")

    html_report = "<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Record2POM Diagnostics</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:0 18px;color:#202633}article{border:1px solid #ccd3df;border-radius:10px;padding:16px;margin:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f9;padding:12px;border-radius:6px}.status{font-weight:700}code{overflow-wrap:anywhere}</style><h1>Record2POM execution diagnostics</h1><p class='status'>Status: " + html_escape(status.upper()) + "</p><p>" + html_escape(diagnostics["summary"]) + "</p><p>Duration: " + html_escape(str(result["durationSeconds"])) + " seconds · Engine: " + html_escape(engine) + "</p><h2>Failures</h2>" + "".join(rows) + "<h2>Locator fallback hints</h2><ul>" + (locator_rows or "<li>No locator fallback errors were detected in captured output.</li>") + "</ul><h2>Suggested next steps</h2>" + "".join(suggestion_cards) + "<h2>Failure screenshots</h2>" + (screenshot_cards or "<p>No failure screenshots were captured for this run.</p>") + "<p>Generated locally from test process output. Review before relying on results.</p></html>"
    (REPORTS / "diagnostics.html").write_text(html_report, encoding="utf-8")
    diagnostics["artifacts"].append("reports/diagnostics.html")
    diagnostics["artifacts"].append("reports/steps.html")
    (REPORTS / "run-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (REPORTS / "run.log").write_text(
        "COMMAND: " + json.dumps(command) + "\nSTATUS: " + status + "\n\nSTDOUT:\n" + stdout +
        "\nSTDERR:\n" + stderr + ("\nERROR:\n" + error if error else ""), encoding="utf-8")
    # Stable POSIX-relative paths and SHA-256 hashes make artifacts verifiable.
    # The index deliberately excludes itself to avoid recursive hashing.
    evidence_entries = []
    manifest_path = REPORTS / "evidence-index.json"
    for artifact_path in sorted(REPORTS.rglob("*")):
        if not artifact_path.is_file() or artifact_path == manifest_path:
            continue
        try:
            relative_path = artifact_path.relative_to(ROOT).as_posix()
            artifact_path.resolve().relative_to(ROOT.resolve())
            data = artifact_path.read_bytes()
        except (OSError, ValueError):
            continue
        evidence_entries.append({
            "path": relative_path,
            "category": "screenshot" if "screenshots/" in relative_path else "report",
            "mediaType": mimetypes.guess_type(artifact_path.name)[0] or "application/octet-stream",
            "sizeBytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        })
    evidence_index = {
        "schemaVersion": 1,
        "generatedAt": finished,
        "project": ROOT.name,
        "runStatus": status,
        "integrity": {
            "algorithm": "sha256",
            "pathFormat": "POSIX relative to project root",
            "manifestSelfHash": "omitted to avoid recursive hashing",
        },
        "artifactCount": len(evidence_entries),
        "artifacts": evidence_entries,
    }
    manifest_path.write_text(json.dumps(evidence_index, indent=2), encoding="utf-8")
    print(f"Evidence index: {manifest_path}")
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
function generate(){let p=proj(),errs=[];if(!p.name)errs.push("Project name is required.");try{if(!["http:","https:"].includes(new URL(p.url).protocol))errs.push("Target URL must use HTTP or HTTPS.");}catch{errs.push("Enter a valid HTTP/HTTPS target URL.");}if(!events.length)errs.push("Import a recording or add an action.");if(p.engine==="playwright"&&p.framework!=="pytest")errs.push("Playwright is supported with pytest only.");if(p.engine==="selenium"&&p.framework!=="unittest")errs.push("Selenium is supported with unittest only.");events.forEach((e,i)=>{if(!kinds.includes(e.kind))errs.push("Unsupported action "+(i+1)+": "+e.kind);});if(errs.length)throw Error(errs.join("\n"));const generatedEvents=events.map((event,index)=>({...event,sequence:index+1,...(event.redacted?{envVar:String(event.envVar||"RECORDED_INPUT_"+(index+1)).replace(/[^A-Z0-9_]/gi,"_").toUpperCase()}:{})}));let steps=generatedEvents.map((e,i)=>{const label=String(e.description||e.kind).replace(/[\r\n]/g," ").slice(0,100);const body=renderStep({...e,sequence:i+1},i,p.engine);return "        with self._step("+q(label)+", "+(i+1)+"):\n"+body.split("\n").map(line=>"    "+line).join("\n");}).join("\n\n"),page,test,requirements,commands,conftest;if(p.engine==="playwright"){page="import os\nimport json\nimport time\nfrom contextlib import contextmanager\nfrom pathlib import Path\nfrom playwright.sync_api import Page, expect\n\nclass RecordedPage:\n    \"\"\"Page object generated from reviewed recording; inspect locators before use.\"\"\"\n    def __init__(self, page: Page): self.page = page; self._timeline = []\n    @contextmanager\n    def _step(self, label, sequence):\n        record = {\"sequence\": sequence, \"step\": label, \"status\": \"running\", \"startedAt\": time.time()}\n        try:\n            yield\n            record[\"status\"] = \"passed\"\n        except Exception as exc:\n            record[\"status\"] = \"failed\"\n            record[\"error\"] = str(exc)[:1000]\n            raise\n        finally:\n            record[\"endedAt\"] = time.time()\n            record[\"durationMs\"] = round((record[\"endedAt\"] - record[\"startedAt\"]) * 1000, 2)\n            self._timeline.append(record)\n            out = Path(\"reports\"); out.mkdir(parents=True, exist_ok=True)\n            (out / \"steps.json\").write_text(json.dumps(self._timeline, indent=2), encoding=\"utf-8\")\n    def _resolve_locator(self, candidates):\n        errors = []\n        for index, candidate in enumerate(candidates):\n            try:\n                locator = candidate()\n                try:\n                    locator.first.wait_for(state='attached', timeout=1200)\n                except Exception:\n                    pass\n                count = locator.count()\n                if count != 1:\n                    errors.append(f'candidate {index + 1}: matched {count} elements; expected exactly one')\n                    continue\n                try:\n                    locator.wait_for(state='visible', timeout=2500)\n                except Exception as exc:\n                    errors.append(f'candidate {index + 1}: unique element stayed hidden or detached ({str(exc)[:180]})')\n                    continue\n                # Re-measure after waiting; dynamic pages can replace or duplicate nodes.\n                final_count = locator.count()\n                if final_count != 1:\n                    errors.append(f'candidate {index + 1}: match count changed to {final_count} while waiting')\n                    continue\n                return locator\n            except Exception as exc:\n                errors.append(f'candidate {index + 1}: {str(exc)[:180]}')\n        detail = '; '.join(errors) if errors else 'no candidates were supplied'\n        raise LookupError('Locator recovery stopped safely; no candidate resolved to exactly one visible element. ' + detail + ' Repair: prefer a unique data-testid, then an accessible role/name or label; inspect duplicate matches, hidden overlays, and page state. No click was attempted.')\n    def _resolve_select_locator(self, label):\n        # Wait for dynamic native dropdowns, then match by option text.\n        matches = []\n        selects = self.page.locator('select')\n        try:\n            selects.first.wait_for(state='attached', timeout=3000)\n        except Exception:\n            pass\n        for index in range(selects.count()):\n            select = selects.nth(index)\n            labels = [text.strip() for text in select.locator('option').all_text_contents()]\n            if label in labels:\n                matches.append(select)\n        if len(matches) == 1:\n            return matches[0]\n        raise LookupError(f'Expected exactly one native select containing option {label!r}; found {len(matches)}. For custom dropdowns, record opening the menu and clicking the option.')\n    def run(self):\n"+steps.replace(/(?<!self\.)page\./g,"self.page.")+"\n";test="import os\nfrom playwright.sync_api import Page, expect\nfrom pages.recorded_page import RecordedPage\nBASE_URL=os.environ.get('BASE_URL', "+q(p.url)+")\ndef test_recorded_journey(page: Page):\n    page.goto(BASE_URL)\n    RecordedPage(page).run()\n";conftest="import os\nfrom urllib.parse import urlparse\nfrom dotenv import load_dotenv\nload_dotenv()\n\n# SauceDemo publishes this credential for its public demo environment only.\n_demo_host = (urlparse(os.environ.get('BASE_URL', " + q(p.url) + ")).hostname or '').lower()\n_demo_password = os.environ.get('PASSWORD', '').strip()\nif _demo_host in {'saucedemo.com', 'www.saucedemo.com'} and _demo_password.lower() in {'', 'replace_me', 'changeme', 'your_password'}:\n    os.environ['PASSWORD'] = 'secret_sauce'\n\nimport pytest\nfrom pathlib import Path\n\n@pytest.hookimpl(hookwrapper=True)\ndef pytest_runtest_makereport(item, call):\n    outcome = yield\n    report = outcome.get_result()\n    if report.when != 'call' or not report.failed:\n        return\n    page = item.funcargs.get('page')\n    if page is None:\n        return\n    destination = Path('reports/screenshots')\n    destination.mkdir(parents=True, exist_ok=True)\n    safe_name = ''.join(ch if ch.isalnum() or ch in '-_' else '_' for ch in item.nodeid)[:120]\n    try:\n        page.screenshot(path=str(destination / (safe_name + '.png')), full_page=True)\n    except Exception as exc:\n        print(f'Screenshot capture failed: {exc}')\n";requirements="pytest>=8,<9\npytest-playwright>=0.5,<1\npython-dotenv>=1.0,<2\n";commands="python -m playwright install chromium\npython -m pytest -v";}else{page="import os\nimport json\nimport time\nfrom contextlib import contextmanager\nfrom pathlib import Path\nfrom selenium.webdriver.common.by import By\nfrom selenium.webdriver.common.keys import Keys\nfrom selenium.webdriver.support.ui import Select, WebDriverWait\nfrom selenium.webdriver.support import expected_conditions as EC\n\nclass RecordedPage:\n    \"\"\"Page object generated from reviewed recording; inspect locators before use.\"\"\"\n    def __init__(self, driver): self.driver = driver; self._timeline = []\n    @contextmanager\n    def _step(self, label, sequence):\n        record = {\"sequence\": sequence, \"step\": label, \"status\": \"running\", \"startedAt\": time.time()}\n        try:\n            yield\n            record[\"status\"] = \"passed\"\n        except Exception as exc:\n            record[\"status\"] = \"failed\"\n            record[\"error\"] = str(exc)[:1000]\n            raise\n        finally:\n            record[\"endedAt\"] = time.time()\n            record[\"durationMs\"] = round((record[\"endedAt\"] - record[\"startedAt\"]) * 1000, 2)\n            self._timeline.append(record)\n            out = Path(\"reports\"); out.mkdir(parents=True, exist_ok=True)\n            (out / \"steps.json\").write_text(json.dumps(self._timeline, indent=2), encoding=\"utf-8\")\n    def _resolve_locator(self, candidates):\n        errors = []\n        for index, candidate in enumerate(candidates):\n            try:\n                matches = candidate()\n                if len(matches) != 1:\n                    errors.append(f'candidate {index + 1}: matched {len(matches)} elements; expected exactly one')\n                    continue\n                element = matches[0]\n                if not element.is_displayed():\n                    errors.append(f'candidate {index + 1}: unique element is hidden')\n                    continue\n                # Re-run the locator immediately before returning to catch DOM changes.\n                refreshed = candidate()\n                if len(refreshed) != 1:\n                    errors.append(f'candidate {index + 1}: match count changed to {len(refreshed)} during recovery')\n                    continue\n                if not refreshed[0].is_displayed():\n                    errors.append(f'candidate {index + 1}: element became hidden during recovery')\n                    continue\n                return refreshed[0]\n            except Exception as exc:\n                errors.append(f'candidate {index + 1}: {str(exc)[:180]}')\n        detail = '; '.join(errors) if errors else 'no candidates were supplied'\n        raise LookupError('Locator recovery stopped safely; no candidate resolved to exactly one visible element. ' + detail + ' Repair: prefer a unique data-testid, then an accessible role/name or label; inspect duplicate matches, hidden overlays, and page state. No click was attempted.')\n    def run(self):\n"+steps.split("\n").map(x=>x.replaceAll("page.goto(","self.driver.get(").replaceAll("page.url","self.driver.current_url").replaceAll("page.wait_for_timeout(","time.sleep(").replace(/(?<!self\.)driver\./g,"self.driver.")).join("\n")+"\n";test="import os,unittest\nfrom dotenv import load_dotenv\nload_dotenv()\nfrom pathlib import Path\nfrom selenium import webdriver\nfrom pages.recorded_page import RecordedPage\nBASE_URL=os.environ.get('BASE_URL', "+q(p.url)+")\nclass RecordedJourneyTest(unittest.TestCase):\n def setUp(self):\n  opts=webdriver.ChromeOptions()\n  if os.environ.get('HEADLESS','1')!='0': opts.add_argument('--headless=new')\n  self.driver=webdriver.Chrome(options=opts);self.driver.get(BASE_URL)\n def tearDown(self):\n  result=getattr(getattr(self, '_outcome', None), 'result', None)\n  failed=result and any(test is self for test, _ in (result.failures + result.errors))\n  if failed:\n   path=Path('reports/screenshots');path.mkdir(parents=True, exist_ok=True)\n   try: self.driver.save_screenshot(str(path / 'test_recorded_journey.png'))\n   except Exception: pass\n  self.driver.quit()\n def test_recorded_journey(self): RecordedPage(self.driver).run()\nif __name__=='__main__': unittest.main()\n";requirements="selenium>=4.20,<5\npython-dotenv>=1.0,<2\n";commands="python -m unittest discover -s tests -v";}let safe=p.name.replace(/[^a-zA-Z0-9_-]+/g,"-")||"recorded-project",readme="# "+safe+"\n\n**Framework creator:** Satyendra Kumar Namdeo  \n**Generated by:** Record2POM Universal POM Automation Studio\n\nGenerated from reviewed actions. Generation is not proof of passing tests.\n\n## Quick start (Windows PowerShell)\nRun the included bootstrap script from this folder: `\\.\\run.ps1`. It creates `.venv` if needed, installs the project dependencies, creates `.env` from `.env.example` when missing, installs Chromium for Playwright projects, validates the generated files, and runs the recorded journey.\n\nFor manual setup, create a virtual environment with `py -3 -m venv .venv`, activate it with `.\\.venv\\Scripts\\Activate.ps1`, install `python -m pip install -r requirements.txt`, copy `.env.example` to `.env`, then run `python validate_project.py` and `python -m pytest tests\\ -v` (Playwright) or `python -m unittest discover -s tests -v` (Selenium). Never commit `.env`. The public SauceDemo demo password is configured only for the official SauceDemo host; other sites require their own credentials in `.env`.\n\nThe runner has a bounded timeout and writes reports/run-results.json and reports/run.log. Playwright projects also produce failure screenshots and step diagnostics. Review generated code before running it; this runner is not a security sandbox.\n\nSet BASE_URL to override the target. Inspect the recorded selectors and assertions before running against an authorized test environment. Redacted values are never embedded in generated Python code; they are loaded from local environment configuration.\n";const data={schemaVersion:1,targetUrl:p.url,generatedAt:new Date().toISOString(),creator:"Satyendra Kumar Namdeo",generator:"Record2POM Universal POM Automation Studio",engine:p.engine,framework:p.framework,steps:generatedEvents.map((e,i)=>({sequence:i+1,kind:e.kind,description:String(e.description||e.kind).slice(0,180),target:{strategy:e.target?.strategy||null,role:e.target?.role||null,name:e.target?.name||null,label:e.target?.label||null,testId:e.target?.testId||null,placeholder:e.target?.placeholder||null,css:e.target?.css||null},value:e.redacted?null:(e.value??null),redacted:!!e.redacted,assertion:e.assertion||null}))};return{name:safe,files:{"README.md":readme,"requirements.txt":requirements,"run_tests.py":runnerPy,"validate_project.py":validatorPy,"config.py":"\"\"\"Generated configuration. Framework creator: Satyendra Kumar Namdeo.\"\"\"\nimport os\nCREATOR = 'Satyendra Kumar Namdeo'\nGENERATOR = 'Record2POM Universal POM Automation Studio'\nBASE_URL = os.environ.get('BASE_URL', "+q(p.url)+")\nHEADLESS = os.environ.get('HEADLESS', '1') != '0'\n","data/recorded_test_data.json":JSON.stringify(data,null,2)+"\n","pages/__init__.py":"","pages/recorded_page.py":page,"tests/__init__.py":"","tests/test_recorded_journey.py":test,...(p.engine==="playwright"?{"tests/conftest.py":conftest}:{}),"pytest.ini":"[pytest]\ntestpaths = tests\n",".env.example":"BASE_URL="+p.url+"\nHEADLESS=1\n"+[...new Set(generatedEvents.filter(e=>e.redacted&&["fill","select","press"].includes(e.kind)).map(e=>String(e.envVar).replace(/[^A-Z0-9_]/gi,"_").toUpperCase()))].map(name=>name+"=replace_me\n").join(""),"run.ps1":"\"$ErrorActionPreference = 'Stop'\\n$Root = $PSScriptRoot\\nSet-Location $Root\\n$VenvPython = Join-Path $Root '.venv\\\\Scripts\\\\python.exe'\\nif (-not (Test-Path $VenvPython)) {\\n    if (Get-Command py -ErrorAction SilentlyContinue) { py -3 -m venv (Join-Path $Root '.venv') }\\n    else { python -m venv (Join-Path $Root '.venv') }\\n}\\nif (-not (Test-Path $VenvPython)) { throw 'Virtual environment creation failed. Install Python 3.10+ and retry.' }\\n& $VenvPython -m pip install --upgrade pip\\nif ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed.' }\\n& $VenvPython -m pip install -r requirements.txt\\nif ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your network and requirements.txt.' }\\nif (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env'; Write-Host 'Created .env from .env.example. Configure any non-demo credentials there.' }\\n& $VenvPython validate_project.py\\nif ($LASTEXITCODE -ne 0) { throw 'Generated project validation failed; see the errors above.' }\\nif (Test-Path 'pytest.ini') {\\n    & $VenvPython -m playwright install chromium\\n    if ($LASTEXITCODE -ne 0) { throw 'Playwright Chromium installation failed.' }\\n    & $VenvPython -m pytest tests -v\\n} else {\\n    & $VenvPython -m unittest discover -s tests -v\\n}\\nif ($LASTEXITCODE -ne 0) { throw 'Recorded journey failed. Review the failed step and reports folder.' }\\nWrite-Host 'Record2POM journey completed successfully.' -ForegroundColor Green\\n",".gitignore":".venv/\n__pycache__/\n.pytest_cache/\nreports/\n.env\n"}};}
$("generate").onclick=()=>{try{generated=generate();$("files").innerHTML=Object.keys(generated.files).map(path=>'<div class="file"><span>'+esc(path)+'</span><button data-path="'+esc(path)+'">Preview</button></div>').join("");document.querySelectorAll("[data-path]").forEach(b=>b.onclick=()=>preview(b.dataset.path));$("download").hidden=false;preview("README.md");msg("Generated "+events.length+" action(s). Static generation only; tests have NOT been executed.","success");}catch(e){msg(e.message,"error");}};
function preview(path){selectedFile=path;$("preview").hidden=false;$("filename").textContent=path;$("code").textContent=generated.files[path];}
$("download").onclick=async()=>{try{if(!generated?.files||!Object.keys(generated.files).length)throw Error("Generate the POM project before downloading.");const expected=Object.keys(generated.files);const required=["README.md","requirements.txt","run_tests.py","validate_project.py","config.py","data/recorded_test_data.json","pages/recorded_page.py","pages/__init__.py","tests/__init__.py","tests/test_recorded_journey.py","pytest.ini",".env.example","run.ps1",".gitignore"];const missing=required.filter(path=>!(path in generated.files));if(missing.length)throw Error("Project integrity check failed; missing: "+missing.join(", "));let testData;try{testData=JSON.parse(generated.files["data/recorded_test_data.json"]);}catch{throw Error("Project integrity check failed: recorded test data is invalid JSON.");}if(!Array.isArray(testData.steps)||!testData.steps.length)throw Error("Project integrity check failed: recorded test data has no steps.");if(!generated.files["pages/recorded_page.py"].includes("class RecordedPage"))throw Error("Project integrity check failed: generated page object is missing.");if(!generated.files["tests/test_recorded_journey.py"].includes("RecordedPage"))throw Error("Project integrity check failed: generated journey test is missing.");const b=zip(generated.files);if(b.size<22)throw Error("Generated ZIP is unexpectedly small.");const bytes=new Uint8Array(await b.slice(0,4).arrayBuffer());if(bytes[0]!==0x50||bytes[1]!==0x4b||bytes[2]!==0x03||bytes[3]!==0x04)throw Error("ZIP validation failed: local file header is missing.");const tail=new Uint8Array(await b.slice(Math.max(0,b.size-22)).arrayBuffer());if(tail.length!==22||tail[0]!==0x50||tail[1]!==0x4b||tail[2]!==0x05||tail[3]!==0x06)throw Error("ZIP validation failed: end-of-central-directory record is missing.");const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=generated.name+".zip";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);msg("Project integrity and ZIP structure validated; started download with "+expected.length+" files. Browser tests have not been executed.","success");}catch(error){msg("Download blocked: "+error.message,"error");}};
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



// Extension hand-off: import the stopped browser session directly and generate the POM project.
const handledRecordingSessions = new Set();
window.addEventListener("record2pom:import-recording", event => {
  const sessionId = String(event.detail?.metadata?.sessionId || "");
  if (sessionId && handledRecordingSessions.has(sessionId)) {
    window.dispatchEvent(new CustomEvent("record2pom:import-ack", {detail:{ok:true, sessionId, eventCount:events.length, duplicate:true}}));
    msg("This recording session was already imported in this Studio tab; kept the existing generated project.", "success");
    return;
  }
  try {
    const normalized = window.Record2POMCore?.normalizeRecording(event.detail);
    if (!normalized?.ok) throw Error(normalized?.errors?.join("; ") || "Recording could not be normalized.");
    events = normalized.recording.events.map(e => {
      if (e.target?.accessibleName && !e.target.name) e.target.name = e.target.accessibleName;
      return e;
    });
    selected = events[0]?.id || null;
    const targetUrl = normalized.recording.targetUrl || events.find(e => e.url)?.url || "";
    if (targetUrl) $("url").value = targetUrl;
    const hostname = (() => { try { return new URL(targetUrl).hostname.replace(/^www\\./, "").split(".")[0]; } catch { return "recorded"; } })();
    $("name").value = (hostname + "-pom-tests").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "recorded-pom-tests";
    render();
    const generatedButton = $("generate");
    generatedButton.click();
    if (!generated || !generated.files || !Object.keys(generated.files).length) throw Error("POM generation did not produce project files.");
    if (sessionId) handledRecordingSessions.add(sessionId);
    msg("Imported " + events.length + " recorded action(s) and generated " + Object.keys(generated.files).length + " project files. Review the actions and download the ZIP.", "success");
    $("download").scrollIntoView({behavior:"smooth", block:"center"});
    window.dispatchEvent(new CustomEvent("record2pom:import-ack", {detail:{ok:true, sessionId:sessionId || null, eventCount:events.length, fileCount:Object.keys(generated.files).length}}));
  } catch (error) {
    msg("Automatic POM generation failed: " + error.message + ". You can still import the recording JSON manually.", "error");
    window.dispatchEvent(new CustomEvent("record2pom:import-ack", {detail:{ok:false, sessionId:event.detail?.metadata?.sessionId || null, error:error.message}}));
  }
});
