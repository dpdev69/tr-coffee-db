import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceVisit,parseProfile,profileWords} from '../src/components/v2/home-personal';
import {parseSaved,savedStatus,type SavedCoffee,type SavedItem} from '../src/components/coffee/saved-list';

test('the last visit advances only after a session ends, never on reloads within one',()=>{
  const t=Date.parse('2026-10-05T10:00:00Z'),min=60000;
  const first=advanceVisit('',t);assert.equal(first.previous,null,'a first visit has no previous visit');
  const reload=advanceVisit(first.next,t+10*min);assert.equal(reload.previous,null);
  const later=advanceVisit(reload.next,t+20*min);assert.equal(later.previous,null);
  const tomorrow=advanceVisit(later.next,t+86400000);assert.equal(tomorrow.previous,new Date(t+20*min).toISOString(),'the previous session ended at its last view');
  assert.equal(advanceVisit(tomorrow.next,t+86400000+5*min).previous,tomorrow.previous,'stays put within the new session');
  assert.equal(advanceVisit('{"lastSeen":"2099-01-01T00:00:00Z"}',t).previous,null,'future or junk values are ignored');
  assert.equal(advanceVisit('not json',t).previous,null);
});

test('saved entries are validated, deduplicated and capped; statuses compare the same package',()=>{
  assert.deepEqual(parseSaved('[{"slug":"../x","savedAt":"2026-10-01T00:00:00Z"},{"slug":"a","priceMinor":-1,"savedAt":"2026-10-01T00:00:00Z"},{"slug":"a","savedAt":"2026-10-02T00:00:00Z"}]').map(s=>[s.slug,s.priceMinor]),[['a',null]]);
  assert.equal(parseSaved(JSON.stringify(Array.from({length:80},(_,i)=>({slug:`s${i}`,savedAt:'2026-10-01T00:00:00Z'})))).length,50);
  assert.deepEqual(parseSaved('{oops'),[]);
  const saved:SavedCoffee={slug:'a',priceMinor:56000,weightG:250,currency:'TRY',inStock:true,savedAt:'2026-10-01T00:00:00Z'};
  const offer=(priceMinor:number,weightG=250,inStock:boolean|null=true)=>({id:`o${weightG}`,label:null,weightG,currency:'TRY',priceMinor,compareAtMinor:null,inStock,purchaseUrl:null});
  const item=(offers:ReturnType<typeof offer>[],availability:SavedItem['availability']='listed',restockedAt:string|null=null)=>({slug:'a',availability,restockedAt,coffee:{offers}} as unknown as SavedItem);
  assert.deepEqual(savedStatus(saved,item([offer(49000),offer(150000,1000)])),{kind:'drop',offer:offer(49000),before:56000});
  assert.equal(savedStatus(saved,item([offer(56000)])).kind,'same');
  assert.equal(savedStatus(saved,item([offer(60000)])).kind,'up');
  assert.equal(savedStatus(saved,item([offer(150000,1000)])).kind,'listed','another size gets no price verdict');
  assert.equal(savedStatus(saved,item([offer(56000)],'listed','2026-10-03T00:00:00Z')).kind,'restocked');
  assert.equal(savedStatus({...saved,inStock:false},item([offer(56000)])).kind,'restocked');
  assert.equal(savedStatus(saved,item([offer(56000,250,false)],'sold_out')).kind,'sold_out');
  assert.equal(savedStatus(saved,undefined).kind,'gone');
});

test('a taste profile from the quiz is read defensively and described in words',()=>{
  assert.equal(parseProfile(''),null);assert.equal(parseProfile('{"taste":[]}'),null);
  const profile=parseProfile('{"brew":["filter"],"taste":["Floral","fruity","<script>"],"roast":["light"],"process":[],"savedAt":"2026-10-05T00:00:00Z"}')!;
  assert.deepEqual(profile.taste,['Floral','fruity']);
  assert.equal(profileWords(profile),'çiçeksi, meyvemsi · açık kavrum · filtre / pour over');
});
