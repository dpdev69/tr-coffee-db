import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanCoffeeName, declaredDecaf, truthfulFeatures, truthfulMetadata } from '../shared/v2/profile-truth';
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
test('glued storefront labels and prose never become profile facts; repair is idempotent',()=>{
  const cases:[Partial<Record<'country'|'region'|'producer'|'farm'|'altitude'|'process'|'roast',string>>,Record<string,string|undefined>][]=[
    [{process:'Doğal / NaturalYükselik: 1500-1900m'},{process:'Doğal / Natural'}],
    [{process:'Washed Menşei: El Salvador'},{process:'Washed'}],
    [{altitude:'1.280 mStory’de tazelikPazartesi, salı ve cuma günleri kavuruyoruz.'},{altitude:'1.280 m'}],
    [{altitude:'1.600 m İşlem Türü: Washed AB FAQ'},{altitude:'1.600 m'}],
    [{altitude:'2150 - 2200Cupping Score: 87,5'},{altitude:'2150 - 2200'}],
    [{altitude:'1800M'},{altitude:'1800M'}],
    [{region:'Rift Valley Varteye:SL28, SL34'},{region:'Rift Valley'}],
    [{region:'Kirinyaga – Embu / Mount Kenya Lot: 12-25-87'},{region:'Kirinyaga – Embu / Mount Kenya'}],
    [{region:'Yirgacheffeİşlem Metodu: Washed'},{region:'Yirgacheffe'}],
    [{farm:'SunsetTür. : Çeşitli'},{farm:'Sunset'}],
    [{producer:'Santiago Noriega10 Ekim 2021\'de kurulan Finca Cultivares'},{producer:'Santiago Noriega'}],
    [{roast:'Orta · Asidite: DengeliGövde: Orta'},{roast:'Orta'}],
    [{roast:'Orta-AçıkTat Notları: Raspberry, Rose'},{roast:'Orta-Açık'}],
    [{process:'Yarı Yıkanmış Asidite: Orta – Düşük'},{process:'Yarı Yıkanmış'}],
    [{farm:'Finca El Cerro Finca El Cerro çiftliği beş nesildir El Salvadorlu kahve üreticilerinin mirasıdır.'},{farm:undefined}],
    [{region:'Sidama Bensa',process:'Doğal (Natural) · PB / Peaberry'},{region:'Sidama Bensa',process:'Doğal (Natural) · PB / Peaberry'}],
  ];
  for(const [input,expected] of cases){
    const repaired=truthfulMetadata(input,'Coffee');
    for(const [key,value] of Object.entries(expected))assert.equal(repaired[key as keyof typeof repaired],value,JSON.stringify(input));
    assert.deepEqual(truthfulMetadata(repaired,'Coffee'),repaired,'idempotent');
  }
});
test('coffee names decode storefront entities and drop promo prefixes',()=>{
  assert.equal(cleanCoffeeName('Rwanda &#8211; Gisanga'),'Rwanda – Gisanga');
  assert.equal(cleanCoffeeName('YENİ &#8211; BREZİLYA FAZENDA INES ANAEROBİK'),'BREZİLYA FAZENDA INES ANAEROBİK');
  assert.equal(cleanCoffeeName('Brazil  Capadocia &amp; Co &#x2019;s'),'Brazil Capadocia & Co ’s');
  assert.equal(cleanCoffeeName('Yeni Gine Elimbari'),'Yeni Gine Elimbari','"Yeni" without a separator is part of the name');
  assert.equal(cleanCoffeeName('&#0;'),'&#0;');
});

