import { useEffect, useState } from 'react';
import { AI_PROVIDER_CHANGED_EVENT, aiAssetPath, getAIProvider, setAIProvider, type AIProvider } from '../config/aiProvider';

export function AIProviderSettings() {
  const [provider, updateProvider] = useState<AIProvider>(getAIProvider);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => updateProvider(getAIProvider());
    window.addEventListener(AI_PROVIDER_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(AI_PROVIDER_CHANGED_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const choose = (value: AIProvider) => {
    try { setAIProvider(value); updateProvider(value); setError(''); }
    catch { setError('Não foi possível salvar a preferência neste navegador.'); }
  };
  return <div className="bej-ai-settings">
    <p>Escolha a inteligência artificial padrão para analisar perguntas e respostas no BEJ.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }} role="radiogroup" aria-label="Inteligência artificial padrão">
      {(['chatgpt', 'gemini'] as const).map(value => <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 10, border: provider === value ? '2px solid currentColor' : '1px solid #888', borderRadius: 10, padding: '12px 16px', cursor: 'pointer' }}>
        <input type="radio" name="bej-ai-provider" value={value} checked={provider === value} onChange={() => choose(value)} />
        <img src={aiAssetPath(value)} width="28" height="28" alt="" />
        <strong>{value === 'chatgpt' ? 'ChatGPT' : 'Gemini'}</strong>
      </label>)}
    </div>
    <p className="settings-dialog-help">A escolha vale para todos os módulos neste navegador. Nenhuma chave de API é necessária. A análise abre no site da IA selecionada.</p>
    {error && <p role="alert" className="warning-banner">{error}</p>}
  </div>;
}
