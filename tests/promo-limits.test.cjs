const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
function compile(file,mocks={}) {
 const module={exports:{}};
 const output=ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function("require","module","exports",output)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),module,module.exports);
 return module.exports;
}
const policy=compile("src/lib/promo-policy.ts");
assert.equal(policy.normalizeBookingEmail("  Test@Example.com "),"test@example.com");
assert.equal(policy.isPromoUsageLimit("single_use"),true);
assert.equal(policy.isPromoUsageLimit("account"),false);
let previewArgs,inserted,insertError,calendarCalls=0,emailCalls=0;
const validation=compile("src/lib/promo-codes.ts",{
 "@/lib/supabase/server":{createClient:()=>{throw Error("Booking validation must not use an account");}},
 "@/lib/promo-preview":{previewBookingPromo:async(...args)=>{previewArgs=args;return {valid:true,code_id:"offer",code_text:args[0],discount_pct:15};}},
 "@/lib/promo-policy":policy,
 "@/lib/rate-limit":{checkRateLimit:()=>({allowed:true})},
});
const payload={requirementsConfirmed:true,vehicleSize:"small",serviceType:"interior",packageId:"standard",packageName:"The Standard",addons:[],date:"2099-01-01",time:"8:00 AM",location:"mobile",firstName:"Test",lastName:"Guest",phone:"5870000000",email:"  Test@Example.invalid ",address:"Test",vehicleMake:"VW",vehicleModel:"GTI",vehicleColour:"Black",notes:"",basePrice:100,addonsTotal:0,estimatedTotal:85,promoCode:"FIRST"};
const book=compile("src/app/book/actions.ts",{
 "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:null}})},from:table=>({insert:async value=>{assert.equal(table,"bookings");inserted=value;return {error:insertError};}})})},
 "@/lib/constants":{generateRefCode:()=>"WOW-QA",applyDiscount:(v,p)=>Math.round(v*(1-(p||0)/100))},
 "@/lib/availability":{checkTimeSlotAvailable:async()=>({available:true})},
 "@/lib/promo-codes":validation,"@/lib/promo-policy":policy,"@/lib/referrals":{},
 "@/lib/rate-limit":{checkRateLimit:()=>({allowed:true})},
 "@/lib/booking-access":{bookingManageUrl:()=>"https://example.invalid/manage"},
 "@/lib/google-calendar":{syncBookingCalendar:async()=>{calendarCalls++;return {success:true};}},
 "@/lib/booking-schedule":{getBookingDurationMinutes:()=>120},
 "@/lib/service-availability":{isServiceBookable:()=>true,isAddonBookable:()=>true},
 resend:{Resend:class{emails={send:async()=>{emailCalls++;return {error:null};}}}},
});
const originalFetch=global.fetch;
(async()=>{
 assert.equal((await validation.validatePromoCode(" first ","booking",null,"Test@Example.invalid")).valid,true);
 assert.deepEqual(previewArgs,["FIRST","Test@Example.invalid"]);
 assert.equal((await validation.validatePromoCode("<invalid>","booking",null,"a@example.invalid")).valid,false);
 insertError={code:"P0001",message:"PROMO: This email address has already used this code."};
 assert.equal((await book.createBooking(payload)).error,"This email address has already used this code.");
 assert.equal(calendarCalls,0);assert.equal(emailCalls,0,"failed save must not send confirmation");
 insertError=null;
 assert.equal((await book.createBooking(payload)).success,true);
 assert.equal(inserted.guest_email,"test@example.invalid");
 assert.equal(inserted.total_estimate,85);
 assert.equal(inserted.promo_discount_pct,15);
 assert.equal(calendarCalls,1);
 assert.deepEqual(previewArgs,["FIRST","test@example.invalid"],"save validates the entered booking email, independent of login");
 let adminRole="customer",written;
 const adminClient={auth:{getUser:async()=>({data:{user:{id:"staff"}}})},from:table=>({
  select:()=>({eq:()=>({single:async()=>({data:{role:adminRole}})})}),
  insert:async value=>{written=value;return {error:null};},
  update:value=>({eq:async()=>{written=value;return {error:null};}}),
 })};
 const admin=compile("src/app/admin/actions.ts",{
  "@/lib/supabase/server":{createClient:async()=>adminClient},"next/cache":{revalidatePath:()=>{}},resend:{},"@/lib/google-calendar":{},"@/lib/admin-booking":{},"@/lib/promo-policy":policy,
 });
 const offer={code:"TEST",discount_pct:15,scope:"booking",usage_limit:"single_use",active:true};
 await assert.rejects(()=>admin.createPromoCode(offer),/Unauthorized/);
 adminRole="owner";
 assert.equal((await admin.createPromoCode(offer)).success,true);
 assert.equal(written.usage_limit,"single_use");
 assert.equal(written.max_uses_per_user,null);
 assert.ok((await admin.createPromoCode({...offer,usage_limit:"invalid"})).error);
 assert.ok((await admin.createPromoCode({...offer,discount_pct:NaN})).error);
 assert.ok((await admin.updatePromoCode("offer",{usage_limit:"invalid"})).error);
 assert.equal((await admin.updatePromoCode("offer",{usage_limit:"once_per_email"})).success,true);
 assert.equal(written.usage_limit,"once_per_email");
 assert.equal(written.max_uses_per_user,null);
 const preview=compile("src/lib/promo-preview.ts",{"server-only":{},"./promo-policy":policy});
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";
 process.env.SUPABASE_SECRET_KEY="test-only-dummy-key";
 global.fetch=async(url,options)=>{
   assert.equal(url,"https://example.supabase.co/rest/v1/rpc/preview_booking_promo");
   assert.equal(options.headers.Authorization,undefined);
   assert.equal(options.headers.apikey,"test-only-dummy-key");
   assert.deepEqual(JSON.parse(options.body),{p_code:"FIRST",p_email:"test@example.invalid"});
   return {ok:true,json:async()=>({valid:true,code_text:"FIRST",discount_pct:15})};
 };
 assert.equal((await preview.previewBookingPromo("FIRST"," Test@Example.invalid ")).valid,true);
 global.fetch=async()=>({ok:false});
 assert.equal((await preview.previewBookingPromo("FIRST","test@example.invalid")).valid,false);
 global.fetch=originalFetch;
 for(const file of ["src/app/admin/page.tsx","src/app/admin/actions.ts","src/app/book/page.tsx","src/app/book/actions.ts","src/lib/promo-codes.ts","src/lib/promo-policy.ts","src/lib/promo-preview.ts"]){
  const result=ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
  assert.deepEqual((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[],file);
 }
 console.log("Guest promo validation, normalized email, save-time rejection, discount snapshot and server-only preview checks passed.");
})().catch(error=>{global.fetch=originalFetch;console.error(error);process.exitCode=1;});
