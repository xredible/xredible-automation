import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingPrintableGate,verifyPostPrintable} from './printable.mjs';
const pdf='https://nestoodle.com/wp-content/uploads/2026/11/Nestoodle-Checklist.pdf';
const post={id:1339,link:'https://nestoodle.com/nose-games/',html:`<a href="${pdf}">Checklist</a>`};
const token=Buffer.from('2026/11/Nestoodle-Checklist.pdf').toString('base64url')+'.0123456789abcdef0123';
const card=`<form class="nst-gate-form" method="post" action="https://nestoodle.com/wp-admin/admin-ajax.php?action=nestoodle_printable"><input type="hidden" name="file" value="${token}"><input type="hidden" name="from" value="1339"><input type="email" name="email" required></form>`;
test('matching live server card must bind the linked file and current article',()=>{
 assert.ok(matchingPrintableGate(card,post,pdf));
 for(const html of [card.replace('1339','935'),card.replace(token,Buffer.from('2026/11/Other.pdf').toString('base64url')+'.0123456789abcdef0123'),card.replace('0123456789abcdef0123','invalid'),card.replace('method="post"','method="get"'),card.replace('https://nestoodle.com/wp-admin','https://other.test/wp-admin'),`<script>${card}</script>`])assert.equal(matchingPrintableGate(html,post,pdf),false);
});
test('a gated file is verified using two GETs without submitting or bypassing the gate',async()=>{
 const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});return url===pdf?new Response(null,{status:302,headers:{location:post.link+'#free-printable'}}):new Response(card,{headers:{'content-type':'text/html'}});};
 assert.deepEqual(await verifyPostPrintable(post,{fetchImpl}),{kind:'email-gated-pdf',url:post.link+'#free-printable'});
 assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.options.method&&!c.options.body));assert.equal(calls[1].options.redirect,'error');
});
test('cross-article redirects, unrelated forms and missing files fail closed',async()=>{
 for(const location of ['https://other.test/#free-printable','https://nestoodle.com/other/#free-printable',post.link])await assert.rejects(verifyPostPrintable(post,{fetchImpl:async()=>new Response(null,{status:302,headers:{location}})}));
 await assert.rejects(verifyPostPrintable(post,{fetchImpl:async url=>url===pdf?new Response(null,{status:302,headers:{location:post.link+'#free-printable'}}):new Response(card.replace('1339','935'),{headers:{'content-type':'text/html'}})}));
 await assert.rejects(verifyPostPrintable(post,{fetchImpl:async()=>new Response('Missing',{status:404})}));
});
test('direct PDFs still require the PDF signature; HTML with a PDF mime fails',async()=>{
 assert.equal((await verifyPostPrintable(post,{fetchImpl:async()=>new Response('%PDF-1.7',{headers:{'content-type':'application/pdf'}})})).kind,'direct-pdf');
 await assert.rejects(verifyPostPrintable(post,{fetchImpl:async()=>new Response('<html>',{headers:{'content-type':'application/pdf'}})}));
});
