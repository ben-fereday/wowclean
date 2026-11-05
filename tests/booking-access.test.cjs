const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const compile = (file, mocks) => {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function("require","module","exports", output)(name => Object.hasOwn(mocks,name) ? mocks[name] : require(name),module,module.exports);
  return module.exports;
};
const access = compile("src/lib/booking-access.ts", {"server-only":{}});
const secret = "test-only-key-never-a-real-credential";
const id = "11111111-1111-4111-8111-111111111111";
const clock = Date.parse("2026-11-03T12:00:00Z");
const token = access.createBookingAccessToken(id,"2026-11-05",secret,clock);
assert.equal(access.verifyBookingAccessToken(token,secret,clock),id);
assert.equal(access.verifyBookingAccessToken(token,"different-key",clock),null);
const [payload,sig] = token.split(".");
const spoof = Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,"base64url")),id:"22222222-2222-4222-8222-222222222222"})).toString("base64url");
assert.equal(access.verifyBookingAccessToken(spoof+"."+sig,secret,clock),null,"cannot access another booking");
assert.equal(access.verifyBookingAccessToken(token,secret,Date.parse("2027-01-01T00:00:00Z")),null,"expired");
for(const bad of ["",null,123,"WOW-123456","x.y",token+".extra","a".repeat(10000)]) assert.equal(access.verifyBookingAccessToken(bad,secret,clock),null);
assert.throws(()=>access.createBookingAccessToken("WOW-123456","2026-11-05",secret,clock));
const originalFetch = global.fetch;
const originalSecret = process.env.SUPABASE_SECRET_KEY;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SECRET_KEY = secret;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

