const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.join(__dirname, '..')
const clientPath = path.join(root, 'app/catalogo/CatalogClient.tsx')
const source = fs.readFileSync(clientPath, 'utf8')
const css = fs.readFileSync(path.join(root, 'app/catalogo/catalog.module.css'), 'utf8')
const product = {
  id: 1, name: 'Blusa teste', handle: 'blusa-teste', description: 'Peça de teste', images: [],
  categories: [], attributes: ['Cor'], priceFrom: 20, pixPriceFrom: 18,
  compareAtPriceFrom: null, available: true,
  variants: [
    { id: 11, values: ['Rosa'], price: 20, pixPrice: 18, compareAtPrice: null, stock: 20, available: true, sku: null },
    { id: 12, values: ['Azul'], price: 30, pixPrice: 27, compareAtPrice: 35, stock: 20, available: true, sku: null },
    { id: 13, values: ['Preto'], price: 10, pixPrice: 9, compareAtPrice: null, stock: 0, available: false, sku: null }
  ]
}
const line = { productId: 1, variantId: 11, productName: product.name, image: '', values: ['Rosa'], attributes: ['Cor'], quantity: 1, price: 20, pixPrice: 18, stock: 20 }
const catalog = { products: [product], categories: [], settings: { storeName: 'Moda Pink', minimumOrder: 200, siteUrl: 'https://example.test', helpUrl: 'https://example.test', pixDiscountPercent: 10 }, updatedAt: '2026-11-06' }
function harness(overrides = {}) {
  const states = []
  Object.entries({0: catalog, 1: false, ...overrides}).forEach(([key,value]) => states[Number(key)] = value)
  let index = 0
  const destinations = []
  function load(file) {
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const mod = {exports: {}}
    vm.runInNewContext(code, {
      exports: mod.exports, module: mod,
      require(name) {
        if (name === 'react') return {...React, useState(initial) {const key=index++; if (!(key in states)) states[key] = initial; return [states[key], next => {states[key] = typeof next === 'function' ? next(states[key]) : next}]}, useEffect() {}, useMemo(fn) {return fn()}}
        if (name === 'next/image') return props => React.createElement('img', {...props, priority: undefined})
        if (name.endsWith('.module.css')) return new Proxy({}, {get: (_, key) => key === '__esModule' ? false : key})
        if (name.startsWith('@/')) return load(path.join(root, name.slice(2) + '.ts'))
        return require(name)
      }, Intl, URL, URLSearchParams, setTimeout,
      window: { setTimeout: fn => {fn(); return 0}, location: {assign(url) {destinations.push(url)}} },
      fetch() {throw new Error('Unexpected network request')}
    }, {filename: file})
    return mod.exports
  }
  const Component = load(clientPath).default
  function render() {index=0; return Component({sourceToken: 'catalogo'})}
  function all(node, predicate) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(item => all(item,predicate))
    return [...(predicate(node) ? [node] : []), ...all(node.props?.children,predicate)]
  }
  function byClass(tree, className) {return all(tree,n => n.props?.className === className)}
  function html(node) {return renderToStaticMarkup(node).replace(/\u00a0/g,' ')}
  return {states, destinations, render, all, byClass, html}
}

