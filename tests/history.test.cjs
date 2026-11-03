const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, path) => module._compile(ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, path);
const { filterAppointmentHistory: filter, historyName } = require("../src/lib/admin-history.ts");
const defaults = { search: "", range: "all", from: "", to: "", status: "all", payment: "all" };
const now = { date: "2026-11-03", minutes: 1080 };
const booking = (id, date, time, status = "confirmed") => ({ id, booking_date: date, booking_time: time, status, guest_first_name: "Ben", guest_last_name: "F", reference_code: "WOW-" + id, guest_phone: "5870000000" });
const records = [booking("a","2026-11-02","9:00 AM"),booking("b","2026-11-02","2:00 PM","completed"),booking("c","2026-11-03","8:00 AM","cancelled"),booking("d","2026-11-03","7:00 PM"),booking("e","2026-11-04","9:00 AM"),booking("f","2026-09-01","9:00 AM","no_show")];
const payments = new Map([["b", { booking_id:"b",payment_status:"paid",final_amount:0 }]]);
const run = overrides => filter(records,payments,{...defaults,...overrides},now).map(b=>b.id);
assert.deepEqual(run({}), ["c","b","a","f"], "past times only, latest date and actual PM time first");
assert.deepEqual(run({status:"confirmed"}),["a"],"confirmed remains awaiting completion");
assert.equal(records[0].status,"confirmed","filter never mutates status");
assert.deepEqual(run({payment:"paid"}),["b"]);
assert.deepEqual(run({payment:"unpaid"}),["c","a","f"],"missing payment record is unpaid");
assert.deepEqual(run({range:"30"}),["c","b","a"]);
assert.deepEqual(run({range:"custom",from:"2026-11-02",to:"2026-11-02"}),["b","a"],"custom dates inclusive");
assert.deepEqual(run({range:"custom",from:"2026-11-03",to:"2026-11-01"}),[]);
assert.deepEqual(run({search:" wow-B "}),["b"],"reference search normalized");
assert.deepEqual(run({search:"587000"}),["c","b","a","f"]);
assert.equal(historyName({...records[0],profiles:{first_name:"Registered",last_name:"Customer"}}),"Registered Customer");
console.log("11 appointment history checks passed.");
for (const path of ["src/app/admin/page.tsx","src/app/admin/appointment-history.tsx","src/app/admin/history-actions.ts","src/lib/admin-history.ts"]) {
 const result = ts.transpileModule(fs.readFileSync(__dirname+"/../"+path,"utf8"), { compilerOptions: {jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path });
 const errors = (result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,path+": "+errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("\n"));
}
console.log("Changed TypeScript and TSX syntax checks passed.");
