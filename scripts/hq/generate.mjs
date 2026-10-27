#!/usr/bin/env node
/**
 * BEJ HQ generator. Review-first: generation NEVER updates a catalog.
 * node scripts/hq/generate.mjs --locale=en-US --dry-run --max-images=3
 * node scripts/hq/generate.mjs --locale=en-US --max-images=1
 * node scripts/hq/generate.mjs --locale=en-US --approve-id=<UUID> --reviewed
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, copyFile, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCALES = new Set(['en-US', 'pt-BR', 'es-ES', 'fr-FR']);
const LEVELS = new Set(['a1','a2','b1','b2','c1','c2']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WIDTH = 2480, HEIGHT = 3508, MARGIN = 118, GAP = 32;
const PANEL_W = (WIDTH - 2 * MARGIN - GAP) / 2;
const PANEL_H = (HEIGHT - 2 * MARGIN - GAP) / 2;
const args = Object.create(null);
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith('--')) throw new Error(`Argumento inválido: ${arg}`);
  const [key, ...rest] = arg.slice(2).split('=');
  if (!['locale','dry-run','max-images','example-id','intention-id','approve-id','reviewed','help'].includes(key) || key in args) throw new Error(`Argumento desconhecido/repetido: ${arg}`);
  args[key] = rest.length ? rest.join('=') : true;
}
if (args.help) {
  console.log(`BEJ HQ A4 — modo seguro\n  --locale=en-US|pt-BR|es-ES|fr-FR (padrão en-US)\n  --dry-run [--max-images=3] (sem chamadas pagas)\n  --max-images=1 (limite obrigatório de geração paga, máximo 10)\n  --example-id=<UUID> [--intention-id=<id>] (seleção pontual)\n  --approve-id=<UUID> --reviewed (após inspeção visual manual)\n\nGeração: imagens candidatas em reports/hq/pending. Aprovação: publica PNG e atualiza somente hqImage.`);
  process.exit(0);
}
const locale = args.locale ?? 'en-US';
if (!LOCALES.has(locale)) throw new Error('Locale inválido.');
if (args['max-images'] !== undefined && (!/^\d+$/.test(String(args['max-images'])) || +args['max-images'] < 1 || +args['max-images'] > 10)) throw new Error('--max-images deve estar entre 1 e 10.');
if (args['example-id'] && !UUID.test(args['example-id'])) throw new Error('example-id precisa ser UUID.');
if (args['approve-id'] && !UUID.test(args['approve-id'])) throw new Error('approve-id precisa ser UUID.');
if (args['approve-id'] && (args['dry-run'] || args['max-images'] || args['example-id'] || args['intention-id'])) throw new Error('Aprovação não pode ser combinada com filtros/geração.');
if (args.reviewed && !args['approve-id']) throw new Error('--reviewed só pode ser usado com --approve-id.');
const jsonFile = path.join(ROOT, 'public', `sample-hashmap-${locale}.json`);
const pendingRoot = path.join(ROOT, 'reports', 'hq', 'pending', locale);
const digest = input => createHash('sha256').update(input).digest('hex');
const has = async p => { try { return (await stat(p)).isFile(); } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const ensure = async p => mkdir(path.dirname(p), {recursive:true});
async function atomic(file, content) {
  await ensure(file);
  const tmp = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(tmp, content, {flag:'wx'}); await rename(tmp, file); }
  finally { await rm(tmp, {force:true}); }
}
function validateEntry(intention, example) {
  if (!UUID.test(example?.id ?? '') || typeof example?.exampleItem !== 'string' || !example.exampleItem.trim()) return false;
  if (!LEVELS.has(String(intention.level ?? '').toLowerCase())) return false;
  return true;
}
function imagePath(level, id) { return path.join(ROOT,'public','images','hq',level,locale,`${id}.png`); }
function publicUrl(level, id) { return `/images/hq/${level}/${locale}/${id}.png`; }
async function load() {
  const raw = await readFile(jsonFile,'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.mentalMap)) throw new Error('Catálogo sem mentalMap[].');
  const list = [], seen = new Set();
  for (const intention of parsed.mentalMap) for (const example of intention.examples ?? []) {
    if (!validateEntry(intention,example)) continue;
    if (seen.has(example.id)) throw new Error(`UUID de exemplo duplicado: ${example.id}`);
    seen.add(example.id);
    list.push({intention,example,level:intention.level.toLowerCase()});
  }
  return {raw,parsed,list};
}
// SVG escaping and line fitting keep the exact exampleItem unchanged.
const xml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function wrapText(text, maxWidth, fontSize) {
  const maxUnits = maxWidth / (fontSize * .54);
  const lines = [''];
  for (const word of text.split(/\s+/)) {
    if (word.length > maxUnits) throw new Error('Frase longa demais para o balão; revise manualmente, não truncar.');
    const i = lines.length - 1;
    if ((lines[i] ? lines[i] + ' ' : '').length + word.length > maxUnits) lines.push(word);
    else lines[i] = lines[i] ? lines[i] + ' ' + word : word;
  }
  return lines;
}
function balloonSvg(text, target = false) {
  const fontSize = target ? 47 : 49;
  const maxWidth = 700;
  const lines = wrapText(text, maxWidth - 70, fontSize);
  if (lines.length > (target ? 5 : 3)) throw new Error('Balão excede espaço seguro: frase muito longa.');
  const h = Math.max(124, lines.length * 61 + 54), w = maxWidth;
  if (w*h > PANEL_W*PANEL_H*.25) throw new Error('Balão ocuparia mais de 25% do quadro.');
  const x=350, y=90, r=30;
  const bottom=y+h;
  const pathData = `M ${x+r} ${y} Q ${x+155} ${y-10} ${x+330} ${y+3} Q ${x+w-105} ${y-8} ${x+w-r} ${y} Q ${x+w+5} ${y+12} ${x+w} ${y+r} L ${x+w} ${bottom-r} Q ${x+w} ${bottom+7} ${x+w-r} ${bottom} Q ${x+170} ${bottom+5} ${x+96} ${bottom} L ${x-45} ${bottom+105} L ${x+32} ${bottom-8} Q ${x-5} ${bottom-12} ${x} ${bottom-r} L ${x} ${y+r} Q ${x-3} ${y+6} ${x+r} ${y} Z`;
  const lineEls = lines.map((line,i)=>`<text x="${x+w/2}" y="${y+45+i*61}" text-anchor="middle" dominant-baseline="hanging" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="600" fill="#18212d">${xml(line)}</text>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_W}" height="${PANEL_H}" viewBox="0 0 ${PANEL_W} ${PANEL_H}"><path d="${pathData}" fill="#fffdf8" stroke="#17202a" stroke-width="7" stroke-linejoin="round"/>${lineEls}</svg>`);
}
function storyboardPrompt(item) {
  return `You are writing a very short four-panel illustrated educational comic in ${locale}. Output a JSON object with exactly keys "setting", "characters", "panels". "characters" is one short consistent physical description of two ORIGINAL adult characters. "panels" is an array of four objects with keys "action" and "dialogue". The four actions form a coherent mini-story illustrating this communicative intention: ${JSON.stringify(item.intention.intention)}. Description: ${JSON.stringify(item.intention.description ?? '')}. Target sentence: ${JSON.stringify(item.example.exampleItem)}. All dialogue in ${locale}. First three panels have ONE short natural dialogue line each, max 40 characters. Panel four dialogue MUST be exactly the target sentence, byte-for-byte. Never repeat target in panels 1-3. Each action visually differs in camera angle, action, gesture or props; meaningful beginning, development, problem and resolution. Keep the same two characters. No third-party copyrighted characters. Only output JSON.`;
}
function validateStory(story, item) {
  if (!story || typeof story.setting !== 'string' || typeof story.characters !== 'string' || !Array.isArray(story.panels) || story.panels.length !== 4) throw new Error('Roteiro inválido.');
  for (const [i,p] of story.panels.entries()) {
    if (typeof p.action !== 'string' || typeof p.dialogue !== 'string') throw new Error('Painel incompleto.');
    if (i<3 && (p.dialogue.length>65 || p.dialogue.includes(item.example.exampleItem))) throw new Error('Fala auxiliar inválida.');
    balloonSvg(p.dialogue,i===3);
  }
  if (story.panels[3].dialogue !== item.example.exampleItem) throw new Error('Roteiro modificou a frase original.');
}
async function validatePng(sharp, file) {
  const meta = await sharp(file).metadata();
  if (meta.format !== 'png' || meta.width !== WIDTH || meta.height !== HEIGHT || Math.abs((meta.density ?? 0)-300)>2) throw new Error(`PNG inválido: ${meta.format} ${meta.width}x${meta.height} ${meta.density}dpi`);
}
async function compose(sharp, art, story) {
  const layers=[];
  for (let i=0;i<4;i++) {
    const x=MARGIN+(i%2)*(PANEL_W+GAP), y=MARGIN+Math.floor(i/2)*(PANEL_H+GAP);
    const panel = await sharp(art[i]).resize(PANEL_W,PANEL_H,{fit:'cover',position:'centre'}).png().toBuffer();
    const bubble = balloonSvg(story.panels[i].dialogue,i===3);
    layers.push({input:panel,left:x,top:y},{input:bubble,left:x,top:y});
  }
  return sharp({create:{width:WIDTH,height:HEIGHT,channels:3,background:'#ffffff'}}).composite(layers).withMetadata({density:300}).png({compressionLevel:9}).toBuffer();
}
// Replace one example object textually; never reserialize the entire multilingual catalog.
function insertHqImage(raw,id,url) {
  const token = JSON.stringify(id);
  const re = new RegExp('"id"\\s*:\\s*'+token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
  const matches=[...raw.matchAll(re)];
  if (matches.length!==1) throw new Error(`ID ambíguo no JSON: ${id} (${matches.length} ocorrências)`);
  const at=matches[0].index;
  let quoted=false,esc=false,stack=[],start=-1,end=-1;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quoted){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')quoted=false;continue;}
    if(ch==='"'){quoted=true;continue;}
    if(ch==='{'){stack.push(i);}
    else if(ch==='}'){
      const s=stack.pop();
      if(s!==undefined && s<at && i>at && start<0){start=s;end=i+1;break;}
    }
  }
  if(start<0)throw new Error('Objeto do exemplo não localizado.');
  const object=JSON.parse(raw.slice(start,end));
  if(object.id!==id || typeof object.exampleItem!=='string' || Object.hasOwn(object,'hqImage'))throw new Error('Objeto do exemplo mudou ou já possui hqImage.');
  const lineStart=raw.lastIndexOf('\n',start)+1;
  const indent=raw.slice(lineStart,start).match(/^\s*/)?.[0] ?? '';
  const fieldIndent=indent+'  ';
  const insertion=`\n${fieldIndent}"hqImage": ${JSON.stringify(url)},`;
  const result=raw.slice(0,start+1)+insertion+raw.slice(start+1);
  const before=JSON.parse(raw),after=JSON.parse(result);
  const locate = catalog => catalog.mentalMap.flatMap(i=>i.examples??[]).find(e=>e.id===id);
  const afterExample=locate(after);
  if(!afterExample || afterExample.hqImage!==url)throw new Error('Verificação pós-edição falhou.');
  delete afterExample.hqImage;
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Mudanças semânticas inesperadas no catálogo.');
  return result;
}
async function approve(id) {
  if(!args.reviewed) throw new Error('Aprovação exige --reviewed após inspecionar visualmente os 4 quadros, balões e frase exata.');
  const manifestFile=path.join(pendingRoot,`${id}.json`);
  if(!await has(manifestFile))throw new Error('Manifesto pendente não encontrado.');
  const m=JSON.parse(await readFile(manifestFile,'utf8'));
  if(m.id!==id || m.locale!==locale || !LEVELS.has(m.level))throw new Error('Manifesto inválido.');
  const candidate=path.join(pendingRoot,`${id}.png`);
  if(!await has(candidate) || digest(await readFile(candidate))!==m.imageSha256)throw new Error('PNG candidato ausente ou modificado.');
  const {default:sharp}=await import('sharp');
  await validatePng(sharp,candidate);
  const {raw,list}=await load();
  const item=list.find(x=>x.example.id===id);
  if(!item || item.level!==m.level || item.intention.id!==m.intentionId || digest(item.example.exampleItem)!==m.textSha256)throw new Error('Exemplo foi modificado após geração.');
  if(item.example.hqImage)throw new Error('Exemplo já possui hqImage. Nunca sobrescrever automaticamente.');
  const target=imagePath(m.level,id);
  if(await has(target))throw new Error('PNG de produção já existe. Sem sobrescrita.');
  const updated=insertHqImage(raw,id,publicUrl(m.level,id));
  // Backup único, sem sobrescrever; preserve existing user data.
  const backup=`${jsonFile}.hq-backup-${Date.now()}-${randomUUID().slice(0,8)}.bak`;
  await copyFile(jsonFile,backup);
  await ensure(target);
  await copyFile(candidate,target,1); // COPYFILE_EXCL=1
  try {
    if(await readFile(jsonFile,'utf8')!==raw)throw new Error('Catálogo alterado durante aprovação.');
    await atomic(jsonFile,updated);
  } catch(e){await rm(target,{force:true});throw e;}
  console.log(`APROVADO ${id}\nPNG: ${path.relative(ROOT,target)}\nJSON: ${path.relative(ROOT,jsonFile)}\nBackup: ${path.relative(ROOT,backup)}`);
}
async function generate() {
  const {list}=await load();
  let items=list.filter(x=>!x.example.hqImage);
  if(args['example-id'])items=items.filter(x=>x.example.id===args['example-id']);
  if(args['intention-id'])items=items.filter(x=>x.intention.id===args['intention-id']);
  const pending=[];
  for(const x of items){
    if(await has(imagePath(x.level,x.example.id)))continue;
    if(await has(path.join(pendingRoot,`${x.example.id}.json`)))continue;
    pending.push(x);
  }
  if(args['example-id'] && !pending.length)console.log('Exemplo não encontrado, já possui HQ ou já está pendente.');
  const limit=args['max-images']?+args['max-images']:args['dry-run']?3:0;
  if(!args['dry-run']&&!limit)throw new Error('Geração paga exige limite explícito: --max-images=1 (até 10).');
  console.log(`BEJ HQ | ${locale} | elegíveis: ${pending.length} | limite: ${limit} | dry-run: ${!!args['dry-run']}`);
  for(const [i,x] of pending.slice(0,limit).entries())console.log(`${i+1}. ${x.example.id} | ${x.level} | ${x.example.exampleItem}`);
  if(args['dry-run']){console.log('DRY RUN: nenhuma chamada paga, imagem ou JSON alterado.');return;}
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY não configurada.');
  const [{default:OpenAI},{default:sharp}]=await Promise.all([import('openai'),import('sharp')]);
  const client=new OpenAI();
  for(const item of pending.slice(0,limit)){
    const id=item.example.id;
    console.log(`\nGerando HQ ${id} (1 roteiro + 4 imagens; chamadas pagas)...`);
    try{
      const storyResponse=await client.chat.completions.create({model:process.env.BEJ_HQ_TEXT_MODEL??'gpt-4.1-mini',response_format:{type:'json_object'},messages:[{role:'user',content:storyboardPrompt(item)}]});
      const story=JSON.parse(storyResponse.choices[0]?.message?.content??'{}');
      validateStory(story,item);
      const art=[];
      for(let i=0;i<4;i++){
        const p=story.panels[i];
        const prompt=`Premium hand-drawn illustrated graphic novel PANEL ${i+1} of four. A single FULL-BLEED PORTRAIT illustration, no panels inside it. SAME original adult characters throughout: ${story.characters}. Setting: ${story.setting}. Action and camera: ${p.action}. Cinematic varied composition, vivid coherent lighting and color, expressive faces, meaningful physical action, excellent graphic novel craftsmanship. Composition requirement: keep the speaking character's head in LEFT half and LOWER half of the image; reserve upper RIGHT 65% of scene as uncluttered NEGATIVE SPACE, but STILL ILLUSTRATED BACKGROUND, for an organic speech balloon that will be overlaid by software. Do NOT draw speech bubbles. Absolutely NO words, letters, subtitles, captions, labels, signage, watermarks, panels, borders or text. Do not draw famous characters. Portrait 2:3.`;
        const response=await client.images.generate({model:process.env.BEJ_HQ_IMAGE_MODEL??'gpt-image-1.5',size:'1024x1536',quality:'high',output_format:'png',n:1,prompt});
        const b64=response.data?.[0]?.b64_json;
        if(!b64)throw new Error('API de imagem não retornou b64_json.');
        const bytes=Buffer.from(b64,'base64');
        const meta=await sharp(bytes).metadata();
        if(meta.format!=='png'||meta.width!==1024||meta.height!==1536)throw new Error('Painel nativo inesperado; abortado para evitar ampliação excessiva.');
        art.push(bytes);
        console.log(`  Painel ${i+1}/4 gerado`);
      }
      const png=await compose(sharp,art,story);
      const candidate=path.join(pendingRoot,`${id}.png`);
      await atomic(candidate,png);
      await validatePng(sharp,candidate);
      const manifest={locale,id,intentionId:item.intention.id,level:item.level,exampleItem:item.example.exampleItem,textSha256:digest(item.example.exampleItem),imageSha256:digest(png),image:`reports/hq/pending/${locale}/${id}.png`,expectedHqImage:publicUrl(item.level,id),story,generatedAt:new Date().toISOString(),status:'AWAITING_MANUAL_VISUAL_REVIEW'};
      await atomic(path.join(pendingRoot,`${id}.json`),JSON.stringify(manifest,null,2)+'\n');
      console.log(`PENDENTE DE REVISÃO: ${path.relative(ROOT,candidate)}\nApós inspecionar, execute --locale=${locale} --approve-id=${id} --reviewed`);
    }catch(e){console.error(`FALHA ${id}: ${e.message}`);process.exitCode=1;break;}
  }
}
if(args['approve-id'])await approve(args['approve-id']);else await generate();