test('product cards highlight already discounted Pix, card remains secondary and range uses available variants', () => {
  const h=harness(); const price=h.byClass(h.render(),'priceBlock')[0]; const html=h.html(price)
  assert.match(html, /<strong>Pix: a partir de R\$ 18,00<\/strong>/)
  assert.match(html, /<small>Cartão: a partir de R\$ 20,00<\/small>/)
  assert.match(html, /10% de desconto já aplicado no Pix/)
  assert.doesNotMatch(html, /16,20|R\$ 9,00|R\$ 10,00/)
})
test('same priced variants omit a partir de', () => {
 const p={...product, variants:[product.variants[0]]};const h=harness({0:{...catalog,products:[p]}})
 assert.match(h.html(h.byClass(h.render(),'priceBlock')[0]), /<strong>Pix: R\$ 18,00<\/strong>/)
})
test('zero discount still labels both methods without claiming a discount', () => {
 const p={...product,pixPriceFrom:20,variants:[{...product.variants[0],pixPrice:20}]}
 const h=harness({0:{...catalog,products:[p],settings:{...catalog.settings,pixDiscountPercent:0}}})
 const html=h.html(h.byClass(h.render(),'priceBlock')[0]);assert.match(html, /Pix: R\$ 20,00/);assert.match(html,/Cartão: R\$ 20,00/);assert.doesNotMatch(html,/desconto/)
})
test('selected variant displays the matching exact Pix and card prices', () => {
 const h=harness({7:product,8:['Azul']});const html=h.html(h.byClass(h.render(),'modalPrice')[0])
 assert.match(html,/<strong>Pix: R\$ 27,00<\/strong>/);assert.match(html,/<small>Cartão: R\$ 30,00<\/small>/);assert.match(html,/De: R\$ 35,00/);assert.doesNotMatch(html,/24,30|a partir/)
})
test('changing variant updates both amounts, then adding and reopening preserves the selected amounts', () => {
 const h=harness({7:product,8:['Rosa']});let tree=h.render()
 h.all(tree,n => n.type==='button' && n.props.children==='Azul')[0].props.onClick()
 tree=h.render();assert.match(h.html(h.byClass(tree,'modalPrice')[0]),/Pix: R\$ 27,00/)
 h.all(tree,n => n.props?.className?.startsWith('addButton'))[0].props.onClick()
 assert.equal(h.states[5][0].price,30);assert.equal(h.states[5][0].pixPrice,27)
 h.all(h.render(),n => n.type==='button'&&n.props['aria-label']==='Fechar produto')[0].props.onClick()
 assert.equal(h.byClass(h.render(),'productModal').length,0)
 h.all(h.render(),n => n.type==='button'&&n.props.className==='chooseButton')[0].props.onClick()
 assert.match(h.html(h.byClass(h.render(),'modalPrice')[0]),/Pix: R\$ 18,00/)
})
test('cart line identifies unit Pix and card prices, while total discounts original subtotal once', () => {
 const h=harness({5:[{...line,quantity:3}],6:true});const tree=h.render()
 const html=h.html(h.byClass(tree,'cartItemInfo')[0]);assert.match(html,/<b>Pix: R\$ 18,00 por peça<\/b>/);assert.match(html,/<small>Cartão: R\$ 20,00 por peça<\/small>/)
 assert.match(h.html(h.byClass(tree,'totalRow')[0]),/Produtos no Pix.*R\$ 54,00/)
 assert.match(h.html(h.byClass(tree,'cardTotalRow')[0]),/Produtos no cartão.*R\$ 60,00/)
 assert.match(h.html(h.byClass(tree,'drawerFooter')[0]),/Frete não incluído/)
})
test('quantity changes update both totals and removing last item leaves empty cart', () => {
 const h=harness({5:[line],6:true});h.all(h.render(),n => n.props?.['aria-label']==='Aumentar quantidade')[0].props.onClick()
 assert.match(h.html(h.byClass(h.render(),'totalRow')[0]),/R\$ 36,00/)
 h.all(h.render(),n => n.props?.['aria-label']==='Diminuir quantidade')[0].props.onClick()
 assert.match(h.html(h.byClass(h.render(),'totalRow')[0]),/R\$ 18,00/)
 h.all(h.render(),n => n.props?.['aria-label']==='Remover item')[0].props.onClick()
 assert.equal(h.byClass(h.render(),'totalRow').length,0);assert.equal(h.byClass(h.render(),'emptyCart').length,1)
})
test('floating cart identifies Pix instead of showing an unlabeled card total', () => {
 const h=harness({5:[line]});assert.match(h.html(h.byClass(h.render(),'floatingCart')[0]),/<strong>Pix: R\$ 18,00<\/strong>/)
})
test('minimum eligibility and WhatsApp handoff remain based on the original card total', () => {
 const h=harness({5:[{...line,quantity:10}],6:true});const tree=h.render();const btn=h.byClass(tree,'checkoutButton')[0]
 assert.equal(btn.props.disabled,false);assert.match(h.html(h.byClass(tree,'totalRow')[0]),/R\$ 180,00/)
 btn.props.onClick();assert.equal(h.destinations.length,1)
 const message=new URL(h.destinations[0]).searchParams.get('text');assert.match(message,/Total dos produtos: R\$\s200,00/);assert.match(message,/Ref: ns-1-11/)
 const under=harness({5:[{...line,quantity:9}],6:true});assert.equal(under.byClass(under.render(),'checkoutButton')[0].props.disabled,true)
})
test('checkout summary retains both labels without changing the checkout payload', () => {
 const h=harness({5:[line],11:true});const html=h.html(h.byClass(h.render(),'checkoutSummary')[0]);assert.match(html,/Pix: R\$ 18,00/);assert.match(html,/Cartão: R\$ 20,00/)
})
test('CSS keeps Pix visibly larger than card on desktop and mobile', () => {
 assert.match(css,/\.priceBlock strong\s*\{[^}]*font-size: 19px/s)
 assert.match(css,/\.priceBlock small,\s*\.modalPrice small\s*\{[^}]*font-size: 12px/s)
 assert.match(css,/\.modalPrice strong\s*\{[^}]*font-size: 26px/s)
 const mobile=css.slice(css.indexOf('@media (max-width: 760px)'));assert.match(mobile,/\.priceBlock strong\s*\{[^}]*font-size: 17px/s);assert.match(mobile,/\.priceBlock small\s*\{[^}]*font-size: 11px/s)
})
test('empty search, loading and failed load states still render without prices', () => {
 for(const overrides of [{1:true},{2:'Falha no catálogo'},{3:'não-existe'}]){const h=harness(overrides);assert.equal(h.byClass(h.render(),'priceBlock').length,0)}
})

