from pathlib import Path
import json
root=Path.cwd()
p=root/'src/features/study/StudyDataTransfer.tsx'
q=root/'src/components/AppSettingsPage.tsx'
loc={
 'pt-BR': ['Antes de importar e consolidar','Esta operação adiciona sessões e ajustes novos sem apagar os registros existentes. Sessões duplicadas não serão incluídas. Conflitos impedem a conclusão até serem resolvidos. Você poderá revisar diferenças entre as metas.','A consolidação altera os dados de estudo deste navegador. Confira o arquivo e recomendamos exportar os dados atuais antes de prosseguir.','Continuar para selecionar arquivo','Escolher arquivo JSON','Voltar aos dados','Selecione um arquivo de backup JSON (até 5 MB). Depois revise a prévia e confirme.'],
 'en-US': ['Before importing and consolidating','This operation adds new sessions and adjustments without deleting existing study records. Duplicate sessions will not be added. Conflicts block completion until resolved. Goal differences can be reviewed.','Consolidation changes the study data in this browser. Check the backup file and consider exporting your current data first.','Continue to file selection','Choose JSON file','Back to data','Select a JSON backup (up to 5 MB). Review the preview and confirm.'],
 'es-ES': ['Antes de importar y consolidar','Esta operación añade sesiones y ajustes nuevos sin borrar los registros existentes. No añade sesiones duplicadas. Los conflictos bloquean la operación hasta resolverse. Puedes revisar diferencias de metas.','La consolidación modifica los datos de este navegador. Revisa la copia y considera exportar los datos actuales primero.','Continuar para seleccionar archivo','Seleccionar archivo JSON','Volver a Datos','Selecciona una copia JSON (hasta 5 MB). Revisa la vista previa y confirma.'],
 'fr-FR': ['Avant d’importer et de consolider','Cette opération ajoute les nouvelles sessions et corrections sans supprimer les données existantes. Les doublons ne sont pas ajoutés. Les conflits bloquent la validation et les différences d’objectifs peuvent être examinées.','La consolidation modifie les données stockées dans ce navigateur. Vérifiez la sauvegarde et pensez à exporter les données actuelles.','Continuer vers le fichier','Choisir un fichier JSON','Retour aux données','Sélectionnez une sauvegarde JSON (5 Mo maximum), puis vérifiez l’aperçu et confirmez.']
}

def replace(s,a,b,label):
 count=s.count(a)
 if count!=1: raise ValueError(f'{label}: trecho encontrado {count} vezes; nenhum arquivo foi alterado.')
 return s.replace(a,b,1)

paths=[p,q]+[root/f'src/i18n/locales/{lang}.json' for lang in loc]
for path in paths:
 if not path.is_file(): raise FileNotFoundError(path)
changed={}
s=p.read_text(encoding='utf-8')
s=replace(s,'export function StudyDataTransfer({ settings = false, mode = "consolidate", disabled = false, onBusyChange }: {\n  settings?: boolean; mode?: "consolidate" | "restore"; disabled?: boolean; onBusyChange?: (busy: boolean) => void;\n}) {','export function StudyDataTransfer({ settings = false, mode = "consolidate", disabled = false, onBusyChange, standalone = false, onOpenConsolidation, onBack }: {\n  settings?: boolean; mode?: "consolidate" | "restore"; disabled?: boolean; onBusyChange?: (busy: boolean) => void;\n  standalone?: boolean; onOpenConsolidation?: () => void; onBack?: () => void;\n}) {','props')
s=replace(s,'  const replacing = mode === "restore";','  const replacing = mode === "restore";\n  const [consolidationStep, setConsolidationStep] = useState<"intro" | "file">("intro");','state')
s=replace(s,'  return <div className="study-transfer">\n    <h3>{t(settings ? "studyTransfer.title" : "study.myData")}</h3>\n    {settings && <p>{t("studyTransfer.description")}</p>}\n    <p>{t(replacing ? "studyRestore.note" : "study.backupNote")}</p>', '''  return <div className="study-transfer">
    <h3>{t(standalone ? "studyTransfer.import" : settings ? "studyTransfer.title" : "study.myData")}</h3>
    {standalone && <div className="study-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onBack}>{t("studyTransfer.back")}</button></div>}
    {standalone && consolidationStep === "intro" && <section className="study-preview" aria-labelledby="study-consolidation-intro">
      <h4 id="study-consolidation-intro">{t("studyTransfer.introTitle")}</h4>
      <p>{t("studyTransfer.introText")}</p>
      <p role="note">{t("studyTransfer.introWarning")}</p>
      <button type="button" className="primary-button" disabled={blocked || !!store?.extraActivity} onClick={() => setConsolidationStep("file")}>{t("studyTransfer.continue")}</button>
    </section>}
    {standalone && consolidationStep === "file" && <p>{t("studyTransfer.fileHelp")}</p>}
    {settings && <p>{t("studyTransfer.description")}</p>}
    {!standalone && <p>{t(replacing ? "studyRestore.note" : "study.backupNote")}</p>''','header')
