import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { locales, outputRoot, read, write, digest, equalSets, hashSet } from './migration-v4-common.mjs';

// Portuguese-only data adaptation. Existing examples, identifiers and local media
// are immutable. Phrase rules intentionally recognize documented usages rather
// than claiming to be a complete Portuguese parser.
export const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const word = '[a-zà-öø-ÿ]+';
const infinitive = '[a-zà-öø-ÿ]*(?:ar|er|ir|or)';
const gerund = '[a-zà-öø-ÿ]+(?:ando|endo|indo|pondo)';
const participle = '(?:[a-zà-öø-ÿ]+(?:ado|ada|ados|adas|ido|ida|idos|idas)|feito|feita|feitos|feitas|dito|dita|visto|vista|posto|posta|aberto|aberta|escrito|escrita|pago|paga|ganho|ganha|morto|morta|preso|presa|aceito|aceita|sido|tido|vindo)';
const clause = '[^.!?;\\n]{1,180}';
const boundary = '[a-zà-öø-ÿ0-9_]';
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
export const bounded = expression => `(?<!${boundary})(?:${expression})(?!${boundary})`;
const names = {
  'Eu sei / eu não sei + WH + to + verb': 'Eu sei / eu não sei + o que, onde, quando ou como + infinitivo',
  'Eu sei / eu não sei + WH + clause': 'Eu sei / eu não sei + o que, onde, quando, como ou quem + oração',
  'Buffer de pensamento': 'Pausa para organizar o pensamento',
  'Softening (suavização social)': 'Suavização social',
  'Softening profissional': 'Suavização profissional',
  'Expandir fillers emocionais': 'Expressões de conexão emocional',
  'Hedging profissional': 'Expressar cautela no contexto profissional',
  'Reported speech automático': 'Discurso indireto recorrente',
  'Emotional framing': 'Enquadramento emocional da fala',
  'Reaction language': 'Expressões de reação',
  'Framing e argumentação avançada': 'Enquadramento e argumentação avançada',
  'Opinion Pattern': 'Opinião com justificativa',
  'Preference Pattern': 'Preferência com justificativa',
  'Contrast Pattern': 'Contraste entre ideias',
  'Cause Pattern': 'Causa e explicação',
  'Condition Pattern': 'Condição e consequência',
  'Example Pattern': 'Exemplificação',
  'Sequence Pattern': 'Sequência de ações',
  'Personal Experience Pattern': 'Experiência pessoal',
  'Problem-Solution Pattern': 'Problema e solução',
  'Hypothesis Pattern': 'Desejo e hipótese',
  'Reasoning Pattern': 'Desenvolvimento do raciocínio',
  'Conclusion Pattern': 'Conclusão de uma ideia',
};
// Each override describes Portuguese word order and morphology independently
// from the English catalog. Keys are source labels, never intention IDs.
const rules = new Map();
function rule(name, structure, pattern, regex) { rules.set(name, { structure, pattern, regex }); }
rule('Ação (verbo)', 'Presente, pretérito e futuro em português', 'sujeito + verbo conjugado; sujeito + ir no presente + infinitivo',
  `(?:corro|corre|correm|corremos|corri|correu|correram|corria|nado|nada|nadam|nadei|nadou|estudo|estuda|estudam|estudei|estudou|trabalho|trabalha|trabalham|trabalhei|trabalhou|acordo|acorda|acordam|acordei|acordou|acordaram|fiz|fez|faço|faz|fui|foi|vou|vai|vamos|vão)(?:\\s+${infinitive})?`);
rule('Pode, podia, poderia, deveria, deve', 'Possibilidade, conselho e obrigação', 'poder ou dever conjugado + infinitivo; talvez + subjuntivo',
  `(?:(?:posso|pode|podemos|podem|podia|podiam|poderia|poderíamos|poderiam|devo|deve|devemos|devem|devia|deveria|deveriam)\\s+${infinitive}|talvez\\s+${word})`);