const derive=(name:string,description:string,roaster='Test Roastery',raw:Record<string,unknown>={})=>Object.fromEntries(deriveProfileFeatures(profileInput({description,...raw},name,'https://shop.test/p','id',description,roaster)).map(f=>[f.feature,f.value]));
test('origin, process and variety are arrays of every stated value (failures 4, 5)',()=>{
  const values=derive('Rwanda – Shyira Natural Anaerobic','Menşei: Ruanda. Varyete: Red Bourbon, Caturra.');
  assert.deepEqual(values.normalized_origin,['Rwanda']);
  assert.deepEqual(values.process_family,['anaerobic','natural']);
  assert.deepEqual(values.normalized_variety,['Bourbon','Caturra']);
  assert.deepEqual(derive('Italiano Espresso Kahve Harmanı','Italiano Espresso Menşei: Brezilya, Etiyopya Italiano Espresso, Brezilya ve Etiyopya’nın özenle seçilmiş çekirdekleri.').normalized_origin,['Brazil','Ethiopia']);
});
test('the roaster name and ordinary Turkish words are not varieties (failure 1)',()=>{
  const bread=derive('Ekşi Maya Tam Çavdar Ekmeği','Old Java Coffee Roasters fırınından.','Old Java Coffee Roasters');
  assert.equal(bread.normalized_variety,undefined);
  assert.equal(derive('Cafec Traditional Filtre Kağıdı','Tabi ki her V60 ile uyumludur.').normalized_variety,undefined);
  assert.equal(derive('Peru Finca Rosenheim','Kahve ağaçları yerel ve yeniden ormanlandırılmış ağaçların gölgesinde büyüyor.').normalized_variety,undefined);
});
test('without a tasting section running prose gives no everyday-word notes; a section keeps them (failure 2)',()=>{
  const prose=derive('Kolombiya Filtre','Roast Date 2026. Tatlı ve parlak bir kahve, bal gibi.',undefined,{tags:'Kahve,Nitelikli Kahve,reklam,3al2öde,Fresh Roasted'});
  assert.equal(prose.flavor_notes_normalized,undefined);
  assert.equal(prose.flavor_families,undefined);
  const section=derive('Kolombiya Filtre','<h3>Bu kahve nasıl bir tada sahiptir?</h3><p>Bal, karamel.</p><h3>Diğer</h3><p>Roast Date.</p>');
  assert.deepEqual(section.flavor_notes_normalized,['Caramel','Honey']);
});
test('roast comes only from a roast label, never from brew words (failure 6)',()=>{
  assert.equal(derive('Filtre Kahve / Kolombiya','Espresso ve filtre için uygundur.',undefined,{product_type:'Filtre Kahve'}).roast_classification,undefined);
  assert.equal(derive('Filtre Kahve / Kolombiya','Kavrum: Orta.').roast_classification,'medium');
});
test('a word of a process or variety phrase is not a tasting note; a tasting section keeps it',()=>{
  // Mayard and Coffee Sapiens, 2026-10-05: honey is the process, Orange Bourbon the variety; the pages list other notes.
  for(const name of ['Costa Rica El Mango "Full Honey Anaerobic"','Colombia LA Sirena "Honey Peach"','Indonesia Liberica "Honey Mosto"','Costa Rica Las Torres "Full Anaerobic Honey"'])
    assert.ok(!(derive(name,'').flavor_notes_normalized as string[]|undefined)?.includes('Honey'),name);
  const gigi=derive('INDONESIA MAS IYAN GIGI MANIS','Gunung Suket\'teki 1.700 metrelik bahçesinde Orange Bourbon kirazlarını 120 saatlik anaerobik fermantasyondan geçiriyor.\nLezzet Notları: Nar, kiraz, naşi armudu, tatlı şekerleme.');
  assert.deepEqual(gigi.flavor_notes_normalized,['Cherry']);
  assert.deepEqual(gigi.normalized_variety,['Bourbon']);
  assert.equal(derive('Colombia – Santa Monica Honey + Wine Yeast / Lulo','').flavor_notes_normalized,undefined);
  assert.deepEqual(derive('Kolombiya','<h3>Tadım Notları</h3><p>Honey, orange.</p>').flavor_notes_normalized,['Orange','Honey']);
});
