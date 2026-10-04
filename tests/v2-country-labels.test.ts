import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalCountry,countryLabel,countryOptions,countryFilterAliases} from '../shared/v2/country-labels';
import {coffeeOrigin,coffeeProcess} from '../src/components/v2/discovery-card';
import type {CatalogCoffee} from '../shared/v2/catalog';

test('country dropdown collapses exact translations to canonical values and Turkish labels',()=>{
  assert.deepEqual(countryOptions(['Brazil','Brezilya','Colombia','Kolombiya','Ethiopia','Etiyopya','unknown']),[
    {value:'Brazil',label:'Brezilya'},{value:'Ethiopia',label:'Etiyopya'},{value:'Colombia',label:'Kolombiya'},
  ]);
  assert.equal(canonicalCountry('BREZİLYA'),'Brazil');assert.equal(countryLabel('Brazil'),'Brezilya');
  for(const unchanged of ['Gesha','Yunnan','Brazil Cerrado','Unknown origin'])assert.equal(canonicalCountry(unchanged),unchanged);
  assert.ok(countryFilterAliases(['Brazil']).includes('Brezilya'));
  assert.deepEqual(countryFilterAliases(["Brazil%' OR 1=1"]),["Brazil%' OR 1=1"]);
});
test('card translations are case insensitive labels without mutating declared source facts',()=>{
  const coffee={rawMetadata:{country:'Brazil',process:'Washed'},features:[]}as unknown as CatalogCoffee;
  assert.equal(coffeeOrigin(coffee),'Brezilya');assert.equal(coffeeProcess(coffee),'Yıkanmış');
  assert.equal(coffee.rawMetadata.country,'Brazil');assert.equal(coffee.rawMetadata.process,'Washed');
  coffee.rawMetadata.process='NATURAL';assert.equal(coffeeProcess(coffee),'Natürel');
  coffee.rawMetadata.process='Washed with special fermentation';assert.equal(coffeeProcess(coffee),'Washed with special fermentation');
  coffee.rawMetadata.process='Unknown';assert.equal(coffeeProcess(coffee),null);
});
test('cards list every stated origin and process in Turkish',()=>{
  const feature=(name:string,value:string[])=>({feature:name,value,sourceType:'RULE_INFERRED',confidence:null,version:'v2-profile-4',sourceReference:null});
  const coffee={rawMetadata:{},features:[feature('normalized_origin',['Brazil','Ethiopia','Kenya']),feature('process_family',['anaerobic','natural'])]}as unknown as CatalogCoffee;
  assert.equal(coffeeOrigin(coffee),'Brezilya, Etiyopya ve Kenya');
  assert.equal(coffeeProcess(coffee),'Anaerobik ve Natürel');
  assert.equal(coffeeOrigin({rawMetadata:{},features:[feature('normalized_origin',['Brazil'])]}as unknown as CatalogCoffee),'Brezilya');
});
