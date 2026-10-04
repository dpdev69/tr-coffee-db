import assert from 'node:assert/strict';
import test from 'node:test';
import { declaredDecaf, truthfulFeatures, truthfulMetadata } from '../shared/v2/profile-truth';
import { deriveProfileFeatures, profileInput } from '../scrapers/src/v2/profile';
import { matchFlavorNotes } from '../scrapers/src/normalization/flavor-map';
import { plainHtml } from '../scrapers/src/v2/primitives';
import { parseShopifyPage } from '../scrapers/src/v2/parsers';
import type { RoasterConfig } from '../scrapers/src/types';

const tetraDescription='Tadım Notu: esmer şeker,kuru üzüm,erikÜlke: BrezilyaBölge: Cerradoİşlem: Gün KurusuTür: Yellow bourbonYükseklik: 1200mHasat Yılı: 2025';

test('Tetra source labels repair collapsed archived descriptions without guessing missing facts',()=>{
  const raw={description:tetraDescription,tastingNotes:['Grape','Sweet','Brown Sugar']};
  const repaired=truthfulMetadata(raw,'DULCEFAZENDA');
  assert.equal(repaired.country,'Brezilya');assert.equal(repaired.region,'Cerrado');
  assert.equal(repaired.altitude,'1200m');assert.equal(repaired.process,'Gün Kurusu');
  assert.deepEqual(repaired.varieties,['Yellow bourbon']);assert.equal(repaired.harvestYear,'2025');
  assert.deepEqual(repaired.tastingNotes,['esmer şeker','kuru üzüm','erik']);
  assert.equal(repaired.producer,undefined);assert.equal(repaired.farm,undefined);assert.equal(repaired.roastDate,undefined);
  assert.match(repaired.description!,/erik\nÜlke: Brezilya\nBölge: Cerrado/);
  assert.deepEqual(truthfulMetadata(repaired,'DULCEFAZENDA'),repaired);
  assert.equal(raw.description,tetraDescription,'source archive remains unchanged');
  assert.equal(truthfulMetadata({description:tetraDescription.replaceAll(' ','')},'DULCEFAZENDA').harvestYear,'2025');
});
test('declared profile extraction preserves structured values and never infers profile facts from prose',()=>{
  const raw=truthfulMetadata({country:'Colombia',region:'Huila',varieties:['Caturra'],description:'Ülke: Brezilya\nBölge: Cerrado\nTür: Yellow bourbon'},'Coffee');
  assert.equal(raw.country,'Colombia');assert.equal(raw.region,'Huila');assert.deepEqual(raw.varieties,['Caturra']);
  const unknown=truthfulMetadata({description:'Brezilya Cerrado Yellow bourbon 1200m, fresh 2025 crop. Tür: Arabica'},'Coffee');
  assert.equal(unknown.country,undefined);assert.equal(unknown.region,undefined);assert.equal(unknown.altitude,undefined);assert.equal(unknown.harvestYear,undefined);assert.equal(unknown.varieties,undefined);
});
test('HTML paragraphs retain boundaries and generic adapter intake persists explicit roaster metadata',()=>{
  const html='<p>Tadım Notu: esmer şeker,kuru üzüm,erik</p><p>Ülke: Brezilya</p><p>Bölge: Cerrado</p><p>İşlem: Gün Kurusu</p><p>Tür: Yellow bourbon</p><p>Yükseklik: 1200m</p><p>Hasat Yılı: 2025</p>';
  assert.match(plainHtml(html),/erik\nÜlke: Brezilya/);
  assert.equal(plainHtml('<p>Kahve <strong>açıklaması</strong>.</p><p>İkinci satır.<br>Üçüncü satır.</p>'),'Kahve açıklaması.\nİkinci satır.\nÜçüncü satır.');
  const config:RoasterConfig={slug:'test',name:'Test',websiteUrl:'https://example.test',shopUrl:'https://example.test',platform:'shopify',city:'Unknown',priceFormat:'tl'};
  const product=parseShopifyPage({products:[{id:1,title:'DULCEFAZENDA',handle:'dulcefazenda',body_html:html,product_type:'Coffee',tags:[],variants:[{id:2,title:'250 g',price:'500',available:true}],images:[]}]},config)[0];
  assert.equal(product.rawMetadata.region,'Cerrado');assert.equal(product.rawMetadata.altitude,'1200m');
  assert.deepEqual(product.rawMetadata.varieties,['Yellow bourbon']);assert.equal(product.rawMetadata.harvestYear,'2025');
  assert.deepEqual(product.rawMetadata.tastingNotes,['esmer şeker','kuru üzüm','erik']);
});

test('explicit decaf negation wins; ordinary coffee without a statement remains unknown',()=>{
  assert.equal(declaredDecaf('KIRYAMA','Ancak resmi “decaf” sınıfında değil.'),false);
  assert.equal(declaredDecaf('Coffee','This coffee is not decaf.'),false);
  assert.equal(declaredDecaf('Colombia Decaf'),true);
  assert.equal(declaredDecaf('Colombia'),null);
  assert.equal(truthfulMetadata({description:'Ancak resmi “decaf” sınıfında değil.'},'KIRYAMA').decaf,false);
});
test('category labels are not tasting notes and lexical substrings cannot become Rum or Leather',()=>{
  assert.deepEqual(truthfulMetadata({tastingNotes:['Filtre Kahve','Kahve','Nitelikli kahve','Çekirdek Kahve','Ahududu']},'Coffee').tastingNotes,['Ahududu']);
  assert.deepEqual(matchFlavorNotes('Kavrum ve derinlik',true).notes,[]);
  assert.ok(matchFlavorNotes('Rum and leather',true).notes.includes('Rum'));
  assert.ok(matchFlavorNotes('Rom, deri',true).notes.includes('Leather'));
  assert.deepEqual(truthfulFeatures([{feature:'flavor_notes_normalized',value:['Rum','Leather','Plum'],sourceType:'RULE_INFERRED',confidence:null,version:'old'}],{description:'Kavrum derinliği erik notaları'}).map(f=>f.value),[['Plum']]);
});
test('source taste and brew sections avoid grinding-option and generic varietal contamination',()=>{
  const description='<h3>Bu kahve nasıl bir tada sahiptir?</h3><p>Erik, akçaağaç, kırmızı meyveler.</p><h3>Nasıl demlemeli?</h3><p>V60, Aeropress.</p><h3>Diğer bilgiler</h3><p>Espresso, French press, kavrum ve derinlik. Ancak resmi “decaf” sınıfında değil.</p>';
  const input=profileInput({description,attributes:[{name:'Öğütme',terms:[{name:'Espresso'},{name:'Türk Kahvesi'}]}]},'KIRYAMA','https://shop.test/kiryama','id','Erik. Ancak resmi “decaf” sınıfında değil.');
  const features=deriveProfileFeatures(input);const values=Object.fromEntries(features.map(f=>[f.feature,f.value]));
  assert.deepEqual(values.brew_compatibility,['filter','aeropress']);
  assert.equal(values.is_decaf,false);assert.ok((values.flavor_notes_normalized as string[]).includes('Plum'));
  assert.ok(!(values.flavor_notes_normalized as string[]).includes('Rum'));
});