s=replace(s,'''    <div className="study-actions">
      <button type="button" className="primary-button" disabled={blocked} onClick={() => void action(exportBackup)}>
        {settings && icon(false)}{t(settings ? "studyTransfer.export" : "study.export")}
      </button>
      <button type="button" className="secondary-button" disabled={blocked || !!store?.extraActivity} onClick={() => fileInput.current?.click()}>
        {settings && icon(true)}{t(settings ? "studyTransfer.import" : "study.restore")}
      </button>
      <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label={t(settings ? "studyTransfer.import" : "study.restore")}
        onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>''','''    {(!standalone || consolidationStep === "file") && <div className="study-actions">
      {!standalone && <button type="button" className="primary-button" disabled={blocked} onClick={() => void action(exportBackup)}>
        {settings && icon(false)}{t(settings ? "studyTransfer.export" : "study.export")}
      </button>}
      {settings && onOpenConsolidation ? <button type="button" className="secondary-button" disabled={blocked || !!store?.extraActivity} onClick={onOpenConsolidation}>
        {icon(true)}{t("studyTransfer.import")}
      </button> : <button type="button" className="secondary-button" disabled={blocked || !!store?.extraActivity} onClick={() => fileInput.current?.click()}>
        {settings && icon(true)}{t(standalone ? "studyTransfer.chooseFile" : settings ? "studyTransfer.import" : "study.restore")}
      </button>}
      <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label={t(standalone ? "studyTransfer.chooseFile" : settings ? "studyTransfer.import" : "study.restore")}
        onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ""; }} />
    </div>}''','buttons')
s=replace(s,'    {preview && pending && <section className="study-preview" aria-label={t("study.preview")}>','    {(!standalone || consolidationStep === "file") && preview && pending && <section className="study-preview" aria-label={t("study.preview")}>','preview')
s=replace(s,'<div className="study-actions"><button type="button" className="primary-button" disabled={blocked || !confirmed || stale || !!preview.conflicts.length}','<div className="study-actions"><button type="button" className="study-danger-button" disabled={blocked || !confirmed || stale || !!preview.conflicts.length}','confirm')
changed[p]=s
s=q.read_text(encoding='utf-8')
s=replace(s,'  const [category, setCategory] = useState<typeof categories[number]>("audio");','  const [category, setCategory] = useState<typeof categories[number]>("audio");\n  const [consolidationVisible, setConsolidationVisible] = useState(false);','settings state')
s=replace(s,'    <nav className="settings-categories" aria-label={t("settingsPage.categories")}>','    {!consolidationVisible && <nav className="settings-categories" aria-label={t("settingsPage.categories")}>','nav start')
s=replace(s,'    </nav>\n    <section id="settings-category-content"','    </nav>}\n    <section id="settings-category-content"','nav end')
s=replace(s,'      <h3 id="settings-category-title">{t(`settingsPage.${category}`)}</h3>','      {!consolidationVisible && <h3 id="settings-category-title">{t(`settingsPage.${category}`)}</h3>}\n      {consolidationVisible && <StudyDataTransfer standalone onBack={() => setConsolidationVisible(false)} />}','separate screen')
for name in ['audio','languages','study','appearance','data']:
 s=replace(s,f'{{category === "{name}" && ',f'{{!consolidationVisible && category === "{name}" && ',name)
s=replace(s,'        <StudyDataTransfer settings />','        <StudyDataTransfer settings onOpenConsolidation={() => setConsolidationVisible(true)} />','launch')
changed[q]=s
for lang,values in loc.items():
 path=root/f'src/i18n/locales/{lang}.json'
 s=path.read_text(encoding='utf-8')
 obj=json.loads(s)
 imp=obj['studyTransfer']['import']
 token='    "import": '+json.dumps(imp,ensure_ascii=False)+','
 keys=['introTitle','introText','introWarning','continue','chooseFile','back','fileHelp']
 addition=token+'\n'+',\n'.join('    '+json.dumps(k)+': '+json.dumps(v,ensure_ascii=False) for k,v in zip(keys,values))+','
 s=replace(s,token,addition,lang)
 json.loads(s)
 changed[path]=s
for path,s in changed.items(): path.write_text(s,encoding='utf-8')
print('Arquivos modificados:')
for path in changed: print('-',path.relative_to(root))
print('Valide com: npm run build')
