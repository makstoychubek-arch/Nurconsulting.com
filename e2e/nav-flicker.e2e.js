/**
 * Подразделы не мигают: открываешь «РНП», «Кампании», «Остатки», «Подбор ниш» из меню, и прошлый подраздел (Товары, Раздачи, FBS, Отзывы)
 * не успевает показаться на долю секунды (владелец, 23 ноября 2026: «нажимаю на РНП, выходит Товары на секунду, потом РНП»).
 * Для каждой пары «был в подразделе A, ушёл на Дашборд, открыл B через меню» следим за заголовком страницы по кадрам:
 * он должен прийти к B сразу, без промежуточного A. Запуск: node e2e/nav-flicker.e2e.js
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const day=(n)=>new Date(Date.now()+6*3600e3-n*86400e3).toISOString().slice(0,10);const NM=1001;
const tables={spaces:[{id:'s0',user_id:ADMIN_ID,email:'makstoychubek@gmail.com',status:'active',tariff_plan:'vip',is_super_admin:true,first_name:'M',last_name:'T',full_name:'M T'}],cabinets:[{id:CAB,name:'T',wb_token_set:true,user_id:ADMIN_ID,adv_token_valid:true}],rnp_articles:[{id:'a0',cabinet_id:CAB,nm_id:NM,seller_article:'x',name:'x',category:'К1',is_active:true,cost_price:1300,photo_url:null,sort_order:0}],rnp_daily_data:Array.from({length:12},(_,d)=>({cabinet_id:CAB,nm_id:NM,date:day(d),orders_count:3,orders_sum:9000,sales_count:3,sales_sum:15000,ad_spend:300,impressions:500,clicks:20})),wb_stocks:[],advertising_campaigns:[{cabinet_id:CAB,campaign_id:1,campaign_name:'К',status:9,type:9,created_at:'2026-09-01T00:00:00Z'}],advertising_daily_stats:[]};
const SEC={rnp:[['unit','#rnp-views [data-rv="unit"].is-on'],['prices','#rnp-views [data-rv="prices"].is-on'],['rnp','#rnp-views [data-rv="rnp"].is-on']],
advertising:[['ads','#nr-ads-tabs [data-av="ads"].is-on'],['give','#nr-ads-tabs [data-av="give"].is-on'],['content','#nr-ads-tabs [data-av="content"].is-on']],
'goods-groups':[['now','#gg-view-now-btn.is-on'],['fbs','#gg-view-fbs-btn.is-on'],['ship','#gg-view-ship-btn.is-on']],
analytics:[['niches','#an-tabs [data-an="niches"].on'],['content','#an-tabs [data-an="content"].on'],['card','#an-tabs [data-an="card"].on'],['reviews','#an-tabs [data-an="reviews"].on']]};
const bad=[];const NAVTAB={rnp:'rnp',advertising:'advertising','goods-groups':'goods-groups',analytics:'analytics'};
(async()=>{const srv=await serve();const br=await chromium.launch();const env=await openApp(br,'http://127.0.0.1:'+srv.address().port,{userId:ADMIN_ID,email:'makstoychubek@gmail.com',latencyMs:40,tables,rpcs:{is_super_admin:true},functions:{'wb-proxy':async()=>({})}});const {page}=env;
await page.setViewportSize({width:1500,height:860});await page.evaluate(()=>{const s=document.getElementById('nr-splash');if(s)s.remove()});await page.waitForTimeout(2000);
for(const [tab,items] of Object.entries(SEC)){
 for(const [from] of items){for(const [to] of items){if(from===to)continue;
  // человек был в подразделе from, потом ушёл на Дашборд и открывает to через меню
  await page.evaluate(([t,f])=>{showTab(t);},[tab,from]);await page.waitForTimeout(300);
  await page.evaluate(([t,f])=>NrNav.go(t,f),[tab,from]);await page.waitForTimeout(450);
  await page.evaluate(()=>showTab('dashboard'));await page.waitForTimeout(250);
  await page.evaluate(([items,tab,to])=>{window.__seen=[];const t=performance.now();const f=()=>{const tt=(document.getElementById('page-title')||{}).textContent||'';const hit=[tt.trim()];window.__seen.push(hit.join('+')||'-');if(performance.now()-t<1200)requestAnimationFrame(f)};f();NrNav.go(tab,to)},[items,tab,to]);
  await page.waitForTimeout(1100);
  const seen=await page.evaluate(()=>window.__seen);const seq=seen.filter((x,i)=>i===0||x!==seen[i-1]).filter(x=>x!=='-');const seq2=seq.filter(x=>x!=='Дашборд');const uniq=[...new Set(seq2)];
  if(uniq.length>1)bad.push(tab+' '+from+' -> '+to+' | '+seq2.join(' > '));
 }}}
await br.close();srv.close();if(bad.length){console.log('FAIL мигание подразделов:\n'+bad.join('\n'));process.exit(1)}console.log('e2e подразделов без мигания: все проверки прошли')})()