rule('Sou / estou (agora)', 'Ser e estar no presente', 'ser no presente + característica; estar no presente + estado ou gerúndio', '(?:sou|é|somos|são|estou|está|estamos|estão)');
rule('Era (estado) / estava (processo) / estive / esteve', 'Ser e estar no passado', 'ser ou estar no passado + estado; estar no passado + gerúndio', '(?:era|éramos|eram|estava|estávamos|estavam|estive|esteve|estivemos|estiveram)');
rule('Estou / está / venho / vem (há algum tempo)', 'Processo iniciado antes e ainda em andamento', 'estar ou vir no presente + gerúndio', `(?:estou|está|estamos|estão|venho|vem|vimos|vêm)\\s+${gerund}`);
rule('Tem / tenho / tenha / tiver + particípio', 'Ter + particípio', 'ter conjugado + particípio', `(?:tenho|tem|temos|têm|tenha|tenham|tiver|tivermos|tiverem)\\s+${participle}`);
rule('Tem / tenho / tenha + particípio + adjetivo', 'Ter + particípio + adjetivo', 'ter conjugado + particípio + adjetivo', `(?:tenho|tem|temos|têm|tenha|tenham)\\s+${participle}\\s+${word}`);
rule('Tem que / tenho que / tenha que', 'Obrigação com ter que', 'ter conjugado + que + infinitivo', `(?:tenho|tem|temos|têm|tenha|tenham)\\s+que\\s+${infinitive}`);
rule('Estou / está tendo que + verbo', 'Obrigação em andamento', 'estar conjugado + tendo que + infinitivo', `(?:estou|está|estamos|estão)\\s+tendo\\s+que\\s+${infinitive}`);
rule('Teve / tive', 'Ter no pretérito perfeito', 'ter no pretérito perfeito + complemento', '(?:tive|teve|tivemos|tiveram)');
rule('Tem / tenho + sido', 'Ter + sido', 'ter no presente + sido + característica ou estado', '(?:tenho|tem|temos|têm)\\s+sido');
rule('Tem / tenho / tenha + tido', 'Ter + tido', 'ter conjugado + tido + complemento', '(?:tenho|tem|temos|têm|tenha|tenham)\\s+tido');
rule('Tinha + particípio', 'Pretérito mais-que-perfeito composto', 'ter no pretérito imperfeito + particípio', `(?:tinha|tínhamos|tinham)\\s+${participle}`);
rule('Tinha que / tive que / teve que', 'Obrigação no passado', 'ter no passado + que + infinitivo', `(?:tinha|tínhamos|tinham|tive|teve|tivemos|tiveram)\\s+que\\s+${infinitive}`);
rule('Haver / ter / existir / houve / havia / haverá', 'Existência com haver, ter e existir', 'haver ou ter impessoal + complemento; existir + sujeito', '(?:(?:não\\s+)?(?:há|houve|havia|haverá|tem|tinha|existe|existem)|(?:vai|pode|poderia|deveria|costumava)\\s+haver|(?:tem|tinha|teria)\\s+havido|já\\s+houve)');
rule('Tem que ter / tem que haver (existir)', 'Necessidade de existência', 'tem que + ter ou haver + complemento', 'tem\\s+que\\s+(?:ter|haver)');
rule('Estou / está se perguntando se', 'Dúvida em andamento', 'estar conjugado + pronome reflexivo + perguntando se + oração', '(?:estou|está|estamos|estão)\\s+(?:(?:me|se|nos)\\s+)?perguntando\\s+se');
rule('Me pergunto se / fico pensando se / será que', 'Pergunta indireta e dúvida', 'me pergunto se; fico pensando se; será que + oração', '(?:me\\s+pergunto\\s+se|fico\\s+pensando\\s+se|será\\s+que)');
for (const name of ['Não ... mais (no longer)', 'Não ... mais (any longer / anymore)']) rule(name, 'Não ... mais', 'não + verbo e complemento + mais', `não\\s+[^.!?;\\n]{1,140}?\\s+mais`);
rule('Tão + adjetivo + quanto', 'Comparação de igualdade', 'tão + adjetivo + quanto ou como + termo comparado', `tão\\s+[^.!?;\\n]{1,60}?\\s+(?:quanto|como)\\s+${word}`);
rule('Tanto quanto', 'Comparação de quantidade ou intensidade', 'tanto quanto + termo comparado', 'tanto\\s+quanto');
rule('Houve agora / acabou de haver / surgiu', 'Existência ou surgimento recente', 'acabou de haver; houve agora; surgiu + complemento', '(?:acabou\\s+de\\s+haver|houve\\s+agora|surgiu)');
rule('Vinha + gerúndio', 'Processo em andamento no passado', 'vir no pretérito imperfeito + gerúndio', `(?:vinha|vínhamos|vinham)\\s+${gerund}`);
rule('Fato / experiência / resultado com relevância atual', 'Experiência passada relevante no presente', 'verbo no pretérito perfeito, com interpretação de experiência ou resultado atual', '(?:viajei|viajou|fiz|fez|fui|foi|conheci|conheceu|aprendi|aprendeu)');
rule('Momento passado com marcador de tempo', 'Ação passada situada no tempo', 'verbo no passado + marcador temporal', `${clause}\\s+(?:ontem|anteontem|no\\s+último\\s+mês|na\\s+semana\\s+passada|no\\s+ano\\s+passado|há\\s+${word}\\s+dias)`);
rule('Vou / vai (decisão ou plano)', 'Futuro com ir + infinitivo', 'ir no presente + infinitivo', `(?:vou|vai|vamos|vão)\\s+${infinitive}`);
rule('Estou indo / está indo', 'Deslocamento ou viagem planejada', 'estar conjugado + indo + destino; ir no presente + viajar', '(?:(?:estou|está|estamos|estão)\\s+indo|(?:vou|vai|vamos|vão)\\s+viajar)');
rule('Vou / vai ficar / ser', 'Estado ou característica futura', 'ir no presente + ser, estar ou ficar + complemento', '(?:vou|vai|vamos|vão)\\s+(?:ser|estar|ficar)');
rule('Vou / vai ter que', 'Obrigação futura', 'ir no presente + ter que + infinitivo', `(?:vou|vai|vamos|vão)\\s+ter\\s+que\\s+${infinitive}`);
rule('Seja / esteja / espero estar', 'Estado desejado ou esperado', 'seja ou esteja + complemento; espero estar + complemento', '(?:seja|sejam|esteja|estejam|espero\\s+estar)');
rule('Ia + verbo', 'Plano ou intenção no passado', 'ir no pretérito imperfeito + infinitivo', `(?:ia|íamos|iam)\\s+${infinitive}`);
rule('Costumava', 'Hábito no passado', 'costumar no pretérito imperfeito + infinitivo', `(?:costumava|costumávamos|costumavam)\\s+${infinitive}`);
rule('Acostumado', 'Estar acostumado a', 'estar conjugado + acostumado ou acostumada + a + complemento', '(?:acostumado|acostumada|acostumados|acostumadas)\\s+a');
rule('Costumo', 'Hábito no presente', 'costumar no presente + infinitivo', `(?:costumo|costuma|costumamos|costumam)\\s+${infinitive}`);
rule('Se / me acostumando (processo em andamento)', 'Acostumar-se em andamento', 'estar conjugado + pronome reflexivo + acostumando + a + complemento', '(?:me|se|nos)\\s+acostumando');
for (const [name, modal] of [['Deveria ter', '(?:deveria|deveríamos|deveriam)'], ['Poderia ter', '(?:poderia|poderíamos|poderiam)'], ['Deve ter', '(?:deve|devem)']]) rule(name, `${name} + particípio`, `${name.toLowerCase()} + particípio`, `${modal}\\s+ter\\s+${participle}`);
rule('Sempre que / toda vez que / quando quer que / a qualquer momento que', 'Repetição ou indefinição temporal', 'sempre que; toda vez que; quando quer que + oração', '(?:sempre\\s+que|toda\\s+vez\\s+que|quando\\s+quer\\s+que|a\\s+qualquer\\s+momento\\s+que)');
rule('Qualquer lugar / aonde quiser', 'Lugar sem restrição', 'onde ou aonde + quiser; onde quer que + oração', '(?:(?:a?onde)\\s+quer\\s+que|(?:a?onde)\\s+(?:você\\s+)?quiser|qualquer\\s+lugar)');
rule('Como / do jeito que / conforme / não importa como', 'Modo sem restrição', 'como; do jeito que; conforme; não importa como + oração', '(?:como|do\\s+jeito\\s+que|conforme|não\\s+importa\\s+como)');
rule('... para que ...', 'Finalidade com para que', 'oração principal + para que + subjuntivo', 'para\\s+que');
rule('Para que [algo] é usado / serve para quê', 'Perguntar a finalidade', 'para que + sujeito + é usado; sujeito + serve para quê', '(?:para\\s+que|serve\\s+para\\s+qu[êe])');
rule('Ter a oportunidade / ter a chance de', 'Oportunidade de realizar uma ação', 'ter conjugado + a oportunidade ou a chance + de + infinitivo', '(?:tenho|tem|tinha|tive|teve|ter|teremos)\\s+a\\s+(?:oportunidade|chance)\\s+de');
rule('Conseguindo (progresso/avanço)', 'Progresso em direção a um resultado', 'estar conjugado + conseguindo resultados; estar conjugado + chegando lá', '(?:estou|está|estamos|estão)\\s+(?:conseguindo|chegando\\s+lá)');
rule('Fiquei + gerúndio', 'Continuidade de uma ação no passado', 'ficar no passado + gerúndio', `(?:fiquei|ficou|ficamos|ficaram)\\s+${gerund}`);
rule('Fiquei + tempo + gerúndio', 'Duração de uma ação passada', 'ficar no passado + duração + gerúndio', `(?:fiquei|ficou|ficamos|ficaram)\\s+[^.!?;\\n]{1,60}?\\s+${gerund}`);
rule('Não gosto (níveis)', 'Rejeição e desagrado', 'não gosto de; não suporto; odeio + complemento', '(?:não\\s+(?:gosto|suporto)|odeio)');
rule('Se eu ...esse (hipótese irreal presente/futuro)', 'Hipótese com pretérito imperfeito do subjuntivo', 'se + sujeito + imperfeito do subjuntivo; consequência no futuro do pretérito', `se\\s+(?:eu|você|ele|ela|nós|eles|elas)\\s+${word}(?:sse|ssem|ssemos)`);
rule('Se eu tivesse... (hipótese irreal passada)', 'Hipótese contrária a um fato passado', 'se + sujeito + tivesse + particípio; teria + particípio', `se\\s+(?:eu|você|ele|ela|nós|eles|elas)\\s+(?:tivesse|tivéssemos|tivessem)\\s+${participle}`);
rule('Se (real / possível) ... vai/vou/irá', 'Condição possível no futuro', 'se + futuro do subjuntivo; consequência futura', `se\\s+${clause}`);
rule('Se (sempre / regra / hábito)', 'Condição habitual', 'se + presente do indicativo; consequência no presente', `se\\s+${clause}`);
rule('Eu sei / eu não sei + WH + to + verb', 'Saber como realizar uma ação', '(eu) sei ou não sei + o que, onde, quando ou como + infinitivo', `(?:não\\s+)?sei\\s+(?:o\\s+que|onde|quando|como)\\s+${infinitive}`);
rule('Eu sei / eu não sei + WH + clause', 'Saber uma informação', '(eu) sei ou não sei + interrogativo + oração', '(?:não\\s+)?sei\\s+(?:o\\s+que|onde|quando|como|quem)');
// Discourse families require actual markers, not isolated highlights such as
// "me", "corpo" or "tento" in the legacy data.
const discourseRules = [
  ['Buffer de pensamento', 'Pausa para organizar o pensamento', 'bem; sabe; deixa eu pensar', 'bem|sabe|deixa\\s+eu\\s+pensar'],
  ['Organização de ideias', 'Organização de ideias', 'primeiro de tudo; o ponto principal é; por outro lado', 'primeiro\\s+de\\s+tudo|o\\s+ponto\\s+principal\\s+é|por\\s+outro\\s+lado'],
  ['Softening (suavização social)', 'Suavização social', 'eu acho; meio; não tenho tanta certeza', '(?:eu\\s+)?acho|meio|não\\s+tenho\\s+tanta\\s+certeza'],
  ['Correção e reformulação', 'Reformulação do que foi dito', 'quero dizer; o que eu quero dizer é; em outras palavras', '(?:o\\s+que\\s+eu\\s+)?quero\\s+dizer|em\\s+outras\\s+palavras'],
  ['Softening profissional', 'Suavização no contexto profissional', 'estava me perguntando se; você se importaria; talvez seja melhor', 'estava\\s+me\\s+perguntando\\s+se|(?:você\\s+)?se\\s+importaria|talvez\\s+seja\\s+melhor'],
  ['Hedging profissional', 'Cautela ao apresentar uma opinião', 'da minha perspectiva; pelo que eu sei; parece que', 'da\\s+minha\\s+perspectiva|pelo\\s+que\\s+(?:eu\\s+)?sei|parece\\s+que'],
  ['Reported speech automático', 'Discurso indireto', 'contou que; disse que; perguntou se + oração', '(?:contou|disse)\\s+que|perguntou\\s+se'],
  ['Emotional framing', 'Enquadramento emocional da fala', 'sujeito + ficou tipo; sujeito + disse + fala reproduzida', 'ficou\\s+tipo|disse'],
  ['Reaction language', 'Reação ao que foi dito', 'isso é bem interessante; isso faz sentido; entendo o que você disse', 'isso\\s+é\\s+bem\\s+interessante|(?:isso\\s+)?faz\\s+sentido|entendo\\s+o\\s+que\\s+você\\s+disse'],
  ['Framing e argumentação avançada', 'Enquadramento de argumentos', 'o problema principal é que; o que realmente importa é; de uma perspectiva mais ampla', 'o\\s+problema\\s+principal\\s+é\\s+que|o\\s+que\\s+realmente\\s+importa\\s+é|de\\s+uma\\s+perspectiva\\s+mais\\s+ampla'],
  ['Isso criou oportunidades', 'Criar oportunidades', 'abrir portas; abrir muitas portas', 'abri(?:r|u|ram|ndo)?\\s+(?:muitas\\s+)?portas'],
  ['Estruturas de opinião', 'Expressar uma opinião', 'eu acho; eu acredito + que + oração', '(?:eu\\s+)?(?:acho|acredito)'],
  ['Estruturas de hipótese conversacional', 'Introduzir uma hipótese', 'e se; imagine se + oração', 'e\\s+se|imagine\\s+se'],
  ['Reagir ao que o outro disse', 'Relacionar uma fala a uma experiência', 'isso me lembra; na verdade, eu tive uma experiência parecida', 'isso\\s+me\\s+lembra|na\\s+verdade,?\\s+eu\\s+tive\\s+uma\\s+experiência\\s+parecida'],
  ['Opinion Pattern', 'Opinião com justificativa', 'eu acho que + opinião + porque + justificativa', `acho\\s+que\\s+${clause}\\s+porque\\s+${word}`],
  ['Preference Pattern', 'Preferência com justificativa', 'eu prefiro + opção + porque + motivo', `prefiro\\s+${clause}\\s+porque\\s+${word}`],
  ['Contrast Pattern', 'Contraste entre ideias', 'oração + mas + oração', `mas\\s+${word}`],
  ['Cause Pattern', 'Causa e explicação', 'oração + porque + explicação', `porque\\s+${word}`],
  ['Condition Pattern', 'Condição e consequência', 'se + condição + consequência', `se\\s+${clause}`],
  ['Example Pattern', 'Exemplificação', 'por exemplo; como; às vezes + situação ilustrativa', 'por\\s+exemplo|às\\s+vezes'],
  ['Sequence Pattern', 'Sequência de ações', 'primeiro + ação; depois + ação; finalmente + ação', 'primeiro|depois|finalmente'],
  ['Personal Experience Pattern', 'Experiência pessoal', 'no meu caso; na minha experiência + relato', 'no\\s+meu\\s+caso|na\\s+minha\\s+experiência'],
  ['Problem-Solution Pattern', 'Problema e solução', 'problema + então + solução', `então\\s+${word}`],
  ['Hypothesis Pattern', 'Desejo e hipótese', 'gostaria de poder + infinitivo', `gostaria\\s+de\\s+poder\\s+${infinitive}`],
  ['Reasoning Pattern', 'Desenvolvimento do raciocínio', 'afirmação + mas + contraponto; então + conclusão', '(?:mas|então)'],
  ['Conclusion Pattern', 'Conclusão de uma ideia', 'portanto; por isso; no fim das contas + conclusão', 'portanto|por\\s+isso|no\\s+fim\\s+das\\s+contas'],
];
for (const entry of discourseRules) rule(...entry);

