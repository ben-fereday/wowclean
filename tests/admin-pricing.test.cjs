/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function compile(file,mocks={}) {
  const compiled={exports:{}};
  const output=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',output)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),compiled,compiled.exports);
  return compiled.exports;
}
const model=compile('src/lib/admin-pricing.ts');
const constants=compile('src/lib/constants.ts',{'@/lib/booking-schedule':{ALL_TIME_SLOTS:[]}});
const fixture=()=>({booking:structuredClone(constants.PRICING),subscription:structuredClone(constants.SUBSCRIPTION_PRICING),addons:[
  {id:'pet_hair',name:'Pet Hair Removal',price:30,active:true,sort_order:1},
  {id:'salt',name:'Heavy Salt / Sand Cleanup',price:30,active:false,sort_order:2},
]});
function actions(fail=()=>false) {
  const calls=[];
  return {calls,api:Object.fromEntries(['updateBookingPrice','updateSubscriptionPrice','updateAddonItem','addAddonItem','deleteAddonItem'].map(name=>[name,async(...args)=>{
    calls.push([name,...args]);
    return fail(name,args)?{error:'Test failure'}:{success:true};
  }]))};
}

test('all 18 booking prices and 12 subscription prices retain their exact keys, values and save arguments',async()=>{
  const baseline=fixture(),draft=model.pricingDraft(baseline),mock=actions();
  const expectedBooking={standard:[[100,70,165],[130,85,195],[150,100,225]],premium:[[160,110,250],[190,130,295],[220,155,335]]};
  const expectedSub=[[130,155,180],[145,170,195],[155,185,215],[200,245,295]];
  let bookingCount=0,subCount=0;
  for(const pkg of model.PRICING_PACKAGES)for(const [i,size]of model.PRICING_SIZES.entries())for(const [j,service]of model.PRICING_SERVICES.entries()){
    assert.equal(draft.booking[pkg][size][service],String(expectedBooking[pkg][i][j]));
    draft.booking[pkg][size][service]=String(expectedBooking[pkg][i][j]+7);bookingCount++;
  }
  for(const [i,{plan,pkg}]of model.PRICING_SUBSCRIPTIONS.entries())for(const [j,size]of model.PRICING_SIZES.entries()){
    assert.equal(draft.subscription[plan][pkg][size],String(expectedSub[i][j]));
    draft.subscription[plan][pkg][size]=String(expectedSub[i][j]+9);subCount++;
  }
  assert.equal(bookingCount,18);assert.equal(subCount,12);
  assert.deepEqual(model.pricingChanges(baseline,model.pricingDraft(baseline)),{changes:[],errors:[]});
  const {changes,errors}=model.pricingChanges(baseline,draft);assert.deepEqual(errors,[]);assert.equal(changes.length,30);
  const result=await model.savePricingChanges(changes,mock.api);assert.equal(result.saved.length,30);assert.deepEqual(result.failed,[]);
  for(const change of changes){assert.ok(mock.calls.some(call=>JSON.stringify(call)===JSON.stringify(change.kind==='booking'
    ?['updateBookingPrice',change.pkg,change.size,change.service,change.price]
    :['updateSubscriptionPrice',change.plan,change.pkg,change.size,change.price])));}
  assert.ok(!mock.calls.some(call=>call.includes('exclusive')));
  assert.equal(baseline.booking.standard.small.interior,100,'original remains unchanged');
});

test('reverting cancels edits; blanks, decimals, negatives, non-finite, overflow and missing prices cannot become zero writes',()=>{
  const baseline=fixture();
  for(const invalid of ['', ' ', '-1', '1.25','Infinity','NaN','2147483648']){
    const draft=model.pricingDraft(baseline);draft.booking.standard.small.interior=invalid;
    const result=model.pricingChanges(baseline,draft);assert.ok(result.errors.length);assert.equal(result.changes.length,0);
  }
  const draft=model.pricingDraft(baseline);draft.booking.standard.small.interior='0';
  assert.equal(model.pricingChanges(baseline,draft).changes[0].price,0);
  delete baseline.booking.standard.small.full;
  assert.ok(model.pricingChanges(baseline,model.pricingDraft(baseline)).errors.some(e=>e.includes('Missing')));
});

test('add-on changes use Calgary IDs and existing actions, with no calls until confirmed',async()=>{
  const baseline=fixture(),draft=model.pricingDraft(baseline),mock=actions();
  draft.addons[0].price='45';draft.addons[0].active=false;draft.addons[1].deleted=true;
  const id=model.addonId(' Headlight Restoration! ');assert.equal(id,'headlight_restoration');
  draft.addons.push({id,name:'Headlight Restoration!',price:'80',active:true,sort_order:3});
  const {changes,errors}=model.pricingChanges(baseline,draft);assert.deepEqual(errors,[]);assert.deepEqual(mock.calls,[]);
  const result=await model.savePricingChanges(changes,mock.api);assert.equal(result.saved.length,3);
  assert.deepEqual(mock.calls,[['updateAddonItem','pet_hair',{price:45,active:false}],['deleteAddonItem','salt'],['addAddonItem',{id,name:'Headlight Restoration!',price:80}]]);
  const saved=model.savedPricingBaseline(baseline,result.saved);
  assert.deepEqual(saved.addons.map(a=>[a.id,a.price,a.active]),[['pet_hair',45,false],[id,80,true]]);
  assert.deepEqual(model.pricingChanges(saved,model.pricingDraft(saved)).changes,[]);
  assert.deepEqual(model.pricingDraft(baseline).addons.map(a=>[a.id,a.price,a.active]),[['pet_hair','30',true],['salt','30',false]]);
});

test('partial saves and thrown failures retain only failed operations for retry',async()=>{
  const baseline=fixture(),draft=model.pricingDraft(baseline);
  draft.booking.standard.small.interior='105';draft.addons[0].active=false;
  draft.addons.push({id:'new',name:'New',price:'40',active:true,sort_order:3});
  const mock=actions(name=>name==='updateAddonItem');
  mock.api.updateBookingPrice=async()=>{throw Error('Network failure');};
  const result=await model.savePricingChanges(model.pricingChanges(baseline,draft).changes,mock.api);
  assert.equal(result.saved.length,1);assert.equal(result.failed.length,2);
  const next=model.savedPricingBaseline(baseline,result.saved);
  const retry=model.pricingChanges(next,draft);assert.equal(retry.changes.length,2);
  assert.ok(!retry.changes.some(c=>c.kind==='addon-create'),'do not recreate successful add-on');
  const retried=actions();await model.savePricingChanges(retry.changes,retried.api);
  assert.equal(retried.calls.length,2);assert.equal(next.booking.standard.small.interior,100);
});

test('admin grid excludes Exclusive without removing shared data or altering loaders/actions',()=>{
  const source=fs.readFileSync(path.join(root,'src/app/admin/pricing/page.tsx'),'utf8');
  assert.deepEqual(model.PRICING_PACKAGES,['standard','premium']);
  assert.ok(!source.toLowerCase().includes('exclusive'));
  for(const label of ['One-time booking prices','Add-ons','Subscription prices','Revert unsaved edits','Save Calgary pricing'])assert.ok(source.includes(label));
  assert.equal(source.includes('localStorage'),false);
});
