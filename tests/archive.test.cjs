const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname,"..");
require.extensions[".ts"] = (module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
const {filterAppointmentHistory:filter}=require("../src/lib/admin-history.ts");
const filters={search:"",range:"all",from:"",to:"",status:"all",payment:"all"};
const record={id:"11111111-1111-4111-8111-111111111111",booking_date:"2026-04-30",booking_time:"12:00 PM",status:"confirmed",reference_code:"WOW-TEST",archived_at:"2026-11-03T20:00:00Z"};
const now={date:"2026-11-03",minutes:600};
assert.deepEqual(filter([record],new Map(),filters,now),[]);
assert.equal(filter([record],new Map(),{...filters,showArchived:true},now).length,1);
assert.equal(filter([{...record,archived_at:null}],new Map(),filters,now).length,1);
assert.equal(record.status,"confirmed","archive visibility never changes status");

let role="customer",user={id:"staff"},date="2026-04-30",writes=[];
const client={auth:{getUser:async()=>({data:{user}})},from:table=>({
 select:()=>({eq:()=>({single:async()=>({data:table==="profiles"?{role}:{booking_date:date,booking_time:"12:00 PM"},error:null})})}),
 upsert:async(data,options)=>{writes.push({table,operation:"archive",data,options});return {error:null};},
 delete:()=>({eq:async(column,id)=>{writes.push({table,operation:"restore",column,id});return {error:null};}}),
})};
const moduleObject={exports:{}};
const output=ts.transpileModule(fs.readFileSync(root+"/src/app/admin/history-actions.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
new Function("require","module","exports",output)(name=>{
 if(name==="@/lib/supabase/server")return {createClient:async()=>client};
 if(name==="@/lib/booking-schedule")return {getCalgaryNow:()=>now,parseBookingTime:()=>720};
 throw Error("Unexpected dependency: "+name);
},moduleObject,moduleObject.exports);
const {setAppointmentArchived:set}=moduleObject.exports;
(async()=>{
 await assert.rejects(()=>set(record.id,true),/Admin access/);
 user=null;
 await assert.rejects(()=>set(record.id,true),/Sign in/);
 user={id:"staff"};role="owner";date="2026-11-04";
 await assert.rejects(()=>set(record.id,true),/Only past/);
 assert.equal(writes.length,0);
 date="2026-04-30";
 const archived=await set(record.id,true);
 assert.ok(archived.archivedAt);
 assert.equal(writes[0].table,"booking_admin_archives");
 assert.equal(writes[0].data.archived_by,"staff");
 assert.equal(writes[0].options.ignoreDuplicates,true);
 assert.equal((await set(record.id,false)).archivedAt,null);
 assert.equal(writes[1].table,"booking_admin_archives");
 assert.equal(writes[1].operation,"restore");
 assert.equal(writes[1].id,record.id);
 for(const file of ["src/lib/admin-history.ts","src/app/admin/history-actions.ts","src/app/admin/appointment-history.tsx"]){
   const result=ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
   assert.deepEqual((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[],file);
 }
 console.log("Archive visibility, restore, staff authorization, future-booking guard and metadata-only mutation checks passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