(async()=>{
 let reads=0, mails=0, sentEmail;
 const currentToken = access.createBookingAccessToken(id,"2099-11-05");
 const record = {id,reference_code:"WOW-TEST",guest_first_name:"Ben",guest_email:"test@example.com",booking_date:"2099-11-05",booking_time:"9:00 AM",status:"confirmed",total_estimate:250};
 global.fetch = async (url,options) => {
   reads++;
   assert.equal(options.headers.apikey,secret);
   assert.equal(options.headers.Authorization,undefined,"secret is not a JWT bearer");
   assert.equal(options.method,undefined,"read only");
   const query=new URL(url).searchParams;
   assert.equal(query.get("id"),"eq."+id,"lookup only the signed booking");
   assert.ok(!query.get("select").includes("notes"));
   assert.ok(!query.get("select").includes("booking_admin_details"));
   return {ok:true,json:async()=>[record]};
 };
 assert.equal(await access.readManagedBooking("invalid"),null);
 assert.equal(reads,0,"invalid tokens never query the database");
 const actions = compile("src/app/manage-booking/actions.ts",{
   "@/lib/booking-access": access,
   "@/lib/rate-limit":{checkRateLimit:()=>({allowed:true})},
   "@/lib/booking-schedule":{getCalgaryNow:()=>({date:"2026-11-03",minutes:600}),parseBookingTime:()=>540},
   resend:{Resend:class {emails={send:async(email,options)=>{mails++;sentEmail=email;assert.ok(options.idempotencyKey.startsWith("booking-change-"+id));return {data:{id:"test"},error:null};}}}},
 });
 const publicDetails = await actions.getManagedBooking(currentToken);
 assert.equal(publicDetails.guest_email,undefined);
 assert.equal(publicDetails.id,undefined);
 assert.equal(publicDetails.reference_code,"WOW-TEST");
 assert.equal((await actions.requestBookingChange(currentToken,"cancel","short")).success,undefined);
 assert.equal(mails,0,"invalid requests don't send");
 process.env.RESEND_API_KEY = "test-only";
 assert.equal((await actions.requestBookingChange(currentToken,"reschedule","Please move this to Friday.")).success,true);
 assert.equal(mails,1);
 assert.equal(sentEmail.replyTo,"test@example.com","reply goes to stored customer, not caller input");
 assert.ok(sentEmail.text.includes("The booking has not changed"));
 assert.ok(!sentEmail.text.includes(currentToken),"request emails don't disclose the access token");
 record.status="cancelled";
 assert.ok((await actions.requestBookingChange(currentToken,"cancel","Please cancel my appointment.")).error);
 assert.equal(mails,1,"inactive booking doesn't send");
 let inserted, bookingEmails=[];
 const bookingActions=compile("src/app/book/actions.ts",{
  "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:null}})},from:table=>({insert:async value=>{assert.equal(table,"bookings");inserted=value;return {error:null};}})})},
  "@/lib/constants":{...compile("src/lib/constants.ts",{"@/lib/booking-schedule":{ALL_TIME_SLOTS:[]}}),generateRefCode:()=>"WOW-TEST",applyDiscount:(value,pct)=>value*(1-pct/100)},
  "@/lib/promo-policy":{normalizeBookingEmail:value=>value.trim().toLowerCase()},
  "@/lib/availability":{checkTimeSlotAvailable:async()=>({available:true})},
  "@/lib/promo-codes":{},"@/lib/referrals":{},
  "@/lib/rate-limit":{checkRateLimit:()=>({allowed:true})},
  "@/lib/google-calendar":{syncBookingCalendar:async()=>({success:true})},
  "@/lib/booking-schedule":{getBookingDurationMinutes:()=>120},
  "@/lib/service-availability":{isServiceBookable:()=>true,isAddonBookable:()=>true},
  "@/lib/booking-access":access,
  resend:{Resend:class{emails={send:async email=>{bookingEmails.push(email);return {error:null};}}}},
 });
 const result=await bookingActions.createBooking({requirementsConfirmed:true,packageId:"standard",packageName:"Untrusted name",location:"mobile",serviceType:"interior",addons:[],email:"test@example.com",date:"2099-11-05",time:"9:00 AM",firstName:'<a href="https://evil.example">Test</a>',lastName:"Test",phone:"5870000000",address:"Test address",vehicleSize:"small",vehicleMake:"VW",vehicleModel:"GTI",vehicleColour:"Black",notes:"",basePrice:100,addonsTotal:0,estimatedTotal:100});
 assert.equal(result.success,true);
 assert.ok(result.manageUrl.startsWith("https://wowcleancalgary.com/manage-booking#token="));
 const generated=new URL(result.manageUrl).hash.slice(7);
 assert.equal(access.verifyBookingAccessToken(generated),inserted.id,"confirmation link opens exactly the newly inserted booking");
 assert.match(bookingEmails[0].html,/The Standard/);
 assert.doesNotMatch(bookingEmails[0].html,/Untrusted name/);
 assert.ok(bookingEmails[0].html.includes(result.manageUrl),"email contains the same management link as the success screen");
 assert.ok(!bookingEmails[0].html.includes('<a href="https://evil.example">'),"customer input cannot inject links into the email");
 let role="customer", signedIn=true;
 const adminActions=compile("src/app/admin/booking-tools-actions.ts",{
  "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:"staff"}:null}})},from:table=>({select:()=>({eq:()=>({single:async()=>({data:table==="profiles"?{role}:{id,booking_date:"2099-11-05"},error:null})})})})})},
  "next/cache":{},resend:{},"@/lib/booking-access":access,"@/lib/google-availability":{},"@/lib/google-calendar":{},"@/lib/booking-schedule":{},"@/lib/admin-booking":{},"@/lib/constants":{},
 });
 await assert.rejects(()=>adminActions.getBookingManageLink(id),/Admin access/);
 signedIn=false;
 await assert.rejects(()=>adminActions.getBookingManageLink(id),/Sign in/);
 signedIn=true;role="owner";
 const adminLink=await adminActions.getBookingManageLink(id);
 assert.equal(access.verifyBookingAccessToken(new URL(adminLink).hash.slice(7)),id,"only staff can generate replacement links");
 global.fetch=originalFetch;
 if(originalSecret===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=originalSecret;
 if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl;
 console.log("Booking link verification, tampering, expiry, scoped reads, private-field exclusion and request-flow checks passed.");
 for(const file of ["src/lib/booking-access.ts","src/app/manage-booking/actions.ts","src/app/manage-booking/page.tsx","src/app/manage-booking/manage-booking.tsx","src/app/book/actions.ts","src/app/book/page.tsx","src/app/admin/booking-tools-actions.ts","src/app/admin/booking-admin-tools.tsx","src/components/layout/navbar.tsx","src/components/layout/footer.tsx"]){
  const result=ts.transpileModule(fs.readFileSync(path.join(root,file),"utf8"),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
  assert.deepEqual((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[],file);
 }
 console.log("All changed TypeScript and TSX syntax checks passed.");
})().catch(error=>{global.fetch=originalFetch;console.error(error);process.exitCode=1;});

