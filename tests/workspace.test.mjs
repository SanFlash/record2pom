import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

test("workspace module exposes test library, step editing, components and safe environment profiles", async()=>{
 const source=await readFile("workspace.js","utf8");
 assert.doesNotThrow(()=>new vm.Script(source));
 for(const token of ["record2pom_workspace_v1","wsCreateSuite","wsSaveTest","wsApplyStep","wsDuplicateStep","wsMoveUp","wsMoveDown","wsDeleteStep","wsSaveComponent","wsInsertComponent","wsCreateProfile","wsAddVariable","wsExportYaml","wsImportWorkspace"]) assert.ok(source.includes(token),token+" must be implemented");
 assert.match(source,/secret\?\{name,secret:true,envVar:name\}/);
 assert.match(source,/window\.Record2POMStudio\.setEvents/);\n assert.match(source,/suite\.replaceChildren/);\n assert.match(source,/const idMap=new Map/);\n assert.match(source,/copy\.sourceClickId=idMap\.get/);\n assert.match(source,/copy\.dataKey=String/);
});
