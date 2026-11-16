const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {cookie,reportFixtures}=require('../dashboard-step5/fixtures.cjs');
const base='http://127.0.0.1:4336';
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext();await ctx.addCookies([cookie('owner@dashboard.invalid',base)]);await reportFixtures(ctx);
 const p=await ctx.newPage();const posts=[],errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST')posts.push({url:new URL(r.url()).pathname,body:r.postDataJSON()})});
 for(const width of [390,1366]){
  await p.setViewportSize({width,height:width===390?844:900});await p.goto(base+'/dashboard?biz=nestoodle&view=blog');
  const buttons=p.getByRole('button',{name:'Make images',exact:true});await buttons.first().waitFor();assert.equal(await p.getByRole('button',{name:'New photos',exact:true}).count(),0);
  // Hand-authored drafts without a Topics row are eligible too; pending/published rows are excluded.
  assert.equal(await buttons.count(),5);
  const beforeCancel=posts.length;p.once('dialog',d=>d.dismiss());await buttons.first().click();assert.equal(posts.length,beforeCancel);
  if(width===390){p.once('dialog',d=>{assert.match(d.message(),/stays Draft/);return d.accept()});await buttons.first().click();await p.getByRole('status').getByText('Queued, Codex starts within about 10 minutes.',{exact:true}).waitFor();await p.screenshot({path:'docs/new-photos-fix/queued-390.png',fullPage:true});assert.deepEqual(posts[0],{url:'/dashboard/workspace',body:{op:'make_images',postId:501,confirmed:true,biz:'nestoodle'}});
   // A repeat uses the existing server guard: one row, clear duplicate error.
   p.once('dialog',d=>d.accept());await buttons.first().click();await p.getByRole('status').getByText('This post already has image work waiting or in progress.',{exact:true}).waitFor();
  }
  if(await p.getByRole('status').isVisible())await p.getByRole('status').getByRole('button',{name:'Close',exact:true}).click();
  const size=await buttons.first().boundingBox();assert(size.height>=44);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:`docs/new-photos-fix/blog-${width}.png`,fullPage:true});
 }
 const old=await ctx.request.post(base+'/dashboard/blog',{headers:{origin:base},data:{biz:'nestoodle',action:'new_photos',row:2}});assert.equal(old.status(),400);
 const workspace=await ctx.request.get(base+'/dashboard/workspace?biz=nestoodle&view=automation-images');const data=await workspace.json();assert.equal(data.images.filter(r=>r.postId===501).length,1);
 const member=await b.newContext();await member.addCookies([cookie('member@dashboard.invalid',base)]);const denied=await member.request.post(base+'/dashboard/workspace',{headers:{origin:base},data:{biz:'nestoodle',op:'make_images',postId:502,confirmed:true}});assert.equal(denied.status(),403);
 assert(!posts.some(r=>r.url==='/dashboard/blog'));assert.deepEqual(errors,[]);
 fs.writeFileSync('docs/new-photos-fix/checks.json',JSON.stringify({passed:['390/1366 button label and no overflow','cancel sends nothing','confirmed exact make_images body through workspace API','one queue row and repeat rejected','new_photos rejected by blog API','member403','no legacy Blog POST or page errors'],requests:posts},null,2)+'\n');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