const cleanName = text => (names[text] ?? text)
  .replace(/\((?:no longer|any longer\s*\/\s*anymore)\)/gi, '')
  .replace(/\s+/g, ' ').trim();
const aliases = text => cleanName(text).replace(/\([^)]*\)/g, '').split(/\s*\/\s*/)
  .map(value => value.replace(/\.{2,}|…/g, '').trim()).filter(Boolean);
const stop = new Set(['eu', 'tu', 'ele', 'ela', 'nós', 'você', 'vocês', 'eles', 'elas', 'me', 'se', 'nos', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'que', 'não', 'é', 'tem', 'tenho', 'tinha', 'está', 'estou', 'foi', 'mais', 'como', 'para', 'por', 'com']);

export function localize(item, english, review) {
  const title = cleanName(item.intention);
  const preset = rules.get(item.intention);
  const variants = aliases(item.intention);
  const documented = item.examples.map(example => example.intent.trim());
  const phrases = [...new Set([...variants.filter(value =>
    !/[+\[\]]|\b(?:sujeito|verbo|adjetivo|particípio|gerúndio|oração|complemento)\b/i.test(value) &&
    item.examples.some(example => normalize(example.exampleItem).includes(normalize(value)))), ...documented.filter(value =>
    !stop.has(value.toLowerCase()) && (value.split(/\s+/).length > 1 || variants.some(variant => normalize(variant) === normalize(value))))])];
  const regexes = preset ? [bounded(preset.regex)] : phrases.map(phrase => bounded(escape(phrase)));
  if (!regexes.length) {
    // Never fall back to English or a generic catch-all expression.
    for (const example of item.examples) regexes.push(bounded(escape(example.exampleItem.trim().replace(/[.!?]+$/, ''))));
    review.push({ intention: title, reason: 'Destaques insuficientes; reconhecimento restrito aos exemplos completos documentados.' });
  }
  const corpus = normalize([title, item.description, ...item.examples.flatMap(example => [example.exampleItem, example.intent])].join(' '));
  const englishCorpus = normalize([english.structure, english.pattern, ...english.examples.flatMap(example => [example.exampleItem, example.intent])].join(' '));
  const retained = [];
  const removed = [];
  for (const term of item.searchTerms) {
    const normalized = normalize(term);
    if (corpus.includes(normalized)) retained.push(term);
    else if (englishCorpus.includes(normalized)) removed.push(term);
    else {
      retained.push(term);
      review.push({ intention: title, reason: 'Termo de busca curado preservado; idioma/equivalencia requer revisao.', term });
    }
  }
  const terms = [...retained, ...variants, ...(preset ? preset.pattern.split(/;\s*/).filter(term => !term.includes('+')) : []), ...phrases]
    .map(value => value.replace(/[.!?]+$/, '').trim())
    .filter(value => value && !/[+\[\]]/.test(value) && !stop.has(value.toLowerCase()) && value.split(/\s+/).length <= 10);
  const seen = new Set();
  const searchTerms = terms.filter(term => { const key = normalize(term); if (seen.has(key)) return false; seen.add(key); return true; });
  if (!searchTerms.length) searchTerms.push(title);
  const result = { ...item, intention: title, structure: preset?.structure ?? title,
    pattern: preset?.pattern ?? title, validationPatterns: [...new Set(regexes)], searchTerms };
  const unmatched = item.examples.flatMap((example, index) => result.validationPatterns.some(pattern => new RegExp(pattern, 'i').test(example.exampleItem)) ? [] : [index + 1]);
  if (unmatched.length) review.push({ intention: title, reason: 'Exemplos legados nao reconhecidos pela regra portuguesa; revisar o conteudo sem ampliar artificialmente a regra.', examples: unmatched });
  return { result, removed };
}

