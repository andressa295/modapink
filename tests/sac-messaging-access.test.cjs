/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const ID='12345678-1234-4234-8234-123456789abc',ID2='22345678-1234-4234-8234-123456789abc'
function load(file,deps={},globals={}){
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,require:n=>{if(n in deps)return deps[n];if(['react','react/jsx-runtime'].includes(n))return require(n);throw Error('Unexpected import '+n)},...globals});return m.exports
}
const policy=load('lib/dashboard-access.ts'),workflow=load('lib/sac-workflow.ts')
const Link=({children,...props})=>React.createElement('a',props,children)
const components=load('app/(admin)/dashboard/components/SacDecisionAccess.tsx',{'next/link':Link,'@/lib/sac-workflow':workflow})
const valid={conversationId:ID,sessionId:'sac',sessionKey:'sac'}
function renderLink(enabled,props=valid){return renderToStaticMarkup(React.createElement(components.SacDecisionAccessProvider,{enabled},React.createElement(components.SacDecisionLink,props)))}
test('SAC launch link disabled by default and server flag',()=>{
 assert.equal(renderToStaticMarkup(React.createElement(components.SacDecisionLink,valid)),'')
 assert.equal(renderLink(false),'')
})
test('SAC launch link includes selected UUID and no automatic request',()=>{
 const html=renderLink(true);assert.match(html,new RegExp('/sac-decisoes\\?conversation='+ID));assert.match(html,/Conferir resposta do SAC/)
})
for(const changes of [{conversationId:'bad'},{sessionId:'principal'},{sessionKey:'principal'},{sessionId:null},{sessionKey:undefined}])test('SAC link rejects wrong or ambiguous conversation '+JSON.stringify(changes),()=>assert.equal(renderLink(true,{...valid,...changes}),''))
function pageHarness(kind,{enabled=true,role='user',user=true}={}){
 let authCalls=0
 const page=load(`app/${kind}/page.tsx`,{
  'next/navigation':{notFound:()=>{throw Error('404')},redirect:p=>{throw Error('redirect:'+p)}},
  '@/lib/supabase/server':{createClient:async()=>({})},
  '@/lib/dashboard-auth':{getDashboardAccess:async()=>{authCalls++;return{user:user?{id:ID}:null,role}}},
  '@/lib/dashboard-access':policy,'@/lib/sac-workflow':workflow,
  './SacDecisions':()=>null,'./SacReview':()=>null,
 },{process:{env:{SAC_REVIEW_DECISIONS_ENABLED:enabled?'true':undefined,SAC_REVIEW_ENABLED:enabled?'true':undefined}}}).default
 return {page,authCalls:()=>authCalls}
}
for(const kind of ['sac-decisoes','sac-revisao']){
 test(kind+' feature off blocks before identity access',async()=>{const h=pageHarness(kind,{enabled:false});await assert.rejects(h.page({searchParams:Promise.resolve({})}),/404/);assert.equal(h.authCalls(),0)})
 test(kind+' anonymous redirects to login',async()=>{await assert.rejects(pageHarness(kind,{user:false}).page({searchParams:Promise.resolve({})}),/redirect:\/login/)})
 for(const role of ['admin','agent','user'])test(kind+' registered '+role+' allowed',async()=>{assert.ok(await pageHarness(kind,{role}).page({searchParams:Promise.resolve({})}))})
 for(const role of [null,'guest','ADMIN','agent ',{},['admin']])test(kind+' invalid profile denied '+JSON.stringify(role),async()=>{await assert.rejects(pageHarness(kind,{role}).page({searchParams:Promise.resolve({})}),/404/)})
}
test('decision page seeds selected case, and remounts on another selected case',async()=>{
 const h=pageHarness('sac-decisoes');const a=await h.page({searchParams:Promise.resolve({conversation:ID})});const b=await h.page({searchParams:Promise.resolve({conversation:ID2})})
 assert.equal(a.props.initialConversationId,ID);assert.equal(b.props.initialConversationId,ID2);assert.notEqual(a.key,b.key)
})
for(const conversation of [undefined,'bad','../../x',[ID],[ID,ID2]])test('invalid/duplicate initial case ignored '+JSON.stringify(conversation),async()=>{
 const element=await pageHarness('sac-decisoes').page({searchParams:Promise.resolve({conversation})});assert.equal(element.props.initialConversationId,'')
})
test('decision UI prefills selected case but waits for explicit consultation and decision',()=>{
 const css=new Proxy({},{get:(_,key)=>String(key)})
 const Ui=load('app/sac-decisoes/SacDecisions.tsx',{'next/link':Link,'@/lib/sac-workflow':workflow,'../sac-revisao/sac-review.module.css':css},{fetch:()=>{throw Error('No network in render test')}}).default
 const html=renderToStaticMarkup(React.createElement(Ui,{initialConversationId:ID}));assert.match(html,new RegExp('value="'+ID+'"'));assert.match(html,/Consultar caso/);assert.match(html,/\/dashboard\/conversas\?tab=sac/);assert.doesNotMatch(html,/Aprovar somente esta resposta|administrador autenticado/)
})
test('server layout gates link by role and feature, preserving admin-only background sync',async()=>{
 for(const role of ['admin','agent','user'])for(const enabled of [false,true]){
  const Sync=()=>null,Provider=()=>null
  const Layout=load('app/(admin)/dashboard/layout.tsx',{
   './components/Sidebar':()=>null,'./components/Topbar':()=>null,'./components/BackgroundOrderSync':Sync,'./styles/admin-layout.module.css':{},
   'next/navigation':{redirect:()=>{throw Error('redirect')}},'@/lib/supabase/server':{createClient:async()=>({})},'@/lib/dashboard-auth':{getDashboardAccess:async()=>({user:{id:ID},role})},'@/lib/dashboard-access':policy,'./components/SacDecisionAccess':{SacDecisionAccessProvider:Provider}
  },{process:{env:{SAC_REVIEW_DECISIONS_ENABLED:enabled?'true':undefined}}}).default
  const result=await Layout({children:'test'}),found=[]
  function visit(element){if(!element||typeof element!=='object')return;if(element.type===Provider||element.type===Sync)found.push(element);React.Children.forEach(element.props?.children,visit)}visit(result)
  assert.equal(found.filter(e=>e.type===Sync).length,role==='admin'?1:0)
  assert.equal(found.find(e=>e.type===Provider).props.enabled,enabled)
 }
})