if (process.env.CATALOG_RENDER_FIXTURE_DIR) {
 const out=process.env.CATALOG_RENDER_FIXTURE_DIR;fs.mkdirSync(out,{recursive:true})
 for(const [name,state] of [['grid',{}],['modal',{7:product,8:['Azul']}],['cart',{5:[{...line,quantity:10}],6:true}]]) {
  const h=harness(state);fs.writeFileSync(path.join(out,name+'.html'),`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}h1,h2,p{margin:0}${css}</style></head><body>${h.html(h.render())}</body></html>`)
 }
}

test('Pix subtotal rounds after discounting the original total, matching checkout for fractional cents', () => {
 const h=harness({5:[{...line,price:13.35,pixPrice:12.02,quantity:10}],6:true});const tree=h.render()
 const html=h.html(h.byClass(tree,'totalRow')[0]);assert.match(html,/R\$ 120,15/);assert.doesNotMatch(html,/120,20/)
 assert.match(h.html(h.byClass(tree,'cartItemInfo')[0]),/Pix: R\$ 12,02 por peça/)
 const mixed=harness({5:[{...line,price:13.35,pixPrice:12.02,quantity:3},{...line,variantId:12,price:17.80,pixPrice:16.02,quantity:2}],6:true})
 assert.match(mixed.html(mixed.byClass(mixed.render(),'totalRow')[0]),/R\$ 68,09/)
 const noDiscount=harness({0:{...catalog,settings:{...catalog.settings,pixDiscountPercent:0}},5:[{...line,pixPrice:20,quantity:3}],6:true})
 assert.match(noDiscount.html(noDiscount.byClass(noDiscount.render(),'totalRow')[0]),/R\$ 60,00/)
})
