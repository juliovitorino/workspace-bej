import type { StudentLanguage } from "./languages";
import type { SpeakingVerb } from "../types/englishVerb";

/**
 * JOGO DA FALA — cada intenção tem uma chave estável e um rótulo por idioma.
 * A ordem deste catálogo continua determinando a ordem do modo sequencial.
 * O sujeito é escolhido por rodada nas estruturas verbais.
 * As unidades gramaticais do livro funcionam como desafios independentes.
 */
type FormLabels = Record<StudentLanguage, string>;
export type SpeakingFormKind = "verb" | "topic";
export interface SpeakingFormDefinition { key: string; label: string; kind: SpeakingFormKind; }

export const SPEAKING_GAME_FORMS: ReadonlyArray<{ key: string; labels: FormLabels; kind?: SpeakingFormKind }> = [
  { key: "present", labels: { "pt-BR": "Presente", "en-US": "I +verb", "es-ES": "Presente", "fr-FR": "Présent" } },
  { key: "ongoing", labels: { "pt-BR": "Ação em andamento", "en-US": "I am +verb-ing", "es-ES": "Acción en curso", "fr-FR": "Action en cours" } },
  { key: "past", labels: { "pt-BR": "Passado", "en-US": "I +verb-past", "es-ES": "Pretérito indefinido", "fr-FR": "Passé composé" } },
  { key: "pastOngoing", labels: { "pt-BR": "Ação em andamento no passado", "en-US": "I was +verb-ing", "es-ES": "Acción en curso en el pasado", "fr-FR": "Imparfait" } },
  { key: "duration", labels: { "pt-BR": "Duração até agora", "en-US": "I have been +verb-ing", "es-ES": "Duración hasta ahora", "fr-FR": "Durée jusqu'au présent" } },
  { key: "future", labels: { "pt-BR": "Futuro próximo", "en-US": "I am going to +verb", "es-ES": "Futuro próximo", "fr-FR": "Futur proche" } },
  { key: "habit", labels: { "pt-BR": "Hábito no passado", "en-US": "I used to +verb", "es-ES": "Hábito en el pasado", "fr-FR": "Habitude passée" } },
  { key: "recent", labels: { "pt-BR": "Passado recente", "en-US": "I have just +verb-participle", "es-ES": "Pasado reciente", "fr-FR": "Passé récent" } },
  { key: "regret", labels: { "pt-BR": "Arrependimento", "en-US": "I should have +verb-participle", "es-ES": "Obligación no cumplida", "fr-FR": "Regret" } },
  { key: "possibility", labels: { "pt-BR": "Possibilidade no passado", "en-US": "I could have +verb-participle", "es-ES": "Posibilidad en el pasado", "fr-FR": "Possibilité passée" } },
  { key: "prior", labels: { "pt-BR": "Anterioridade no passado", "en-US": "I had been +verb-ing", "es-ES": "Anterioridad en el pasado", "fr-FR": "Plus-que-parfait" } },
  { key: "intended", labels: { "pt-BR": "Intenção no passado", "en-US": "I was going to +verb", "es-ES": "Intención en el pasado", "fr-FR": "Intention passée" } },
  { key: "perfect", labels: { "pt-BR": "Experiência / passado composto", "en-US": "I've +verb-participle", "es-ES": "Pretérito perfecto", "fr-FR": "Expérience passée" } },
  { key: "ability", labels: { "pt-BR": "Capacidade", "en-US": "I can +verb", "es-ES": "Capacidad", "fr-FR": "Capacité" } },
  { key: "hypothetical", labels: { "pt-BR": "Possibilidade hipotética", "en-US": "I could +verb", "es-ES": "Posibilidad hipotética", "fr-FR": "Possibilité hypothétique" } },
  { key: "obligation", labels: { "pt-BR": "Obrigação", "en-US": "I must +verb", "es-ES": "Obligación", "fr-FR": "Obligation" } },
  { key: "advice", labels: { "pt-BR": "Conselho", "en-US": "I should +verb", "es-ES": "Consejo", "fr-FR": "Conseil" } },
  // Unidades 1–83 do índice fornecido; itens 36 e 37 foram desdobrados.
  { key: "book01", kind: "topic", labels: { "pt-BR": "Ser/estar: presente", "en-US": "am/is/are", "es-ES": "Ser/estar: presente", "fr-FR": "Être: présent" } },
  { key: "book02", kind: "topic", labels: { "pt-BR": "Perguntas com ser/estar", "en-US": "am/is/are (questions)", "es-ES": "Preguntas con ser/estar", "fr-FR": "Questions avec être" } },
  { key: "book03", kind: "topic", labels: { "pt-BR": "Presente contínuo", "en-US": "I am doing (present continuous)", "es-ES": "Presente continuo", "fr-FR": "Présent progressif" } },
  { key: "book04", kind: "topic", labels: { "pt-BR": "Perguntas no presente contínuo", "en-US": "Are you doing?", "es-ES": "Preguntas en presente continuo", "fr-FR": "Questions au présent progressif" } },
  { key: "book05", kind: "topic", labels: { "pt-BR": "Presente simples", "en-US": "I do / work / like (present simple)", "es-ES": "Presente simple", "fr-FR": "Présent simple" } },
  { key: "book06", kind: "topic", labels: { "pt-BR": "Negação no presente simples", "en-US": "I don’t ... (present simple negative)", "es-ES": "Negación en presente simple", "fr-FR": "Négation au présent" } },
  { key: "book07", kind: "topic", labels: { "pt-BR": "Perguntas no presente simples", "en-US": "Do you ... ? (present simple questions)", "es-ES": "Preguntas en presente simple", "fr-FR": "Questions au présent" } },
  { key: "book08", kind: "topic", labels: { "pt-BR": "Presente contínuo versus simples", "en-US": "I am doing vs. I do", "es-ES": "Presente continuo frente a simple", "fr-FR": "Présent progressif ou simple" } },
  { key: "book09", kind: "topic", labels: { "pt-BR": "Ter / possuir", "en-US": "I have ... / I’ve got ...", "es-ES": "Tener / poseer", "fr-FR": "Avoir / posséder" } },
  { key: "book10", kind: "topic", labels: { "pt-BR": "Ser/estar no passado", "en-US": "was / were", "es-ES": "Ser/estar en pasado", "fr-FR": "Être au passé" } },
  { key: "book11", kind: "topic", labels: { "pt-BR": "Passado simples", "en-US": "worked / got / went (past simple)", "es-ES": "Pasado simple", "fr-FR": "Passé composé" } },
  { key: "book12", kind: "topic", labels: { "pt-BR": "Negação e perguntas no passado", "en-US": "I didn’t ... / Did you ... ?", "es-ES": "Negación y preguntas en pasado", "fr-FR": "Négation et questions au passé" } },
  { key: "book13", kind: "topic", labels: { "pt-BR": "Passado contínuo", "en-US": "I was doing (past continuous)", "es-ES": "Pasado continuo", "fr-FR": "Imparfait / action en cours" } },
  { key: "book14", kind: "topic", labels: { "pt-BR": "Passado contínuo versus simples", "en-US": "I was doing vs. I did", "es-ES": "Pasado continuo frente a simple", "fr-FR": "Imparfait ou passé composé" } },
  { key: "book15", kind: "topic", labels: { "pt-BR": "Presente perfeito", "en-US": "I have done (present perfect)", "es-ES": "Pretérito perfecto", "fr-FR": "Passé composé" } },
  { key: "book16", kind: "topic", labels: { "pt-BR": "Acabei de / já / ainda não", "en-US": "I’ve just ... / I’ve already ... / I haven’t ... yet", "es-ES": "Acabo de / ya / todavía no", "fr-FR": "Je viens de / déjà / pas encore" } },
  { key: "book17", kind: "topic", labels: { "pt-BR": "Você já alguma vez...?", "en-US": "Have you ever ... ?", "es-ES": "¿Alguna vez has...?", "fr-FR": "As-tu déjà ... ?" } },
  { key: "book18", kind: "topic", labels: { "pt-BR": "Há quanto tempo você...?", "en-US": "How long have you ... ?", "es-ES": "¿Desde hace cuánto tiempo...?", "fr-FR": "Depuis combien de temps ... ?" } },
  { key: "book19", kind: "topic", labels: { "pt-BR": "Durante / desde / há", "en-US": "for / since / ago", "es-ES": "Durante / desde / hace", "fr-FR": "Pendant / depuis / il y a" } },
  { key: "book20", kind: "topic", labels: { "pt-BR": "Presente perfeito versus passado", "en-US": "I have done vs. I did", "es-ES": "Pretérito perfecto frente a indefinido", "fr-FR": "Passé composé et passé simple (usage)" } },
  { key: "book21", kind: "topic", labels: { "pt-BR": "Voz passiva no presente e passado", "en-US": "is done / was done (passive)", "es-ES": "Voz pasiva en presente y pasado", "fr-FR": "Voix passive au présent et passé" } },
  { key: "book22", kind: "topic", labels: { "pt-BR": "Voz passiva contínua e perfeita", "en-US": "is being done / has been done (passive)", "es-ES": "Voz pasiva continua y perfecta", "fr-FR": "Voix passive progressive et accomplie" } },
  { key: "book23", kind: "topic", labels: { "pt-BR": "Ser, ter e fazer: presente e passado", "en-US": "be / have / do (present and past)", "es-ES": "Ser, tener y hacer: presente y pasado", "fr-FR": "Être, avoir et faire : présent et passé" } },
  { key: "book24", kind: "topic", labels: { "pt-BR": "Verbos regulares e irregulares", "en-US": "Regular and irregular verbs", "es-ES": "Verbos regulares e irregulares", "fr-FR": "Verbes réguliers et irréguliers" } },
  { key: "book25", kind: "topic", labels: { "pt-BR": "Eu costumava...", "en-US": "I used to ...", "es-ES": "Yo solía...", "fr-FR": "Avant, je ..." } },
  { key: "book26", kind: "topic", labels: { "pt-BR": "Planos futuros com presente contínuo", "en-US": "What are you doing tomorrow?", "es-ES": "Planes futuros con presente continuo", "fr-FR": "Projets futurs au présent" } },
  { key: "book27", kind: "topic", labels: { "pt-BR": "Eu vou... (intenção futura)", "en-US": "I’m going to ...", "es-ES": "Voy a... (intención futura)", "fr-FR": "Je vais... (futur proche)" } },
  { key: "book28", kind: "topic", labels: { "pt-BR": "Futuro com will/shall (1)", "en-US": "will / shall (1)", "es-ES": "Futuro con will/shall (1)", "fr-FR": "Futur avec will/shall (1)" } },
  { key: "book29", kind: "topic", labels: { "pt-BR": "Futuro com will/shall (2)", "en-US": "will / shall (2)", "es-ES": "Futuro con will/shall (2)", "fr-FR": "Futur avec will/shall (2)" } },
  { key: "book30", kind: "topic", labels: { "pt-BR": "Talvez / possibilidade com might", "en-US": "might", "es-ES": "Quizá / posibilidad con might", "fr-FR": "Peut-être / possibilité avec might" } },
  { key: "book31", kind: "topic", labels: { "pt-BR": "Poder / capacidade e possibilidade", "en-US": "can / could", "es-ES": "Poder / capacidad y posibilidad", "fr-FR": "Pouvoir / capacité et possibilité" } },
  { key: "book32", kind: "topic", labels: { "pt-BR": "Obrigação, proibição e ausência de necessidade", "en-US": "must / mustn’t / needn’t", "es-ES": "Obligación, prohibición y falta de necesidad", "fr-FR": "Obligation, interdiction et absence de nécessité" } },
  { key: "book33", kind: "topic", labels: { "pt-BR": "Deveria / conselho", "en-US": "should", "es-ES": "Debería / consejo", "fr-FR": "Devrait / conseil" } },
  { key: "book34", kind: "topic", labels: { "pt-BR": "Eu tenho que...", "en-US": "I have to ...", "es-ES": "Tengo que...", "fr-FR": "Je dois..." } },
  { key: "book35", kind: "topic", labels: { "pt-BR": "Você gostaria...? / Eu gostaria...", "en-US": "Would you like ... ? / I’d like ...", "es-ES": "¿Te gustaría...? / Me gustaría...", "fr-FR": "Voudrais-tu ... ? / Je voudrais ..." } },
  { key: "book36", kind: "topic", labels: { "pt-BR": "Há / existe (singular)", "en-US": "there is", "es-ES": "Hay (singular)", "fr-FR": "Il y a (singulier)" } },
  { key: "book36_1", kind: "topic", labels: { "pt-BR": "Há / existem (plural)", "en-US": "there are", "es-ES": "Hay (plural)", "fr-FR": "Il y a (pluriel)" } },
  { key: "book37", kind: "topic", labels: { "pt-BR": "Havia / houve", "en-US": "there was / there were", "es-ES": "Había / hubo", "fr-FR": "Il y avait / il y a eu" } },
  { key: "book37_1", kind: "topic", labels: { "pt-BR": "Tem havido / houve", "en-US": "there has been / there have been", "es-ES": "Ha habido", "fr-FR": "Il y a eu / il y a (depuis)" } },
  { key: "book37_2", kind: "topic", labels: { "pt-BR": "Haverá / vai haver", "en-US": "there will be", "es-ES": "Habrá / va a haber", "fr-FR": "Il y aura" } },
  { key: "book38", kind: "topic", labels: { "pt-BR": "Sujeito impessoal: it", "en-US": "It ... (impersonal subject)", "es-ES": "Sujeto impersonal: it", "fr-FR": "Sujet impersonnel : it" } },
  { key: "book39", kind: "topic", labels: { "pt-BR": "Respostas curtas com auxiliares", "en-US": "I am ... / I don’t ... etc.", "es-ES": "Respuestas cortas con auxiliares", "fr-FR": "Réponses courtes avec auxiliaires" } },
  { key: "book40", kind: "topic", labels: { "pt-BR": "Perguntas de reação", "en-US": "Have you? / Are you? / Don’t you?", "es-ES": "Preguntas de reacción", "fr-FR": "Questions de réaction" } },
  { key: "book41", kind: "topic", labels: { "pt-BR": "Também / tampouco / eu também", "en-US": "too / either / so am I / neither do I", "es-ES": "También / tampoco / yo también", "fr-FR": "Aussi / non plus / moi aussi" } },
  { key: "book42", kind: "topic", labels: { "pt-BR": "Formas negativas contraídas", "en-US": "isn’t / haven’t / don’t (negatives)", "es-ES": "Formas negativas contraídas", "fr-FR": "Formes négatives contractées" } },
  { key: "book43", kind: "topic", labels: { "pt-BR": "Perguntas com auxiliares", "en-US": "Is it ... ? / Have you ... ? / Do they ... ?", "es-ES": "Preguntas con auxiliares", "fr-FR": "Questions avec auxiliaires" } },
  { key: "book44", kind: "topic", labels: { "pt-BR": "Quem fez? / Quem recebeu a ação?", "en-US": "Who saw you? / Who did you see?", "es-ES": "¿Quién hizo? / ¿A quién viste?", "fr-FR": "Qui a fait ? / Qui as-tu vu ?" } },
  { key: "book45", kind: "topic", labels: { "pt-BR": "Perguntas com preposição / descrição", "en-US": "Who is she talking to? / What is it like?", "es-ES": "Preguntas con preposición / descripción", "fr-FR": "Questions avec préposition / description" } },
  { key: "book46", kind: "topic", labels: { "pt-BR": "O quê / qual / como", "en-US": "What ... ? / Which ... ? / How ... ?", "es-ES": "Qué / cuál / cómo", "fr-FR": "Quoi / quel / comment" } },
  { key: "book47", kind: "topic", labels: { "pt-BR": "Quanto tempo leva...?", "en-US": "How long does it take ... ?", "es-ES": "¿Cuánto tiempo tarda...?", "fr-FR": "Combien de temps faut-il ... ?" } },
  { key: "book48", kind: "topic", labels: { "pt-BR": "Perguntas indiretas", "en-US": "Do you know where ... ? / I don’t know what ...", "es-ES": "Preguntas indirectas", "fr-FR": "Questions indirectes" } },
  { key: "book49", kind: "topic", labels: { "pt-BR": "Discurso indireto: disse / contou", "en-US": "She said that ... / He told me that ...", "es-ES": "Estilo indirecto: dijo / contó", "fr-FR": "Discours indirect : a dit / a raconté" } },
  { key: "book50", kind: "topic", labels: { "pt-BR": "Verbo ou gerúndio", "en-US": "work/working · go/going · do/doing", "es-ES": "Verbo o gerundio", "fr-FR": "Verbe ou forme en -ing" } },
  { key: "book51", kind: "topic", labels: { "pt-BR": "Infinitivo versus gerúndio", "en-US": "to ... / -ing (I want to do / I enjoy doing)", "es-ES": "Infinitivo frente a gerundio", "fr-FR": "Infinitif ou gérondif" } },
  { key: "book52", kind: "topic", labels: { "pt-BR": "Quero que você... / Pedi para você...", "en-US": "I want you to ... / I told you to ...", "es-ES": "Quiero que tú... / Te dije que...", "fr-FR": "Je veux que tu... / Je t’ai dit de..." } },
  { key: "book53", kind: "topic", labels: { "pt-BR": "Finalidade: para fazer algo", "en-US": "I went to the shop to ...", "es-ES": "Finalidad: para hacer algo", "fr-FR": "But : pour faire quelque chose" } },
  { key: "book54", kind: "topic", labels: { "pt-BR": "Combinações com go", "en-US": "go to / go on / go for / go -ing", "es-ES": "Combinaciones con go", "fr-FR": "Expressions avec go" } },
  { key: "book55", kind: "topic", labels: { "pt-BR": "Usos de get", "en-US": "get", "es-ES": "Usos de get", "fr-FR": "Usages de get" } },
  { key: "book56", kind: "topic", labels: { "pt-BR": "Diferença entre do e make", "en-US": "do / make", "es-ES": "Diferencia entre do y make", "fr-FR": "Différence entre do et make" } },
  { key: "book57", kind: "topic", labels: { "pt-BR": "Usos de have", "en-US": "have", "es-ES": "Usos de have", "fr-FR": "Usages de have" } },
  { key: "book58", kind: "topic", labels: { "pt-BR": "Pronomes sujeito e objeto", "en-US": "I/me · he/him · they/them", "es-ES": "Pronombres sujeto y objeto", "fr-FR": "Pronoms sujets et compléments" } },
  { key: "book59", kind: "topic", labels: { "pt-BR": "Adjetivos possessivos", "en-US": "my / his / their", "es-ES": "Adjetivos posesivos", "fr-FR": "Adjectifs possessifs" } },
  { key: "book60", kind: "topic", labels: { "pt-BR": "De quem é? / Pronomes possessivos", "en-US": "Whose is this? / It’s mine/yours/hers", "es-ES": "¿De quién es? / Pronombres posesivos", "fr-FR": "À qui est-ce ? / Pronoms possessifs" } },
  { key: "book61", kind: "topic", labels: { "pt-BR": "Pronomes pessoais e possessivos", "en-US": "I / me / my / mine", "es-ES": "Pronombres personales y posesivos", "fr-FR": "Pronoms personnels et possessifs" } },
  { key: "book62", kind: "topic", labels: { "pt-BR": "Pronomes reflexivos", "en-US": "myself / yourself / themselves", "es-ES": "Pronombres reflexivos", "fr-FR": "Pronoms réfléchis" } },
  { key: "book63", kind: "topic", labels: { "pt-BR": "Posse com apóstrofo s", "en-US": "’s (Ann’s camera / my brother’s car)", "es-ES": "Posesión con apóstrofo s", "fr-FR": "Possession avec apostrophe s" } },
  { key: "book64", kind: "topic", labels: { "pt-BR": "Artigos indefinidos", "en-US": "a / an", "es-ES": "Artículos indefinidos", "fr-FR": "Articles indéfinis" } },
  { key: "book65", kind: "topic", labels: { "pt-BR": "Singular e plural", "en-US": "flower(s) / bus(es) (plural)", "es-ES": "Singular y plural", "fr-FR": "Singulier et pluriel" } },
  { key: "book66", kind: "topic", labels: { "pt-BR": "Contáveis e incontáveis (1)", "en-US": "a car / some money (countable vs. uncountable 1)", "es-ES": "Contables e incontables (1)", "fr-FR": "Dénombrables et indénombrables (1)" } },
  { key: "book67", kind: "topic", labels: { "pt-BR": "Contáveis e incontáveis (2)", "en-US": "a car / some money (countable vs. uncountable 2)", "es-ES": "Contables e incontables (2)", "fr-FR": "Dénombrables et indénombrables (2)" } },
  { key: "book68", kind: "topic", labels: { "pt-BR": "Artigos indefinido e definido", "en-US": "a/an vs. the", "es-ES": "Artículos indefinido y definido", "fr-FR": "Articles indéfini et défini" } },
  { key: "book69", kind: "topic", labels: { "pt-BR": "Artigo definido", "en-US": "the ...", "es-ES": "Artículo definido", "fr-FR": "Article défini" } },
  { key: "book70", kind: "topic", labels: { "pt-BR": "Preposições e artigos com lugares", "en-US": "go to work / go home / go to the cinema", "es-ES": "Preposiciones y artículos con lugares", "fr-FR": "Prépositions et articles avec lieux" } },
  { key: "book71", kind: "topic", labels: { "pt-BR": "Generalizações sem artigo", "en-US": "I like music / I hate exams", "es-ES": "Generalizaciones sin artículo", "fr-FR": "Généralités sans article" } },
  { key: "book72", kind: "topic", labels: { "pt-BR": "Artigos com nomes de lugares", "en-US": "the ... (names of places)", "es-ES": "Artículos con nombres de lugares", "fr-FR": "Articles avec noms de lieux" } },
  { key: "book73", kind: "topic", labels: { "pt-BR": "Demonstrativos", "en-US": "this / that / these / those", "es-ES": "Demostrativos", "fr-FR": "Démonstratifs" } },
  { key: "book74", kind: "topic", labels: { "pt-BR": "Substituição com one/ones", "en-US": "one / ones", "es-ES": "Sustitución con one/ones", "fr-FR": "Substitution avec one/ones" } },
  { key: "book75", kind: "topic", labels: { "pt-BR": "Algum / qualquer", "en-US": "some / any", "es-ES": "Alguno / cualquiera", "fr-FR": "Du / de la / des / aucun" } },
  { key: "book76", kind: "topic", labels: { "pt-BR": "Nenhum / nada", "en-US": "not + any / no / none", "es-ES": "Ninguno / nada", "fr-FR": "Aucun / rien" } },
  { key: "book77", kind: "topic", labels: { "pt-BR": "Ninguém / nada em negativas", "en-US": "not anybody/anyone/anything · nobody/no-one/nothing", "es-ES": "Nadie / nada en negativas", "fr-FR": "Personne / rien à la négation" } },
  { key: "book78", kind: "topic", labels: { "pt-BR": "Alguém / algo / lugar nenhum", "en-US": "somebody / anything / nowhere", "es-ES": "Alguien / algo / ningún lugar", "fr-FR": "Quelqu’un / quelque chose / nulle part" } },
  { key: "book79", kind: "topic", labels: { "pt-BR": "Todo / todos", "en-US": "every / all", "es-ES": "Cada / todos", "fr-FR": "Chaque / tous" } },
  { key: "book80", kind: "topic", labels: { "pt-BR": "Todos / maioria / alguns / nenhum", "en-US": "all / most / some / any / no / none", "es-ES": "Todos / mayoría / algunos / ninguno", "fr-FR": "Tous / plupart / quelques / aucun" } },
  { key: "book81", kind: "topic", labels: { "pt-BR": "Ambos / um dos dois / nenhum dos dois", "en-US": "both / either / neither", "es-ES": "Ambos / uno de los dos / ninguno", "fr-FR": "Les deux / l’un ou l’autre / aucun" } },
  { key: "book82", kind: "topic", labels: { "pt-BR": "Muito / muitos", "en-US": "a lot / much / many", "es-ES": "Mucho / muchos", "fr-FR": "Beaucoup / nombreux" } },
  { key: "book83", kind: "topic", labels: { "pt-BR": "Um pouco / alguns", "en-US": "a little / a few", "es-ES": "Un poco / unos pocos", "fr-FR": "Un peu / quelques" } },
  { key: "modalMay", labels: { "pt-BR": "Possibilidade com may", "en-US": "I may +verb", "es-ES": "Posibilidad con may", "fr-FR": "Possibilité avec may" } },
  { key: "modalMight", labels: { "pt-BR": "Possibilidade com might", "en-US": "I might +verb", "es-ES": "Posibilidad con might", "fr-FR": "Possibilité avec might" } },
  { key: "modalWill", labels: { "pt-BR": "Futuro com will", "en-US": "I will +verb", "es-ES": "Futuro con will", "fr-FR": "Futur avec will" } },
  { key: "modalShall", labels: { "pt-BR": "Sugestão ou oferta com shall", "en-US": "Shall I/we +verb?", "es-ES": "Sugerencia u oferta con shall", "fr-FR": "Suggestion ou offre avec shall" } },
  { key: "modalWould", labels: { "pt-BR": "Condicional com would", "en-US": "I would +verb", "es-ES": "Condicional con would", "fr-FR": "Conditionnel avec would" } },
  { key: "modalOughtTo", labels: { "pt-BR": "Conselho com ought to", "en-US": "I ought to +verb", "es-ES": "Consejo con ought to", "fr-FR": "Conseil avec ought to" } },
  { key: "modalMustNot", labels: { "pt-BR": "Proibição com must not", "en-US": "I must not +verb", "es-ES": "Prohibición con must not", "fr-FR": "Interdiction avec must not" } },
  { key: "modalNeedNot", labels: { "pt-BR": "Ausência de necessidade com need not", "en-US": "I need not +verb", "es-ES": "Ausencia de necesidad con need not", "fr-FR": "Absence de nécessité avec need not" } },
  { key: "modalHaveTo", labels: { "pt-BR": "Obrigação com have to", "en-US": "I have to +verb", "es-ES": "Obligación con have to", "fr-FR": "Obligation avec have to" } },
];

