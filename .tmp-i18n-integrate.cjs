const fs=require('fs'),path=require('path'),ts=require('typescript');
const pt=JSON.parse(fs.readFileSync('src/i18n/locales/pt-BR.json','utf8'));
const en=JSON.parse(fs.readFileSync('src/i18n/locales/en-US.json','utf8'));
const flat=(obj,p='')=>Object.entries(obj).flatMap(([k,v])=>typeof v==='string'?[[p+k,v]]:flat(v,p+k+'.'));
const values=flat(pt), english=new Map(flat(en));
const normalize=s=>s.replace(/{{.*?}}/g,' placeholder ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const report=fs.readFileSync('docs/i18n-audit.md','utf8');const origins=new Map();
for(const line of report.split('\n')){const m=line.match(/^\| ([A-Za-z]+\.[A-Za-z0-9_]+) \|/);if(m)origins.set(m[1],[...line.matchAll(/(src\/[^:< ]+):(\d+)/g)].map(x=>x[1]));}
const snapshotPath='.tmp-i18n-phase2-snapshot.json';const snapshot=fs.existsSync(snapshotPath)?JSON.parse(fs.readFileSync(snapshotPath,'utf8')):{};
function resolve(text,file){const norm=normalize(text);if(!norm)return null;
 let found=values.filter(([key,value])=>!/_one$|_other$|_many$/.test(key)&&normalize(value)===norm);
 if(!found.length&&text!==text.toLowerCase())found=values.filter(([key])=>origins.get(key)?.includes(file)&&normalize(english.get(key))===norm);
 if(found.length>1)found.sort((a,b)=>Number(origins.get(b[0])?.includes(file))-Number(origins.get(a[0])?.includes(file)));
 return found[0];
}
const skipAttributes=/^(className|id|key|role|type|value|name|htmlFor|lang|rel|target|href|src|fill|stroke|viewBox|d|xmlns|style|aria-controls|aria-current|aria-live|aria-haspopup|aria-labelledby|aria-describedby|autoComplete|method|accept|pattern)$/;
const symbolEdges=s=>{const chars='[\\s\\u2190-\\u21ff\\u23e9-\\u23ff\\u25a0-\\u25ff\\u2713\\u26a0\\u{1f300}-\\u{1faff}\\ufe0f]';return [s.match(new RegExp('^'+chars+'+','u'))?.[0]??'',s.match(new RegExp(chars+'+$','u'))?.[0]??''];};
function integrate(file){
 let source=fs.readFileSync(file,'utf8');snapshot[file]??=source;
 // These arrays are captions, not study content; evaluate them on render.
 if(file.endsWith('/Sidebar.tsx')){const start=source.indexOf('const menuItems:'),end=source.indexOf('export function Sidebar');if(start>=0&&end>start){const block=source.slice(start,end);source=source.slice(0,start)+source.slice(end);const marker='  const [menuOpen';const pos=source.indexOf(marker);source=source.slice(0,pos)+block+source.slice(pos);}}
 if(file.endsWith('/MemoryFlashcards.tsx')){source=source.replace(/const levelNames = (\[[^\n]+\]);/,'const levelNames = () => $1;').replaceAll('levelNames[index]','levelNames()[index]');}
 if(file.endsWith('/StoryShadowing.tsx')){source=source.replace('const techniqueNames = {','const techniqueNames = () => ({').replace('combined: "Listen → Repeat after me → Shadowing" };','combined: "Listen → Repeat after me → Shadowing" });').replaceAll('techniqueNames[','techniqueNames()[');}
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const edits=[],hooks=[];let count=0,needsName=false;
 function edit(start,end,text){edits.push({start,end,text});count++;}
 function visit(n){
  if(ts.isFunctionDeclaration(n)&&n.name&&/^[A-Z]/.test(n.name.text)&&n.body)hooks.push(n.body.getStart(ast)+1);
  // Display names follow Source; catalog URLs, flags and audio locales stay unchanged.
  if(ts.isPropertyAccessExpression(n)&&n.name.text==='name'&&ts.isElementAccessExpression(n.expression)&&n.expression.expression.getText(ast)==='LANGUAGES'){
   needsName=true;edit(n.getStart(ast),n.end,'localizedLanguageName('+n.expression.argumentExpression.getText(ast)+')');return;
  }
  if(ts.isJsxText(n)){
   const raw=n.text,match=resolve(raw,file);if(match){const [key]=match,[pre,post]=symbolEdges(raw.trim());const leading=raw.match(/^\s*/)?.[0]??'',trailing=raw.match(/\s*$/)?.[0]??'';
    edit(n.getStart(ast),n.end,leading+(pre.trim()?'{'+JSON.stringify(pre)+'}':'')+'{t('+JSON.stringify(key)+')}' +(post.trim()?'{'+JSON.stringify(post)+'}':'')+trailing);
   }return;
  }
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateExpression(n)){
   const p=n.parent;
   if(ts.isImportDeclaration(p)||ts.isLiteralTypeNode(p)||ts.isElementAccessExpression(p)||ts.isBinaryExpression(p)||ts.isImportSpecifier(p))return;
   if(ts.isJsxAttribute(p)&&skipAttributes.test(p.name.getText(ast)))return;
   if(ts.isPropertyAssignment(p)&& (p.name===n||!/^(label|message|title|listen|repeat|shadow|combined)$/.test(p.name.getText(ast))))return;
   if(ts.isCallExpression(p)&&p.expression.getText(ast)==='t')return;
   if(ts.isCallExpression(p)&&/useState|setCategory/.test(p.expression.getText(ast)))return;
   let text,expressions=[];
   if(ts.isTemplateExpression(n)){text=n.head.text;for(const span of n.templateSpans){text+='{{placeholder}}'+span.literal.text;expressions.push(span.expression.getText(ast));}}
   else text=n.text;
   if(text.length>1500||/<html|<style|@media|^\s*</i.test(text))return;
   const match=resolve(text,file);if(!match)return;const [key,translated]=match;
   const names=[...translated.matchAll(/{{(.*?)}}/g)].map(m=>m[1]);if(names.length!==expressions.length)return;
   let options='';if(names.length)options=', { '+names.map((name,i)=>name+': ('+expressions[i]+')').join(', ')+' }';
   const [pre,post]=symbolEdges(text.trim());let call='t('+JSON.stringify(key)+options+')';
   if(pre.trim())call=JSON.stringify(pre)+' + '+call;if(post.trim())call+=' + '+JSON.stringify(post);
   if(ts.isJsxAttribute(p))call='{'+call+'}';
   edit(n.getStart(ast),n.end,call);return;
  }
  ts.forEachChild(n,visit);
 }
 visit(ast);
 if(!count)return;
 if(file.endsWith('.tsx'))for(const pos of hooks)edits.push({start:pos,end:pos,text:'\n  const { t } = useTranslation();'});
 edits.sort((a,b)=>b.start-a.start);let last=source.length+1;for(const e of edits){if(e.end>last)throw Error('Overlapping edits '+file);source=source.slice(0,e.start)+e.text+source.slice(e.end);last=e.start;}
 const root=file==='src/App.tsx'?'./i18n':'../i18n';source='import { t'+(needsName?', languageName as localizedLanguageName':'')+' } from "'+root+'";\n'+(file.endsWith('.tsx')?'import { useTranslation } from "react-i18next";\n':'')+source;
 fs.writeFileSync(file,source);console.log(file+': '+count+' replacements');
}
for(const file of process.argv.slice(2))integrate(file);
fs.writeFileSync(snapshotPath,JSON.stringify(snapshot));
