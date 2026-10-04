import assert from 'node:assert/strict';
import test from 'node:test';
import { publicCatalogCoffee } from '../shared/v2/public-catalog';
import { getCoffeeDetail, listCatalog } from '../shared/v2/catalog';
import { ingestCrawl, registerRoaster } from '../shared/v2/ingestion';
import { TestCatalogDatabase } from './helpers/v2-sqlite';

test('public DTO exposes original roaster packages and declared facts without collection dates, archives or derived scoring',async()=>{
  const db=new TestCatalogDatabase();await registerRoaster(db,{id:'r',slug:'test',name:'Test',websiteUrl:'https://shop.test',adapter:'test'});
  await ingestCrawl(db,{id:'one',roasterId:'r',startedAt:'2026-09-14T00:00:00Z',completedAt:'2026-09-14T00:01:00Z',parserVersion:'test',status:'success',diagnostics:[],products:[{name:'Colombia',canonicalUrl:'https://shop.test/coffee',sourceProductId:'secret-native-id',visibility:'public',rawMetadata:{scaScore:87,country:'Colombia',sourceData:{specialty_score:9,legacy:{collectedAt:'internal date'}}},features:[{feature:'internal',value:{collection:'team only'},sourceType:'RULE_INFERRED',confidence:0.9,version:'1'}],offers:[{sourceVariantId:'source-variant',label:'200 gr',weightG:200,price:625,compareAtPrice:null,currency:'TRY',inStock:true,purchaseUrl:'https://shop.test/coffee?variant=200'}]}]});
  const coffee=(await listCatalog(db)).coffees[0];const detail=(await getCoffeeDetail(db,coffee.slug))!;
  const dto=publicCatalogCoffee(detail);const serialized=JSON.stringify(dto);
  for(const forbidden of ['2026-09-14','internal date','team only','firstSeenAt','lastSeenAt','priceHistory','unitPrice','sourceData','sourceProductId','sourceVariantId','confidence','features','latestEvents','createdAt','version','specialty_score'])assert.ok(!serialized.includes(forbidden),forbidden);
  assert.equal(dto.offers[0].priceMinor,62500);assert.equal(dto.offers[0].weightG,200);assert.equal(dto.offers[0].label,'200 gr');assert.equal(dto.facts.scaScore,87);db.sqlite.close();
});