export type SpeakingGameForm = string;

export function getSpeakingGameForms(language: StudentLanguage): SpeakingFormDefinition[] {
  return SPEAKING_GAME_FORMS.map(form => ({ key: form.key, label: form.labels[language], kind: form.kind ?? "verb" }));
}

export type SpeakingSubjectId = "first" | "second" | "thirdMale" | "thirdFemale" | "neutral" | "plural";
export interface SpeakingSubject { id: SpeakingSubjectId; label: string; }

const subjects: Record<StudentLanguage, SpeakingSubject[]> = {
  "en-US": [
    { id: "first", label: "I" }, { id: "second", label: "You" },
    { id: "thirdMale", label: "He" }, { id: "thirdFemale", label: "She" },
    { id: "neutral", label: "It" }, { id: "plural", label: "They" },
  ],
  "pt-BR": [
    { id: "first", label: "Eu" }, { id: "second", label: "Você" },
    { id: "thirdMale", label: "Ele" }, { id: "thirdFemale", label: "Ela" },
    { id: "plural", label: "Eles/Elas" },
  ],
  "es-ES": [
    { id: "first", label: "Yo" }, { id: "second", label: "Tú" },
    { id: "thirdMale", label: "Él" }, { id: "thirdFemale", label: "Ella" },
    { id: "plural", label: "Ellos/Ellas" },
  ],
  "fr-FR": [
    { id: "first", label: "Je" }, { id: "second", label: "Tu" },
    { id: "thirdMale", label: "Il" }, { id: "thirdFemale", label: "Elle" },
    { id: "plural", label: "Ils/Elles" },
  ],
};

