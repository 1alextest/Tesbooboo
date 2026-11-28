import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
assert.equal(process.argv.length,3,'Usage: node --experimental-vm-modules replay-public-storefront-controls.mjs <source-directory>');
const root=path.resolve(process.argv[2]);
const expected={'InventoryData.js':'88b9eff92ca023d210ebea3998a709bdc678f458','orderCalculations.js':'ab87c4df82bdfeaf8255c4d9d47c1b6af8c38529','shopping-cart.js':'de3a2c7f9090e4db44413e0a9d4f368bfd79461d'};
const storage=new Map();
const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const context=vm.createContext({window:{localStorage}});
const modules={};
for(const [name,pin] of Object.entries(expected)){
 const bytes=fs.readFileSync(path.join(root,name));
 const sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 assert.equal(sha,pin,name+' source pin');
 modules[name]=new vm.SourceTextModule(bytes.toString('utf8'),{context,identifier:name});
}
await modules['orderCalculations.js'].link(spec=>{assert.equal(spec,'./InventoryData');return modules['InventoryData.js']});
await modules['orderCalculations.js'].evaluate();
await modules['shopping-cart.js'].link(()=>{throw Error('unexpected import')});
await modules['shopping-cart.js'].evaluate();
const {calculateOrderTotals}=modules['orderCalculations.js'].namespace;
const {InventoryData}=modules['InventoryData.js'].namespace;
const {ShoppingCart}=modules['shopping-cart.js'].namespace;
const plain=x=>JSON.parse(JSON.stringify(x));
const records=[];
function check(id,fn){fn();records.push({id,status:'PASS'});}
const ordinary=plain(calculateOrderTotals([0,4]));
const seeded=plain(calculateOrderTotals([0,4],{doublePrices:true}));
const expectedTotal={orderTotal:39.98,orderTax:'3.20',orderGrandTotal:'43.18'};
function arithmeticOnly(o){assert.equal(Number(o.orderGrandTotal),Number((o.orderTotal+Number(o.orderTax)).toFixed(2)));}
check('source catalog positive control',()=>{assert.equal(InventoryData[0].price,9.99);assert.equal(InventoryData[4].price,29.99)});
check('ordinary independent price oracle',()=>assert.deepEqual(ordinary,expectedTotal));
check('weak total arithmetic passes both ordinary and seeded',()=>{arithmeticOnly(ordinary);arithmeticOnly(seeded)});
check('seeded doubled total detected by independent price oracle',()=>{assert.throws(()=>assert.deepEqual(seeded,expectedTotal),assert.AssertionError);assert.deepEqual(seeded,{orderTotal:79.96,orderTax:'6.40',orderGrandTotal:'86.36'})});
check('ordinary repeat remains correct',()=>assert.deepEqual(plain(calculateOrderTotals([0,4])),expectedTotal));
check('empty cart positive control',()=>assert.deepEqual(plain(ShoppingCart.getCartContents()),[]));
check('duplicate add preserves original item identity and neighbor',()=>{ShoppingCart.addItem(0);ShoppingCart.addItem(4);ShoppingCart.addItem(0);assert.deepEqual(JSON.parse(storage.get('cart-contents')),[0,4]);});
check('remove one preserves neighboring item and repeat is harmless',()=>{ShoppingCart.removeItem(0);ShoppingCart.removeItem(0);assert.deepEqual(JSON.parse(storage.get('cart-contents')),[4]);});
check('reset clears persisted cart and fresh read is empty',()=>{ShoppingCart.resetCart();assert.equal(storage.has('cart-contents'),false);assert.deepEqual(plain(ShoppingCart.getCartContents()),[]);});
console.log(JSON.stringify({node:process.version,sourceBlobs:expected,ordinary,seeded,checks:records,scope:'Exact public JavaScript modules; isolated in-memory localStorage shim; no JSX, browser, provider, native Run, or live application execution.'},null,2));