export function run() {
  const target = 'public/sample-hashmap-pt-BR.json';
  const before = read(target);
  const english = read('public/sample-hashmap-en-US.json');
  const englishMap = new Map(english.mentalMap.map(item => [item.id, item]));
  const review = [];
  const changes = [];
  const data = { ...before, mentalMap: before.mentalMap.map(item => {
    const { result, removed } = localize(item, englishMap.get(item.id), review);
    const fields = Object.keys(result).filter(key => !isDeepStrictEqual(result[key], item[key]));
    changes.push({ intention: result.intention, fields, removedEnglishSearchTerms: removed });
    return result;
  }) };
  // Preservation is checked before the first write.
  const editable = new Set(['intention', 'structure', 'pattern', 'validationPatterns', 'searchTerms']);
  for (let index = 0; index < before.mentalMap.length; index++) {
    for (const key of Object.keys(before.mentalMap[index])) if (!editable.has(key) && !isDeepStrictEqual(before.mentalMap[index][key], data.mentalMap[index][key])) throw new Error('Campo protegido alterado.');
    for (const pattern of data.mentalMap[index].validationPatterns) new RegExp(pattern, 'i');
  }
  const coverage = {};
  for (const locale of locales) {
    const catalog = locale === 'pt-BR' ? data : read(`public/sample-hashmap-${locale}.json`);
    const ids = new Set(catalog.mentalMap.map(item => item.id));
    if (ids.size !== catalog.mentalMap.length || !equalSets(ids, new Set(data.mentalMap.map(item => item.id)))) throw new Error('IDs duplicados ou cobertura divergente.');
    coverage[locale] = { count: ids.size, hash: hashSet(ids) };
  }
  const backup = path.join(outputRoot, 'pt-localization-backups', `${digest(fs.readFileSync(target))}.json`);
  if (!fs.existsSync(backup)) write(backup, before);
  write(target, data);
  write(path.join(outputRoot, target), data);
  write(path.join(outputRoot, 'pt-localization-report.json'), {
    status: review.length ? 'localized-with-review-items' : 'localized', coverage,
    preserved: ['IDs de intencoes e exemplos', 'exemplos completos', 'metadata', 'midias locais', 'categorias e tags', 'relacionamentos', 'demais idiomas'],
    regexScope: 'Construcoes gramaticais portuguesas e expressoes documentadas; nao e um analisador completo do portugues.',
    legacyExampleCountBelowThree: data.mentalMap.filter(item => item.examples.length < 3).length,
    note: 'Exemplos e IDs nao foram criados, removidos ou reescritos. Contagens antigas inferiores a tres permanecem registradas para trabalho separado.',
    changes, review,
  });
  console.log(`Portugues localizado: ${changes.filter(change => change.fields.length).length} intencoes; ${review.length} observacoes. IDs e exemplos preservados.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) run();