// "It" só aparece para verbos com usos naturais envolvendo coisas/eventos.
const neutralVerbs = new Set([
  "be", "have", "work", "happen", "rain", "snow", "break", "stop", "start", "change",
  "move", "fall", "grow", "exist", "seem", "appear", "look", "sound", "feel",
  "smell", "taste", "cost", "take", "matter", "last", "fit", "run", "open",
  "close", "begin", "end", "fail", "improve", "increase", "decrease", "need",
]);

export function getSpeakingSubjects(language: StudentLanguage, verb: SpeakingVerb): SpeakingSubject[] {
  if ("impersonal" in verb && verb.impersonal) {
    // Os catálogos de verbos impessoais já fornecem uma forma pronta em trainingForms.
    return [subjects[language][0]];
  }
  return subjects[language].filter(subject =>
    subject.id !== "neutral" || (language === "en-US" && neutralVerbs.has(verb.base.toLowerCase()))
  );
}

export function drawSpeakingSubject(language: StudentLanguage, verb: SpeakingVerb, previous?: SpeakingSubjectId): SpeakingSubject {
  const available = getSpeakingSubjects(language, verb);
  const alternatives = available.filter(subject => subject.id !== previous);
  const pool = alternatives.length ? alternatives : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

const englishStative = new Set(["be", "have", "know", "want", "need", "mean", "like", "believe", "love", "hate", "hope", "wish"]);
export function supportsSpeakingForm(verb: SpeakingVerb, form: SpeakingFormDefinition): boolean {
  if (form.kind === "topic") return true;
  if (form.key.startsWith("modal")) return true;
  if ("trainingForms" in verb) return Boolean(verb.trainingForms[form.key]);
  return !(englishStative.has(verb.base) && ["ongoing", "pastOngoing", "duration", "prior"].includes(form.key));
}

function englishChallenge(key: string, subject: SpeakingSubject): string {
  const s = subject.label;
  const singular = ["thirdMale", "thirdFemale", "neutral"].includes(subject.id);
  const be = subject.id === "first" ? "am" : singular ? "is" : "are";
  const was = subject.id === "first" || singular ? "was" : "were";
  const have = singular ? "has" : "have";
  switch (key) {
    case "present": return `${s} ${singular ? "+verb (3rd person)" : "+verb"}`;
    case "ongoing": return `${s} ${be} +verb-ing`;
    case "past": return `${s} +verb-past`;
    case "pastOngoing": return `${s} ${was} +verb-ing`;
    case "duration": return `${s} ${have} been +verb-ing`;
    case "future": return `${s} ${be} going to +verb`;
    case "habit": return `${s} used to +verb`;
    case "recent": return `${s} ${have} just +verb-participle`;
    case "regret": return `${s} should have +verb-participle`;
    case "possibility": return `${s} could have +verb-participle`;
    case "prior": return `${s} had been +verb-ing`;
    case "intended": return `${s} ${was} going to +verb`;
    case "perfect": return `${s} ${have} +verb-participle`;
    case "ability": return `${s} can +verb`;
    case "hypothetical": return `${s} could +verb`;
    case "obligation": return `${s} must +verb`;
    case "advice": return `${s} should +verb`;
    case "modalMay": return `${s} may +verb`;
    case "modalMight": return `${s} might +verb`;
    case "modalWill": return `${s} will +verb`;
    case "modalShall": return subject.id === "first" ? "Shall I +verb?" : subject.id === "plural" ? "Shall they +verb?" : `Shall ${s.toLowerCase()} +verb?`;
    case "modalWould": return `${s} would +verb`;
    case "modalOughtTo": return `${s} ought to +verb`;
    case "modalMustNot": return `${s} must not +verb`;
    case "modalNeedNot": return `${s} need not +verb`;
    case "modalHaveTo": return `${s} ${singular ? "has" : "have"} to +verb`;
    default: return `${s} +verb`;
  }
}

/**
 * Os trainingForms de es-ES/fr-FR são frases prontas na primeira pessoa.
 * Para outros sujeitos, mostra uma instrução (sujeito + intenção + infinitivo),
 * nunca uma conjugação fabricada. A resposta é produzida pelo estudante.
 */
export function getSpeakingChallenge(
  verb: SpeakingVerb,
  form: SpeakingFormDefinition,
  language: StudentLanguage,
  subject: SpeakingSubject,
): string {
  if (form.kind === "topic") return form.label;
  if (language === "en-US" && !("trainingForms" in verb)) return englishChallenge(form.key, subject);
  if ("trainingForms" in verb && (subject.id === "first" || ("impersonal" in verb && verb.impersonal))) {
    const verified = verb.trainingForms[form.key];
    if (verified) return verified;
  }
  return `${subject.label} · ${form.label} · ${verb.base}`;
}
