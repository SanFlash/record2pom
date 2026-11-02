(function(root){"use strict";
function readQuoted(source,start=0){
 let i=start;while(/\s/.test(source[i]||""))i++;
 const quote=source[i];if(quote!=="'"&&quote!=='"')return null;
 let value="",escaped=false;
 for(i=i+1;i<source.length;i++){const ch=source[i];if(escaped){const map={n:"\n",r:"\r",t:"\t",b:"\b",f:"\f"};value+=map[ch]??ch;escaped=false;continue;}if(ch==="\\"){escaped=true;continue;}if(ch===quote)return{value,end:i+1};value+=ch;}
 return null;
}
function stringProperty(source,name){const m=source.match(new RegExp("\\b"+name+"\\s*:\\s*"));if(!m)return null;return readQuoted(source,m.index+m[0].length)?.value??null;}
function parseLocator(expression){
 const m=String(expression).trim().match(/^(?:page|this\.page)\.(getByRole|getByLabel|getByPlaceholder|getByTestId|getByText|getByAltText|getByTitle|locator)\s*\(/);
 if(!m)return null;
 const args=String(expression).trim().slice(m[0].length);
 const first=readQuoted(args);if(!first)return null;
 const method=m[1];let strategy,value=first.value,name;
 if(method==="getByRole"){strategy="role";value=first.value;name=stringProperty(args,"name");}
 else if(method==="getByLabel"){strategy="label";value=first.value;}
 else if(method==="getByPlaceholder"){strategy="placeholder";value=first.value;}
 else if(method==="getByTestId"){strategy="testId";value=first.value;}
 else if(method==="getByText"){strategy="text";value=first.value;}
 else if(method==="getByAltText"){strategy="alt";value=first.value;}
 else if(method==="getByTitle"){strategy="title";value=first.value;}
 else {strategy="css";value=first.value;}
 return {strategy,value,...(name!=null?{name}:{}),matchCount:null,confidence:"unverified",source:"playwright-crx"};
}
function makeEvent(kind,locator,extra,index,url){
 const target={...(locator?.strategy==="role"?{role:locator.value}:{}),...(locator?.name?{name:locator.name}:{}),...(locator?.strategy==="label"?{label:locator.value}:{}),...(locator?.strategy==="placeholder"?{placeholder:locator.value}:{}),...(locator?.strategy==="testId"?{testId:locator.value}:{}),...(locator?.strategy==="css"?{css:locator.value}:{})};
 const locators=locator?[{...locator}]:[];
 const event={schemaVersion:1,id:"crx-"+(index+1),sequence:index+1,kind,description:extra.description||kind,url:url||"",target,locators,source:"playwright-crx-import",...extra};
 if(locator?.strategy==="testId")event.selectedLocator={...locator,selected:true};
 return event;
}
function parse(source){
 if(typeof source!=="string"||!source.trim())throw Error("Paste a Playwright CRX script first.");
 if(source.length>1000000)throw Error("Script is larger than 1 MB.");
 const events=[],ignored=[];let targetUrl="",lineNo=0;
 for(const raw of source.split(/\r?\n/)){
  lineNo++;const line=raw.trim();if(!line||line.startsWith("//")||line.startsWith("import ")||line.startsWith("const ")||line.startsWith("test(")||line==="});"||line==="});")continue;
  const goto=line.match(/^(?:await\s+)?(?:page|this\.page)\.(?:goto|navigate)\((.*)\)\s*;?$/);
  if(goto){const q=readQuoted(goto[1]);if(q){targetUrl=q.value;events.push(makeEvent("navigate",null,{url:q.value,description:"Navigate to "+q.value},events.length,q.value));continue;}}
  const assertion=line.match(/^(?:await\s+)?expect\((.+)\)\.(toBeVisible|toHaveText|toContainText|toHaveValue|toHaveURL)\((.*)\)\s*;?$/);
  if(assertion){
   const locatorExpr=assertion[1].trim(),method=assertion[2],arg=assertion[3],locator=locatorExpr==="page"||locatorExpr==="this.page"?null:parseLocator(locatorExpr);
   const expected=readQuoted(arg)?.value??stringProperty(arg,"value")??"";
   const kind=method==="toBeVisible"?"assert-visible":method==="toHaveValue"?"assert-value":method==="toHaveURL"?"assert-url":"assert-text";
   if(method==="toHaveURL"){events.push(makeEvent(kind,null,{assertion:{expected},value:expected,description:"Assert URL contains "+expected},events.length,targetUrl));continue;}
   if(kind==="assert-visible"&&!locator){ignored.push(lineNo);continue;}
   if(!locator&&kind!=="assert-text"){ignored.push(lineNo);continue;}
   events.push(makeEvent(kind,locator,{assertion:{expected},value:expected,description:"Assert "+(locator?.name||locator?.value||"page")+" "+method},events.length,targetUrl));continue;
  }
  const action=line.match(/^(?:await\s+)?(.+)\.(click|fill|type|selectOption|check|uncheck|press|hover)\((.*)\)\s*;?$/);
  if(action){
   const locator=parseLocator(action[1]);if(!locator){ignored.push(lineNo);continue;}
   const method=action[2],arg=action[3];let kind=method==="type"?"fill":method==="selectOption"?"select":method;
   let value=readQuoted(arg)?.value;
   if(method==="selectOption")value=stringProperty(arg,"value")??stringProperty(arg,"label")??value;
   if(method==="press"&&value==null)value=stringProperty(arg,"key");
   const sensitive=/password|otp|token|secret|credential|credit.?card|cvv/i.test([locator.name,locator.value].join(" "));
   const extra={description:({click:"Click",fill:"Fill",select:"Select",check:"Check",uncheck:"Uncheck",press:"Press",hover:"Hover"}[kind]||kind)+" "+(locator.name||locator.value)};
   if(["fill","select","press"].includes(kind)&&value!=null){if(sensitive){extra.redacted=true;extra.sensitivity="sensitive";extra.envVar="RECORDED_INPUT_"+(events.length+1);}else extra.value=value;}
   if(kind==="fill"||kind==="select")extra.dataKey=String(locator.name||locator.value||"input").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,60)||"input";
   events.push(makeEvent(kind,locator,extra,events.length,targetUrl));continue;
  }
  if(/^(?:await\s+)?(?:page|this\.page)\.(?:screenshot|waitForTimeout|waitForLoadState)\(/.test(line))continue;
  if(line.includes("getBy")||line.includes(".locator(")||line.includes(".click(")||line.includes(".fill(")||line.includes(".selectOption(")||line.includes("expect("))ignored.push(lineNo);
 }
 if(!events.length)throw Error("No supported Playwright actions were found. Paste JavaScript/TypeScript output from Playwright CRX or Playwright codegen.");
 return {events,targetUrl,ignoredLines:ignored,recognized:events.length};
}
root.Record2POMCrxImporter=Object.freeze({parse});
if(typeof document!=="undefined"){
 const button=document.getElementById("crxImport"),input=document.getElementById("crxCode"),status=document.getElementById("crxStatus");
 if(button&&input&&status)button.addEventListener("click",()=>{
  try{
   const parsed=parse(input.value);
   if(!root.Record2POMStudio?.setEvents)throw Error("Record2POM Studio has not finished initializing. Refresh and try again.");
   root.Record2POMStudio.setEvents(parsed.events);
   if(parsed.targetUrl){const url=document.getElementById("url");if(url)url.value=parsed.targetUrl;}
   const ignored=parsed.ignoredLines.length?" · "+parsed.ignoredLines.length+" unsupported line(s) ignored":"";
   status.textContent="Imported "+parsed.recognized+" action(s) from Playwright CRX"+ignored+". Review locators and values before generating.";
   status.dataset.state="success";
  }catch(error){status.textContent="Import failed: "+error.message;status.dataset.state="error";}
 });
}
})(typeof window!=="undefined"?window:globalThis);
