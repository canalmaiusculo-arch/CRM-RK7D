import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Wifi, WifiOff, Settings as SettingsIcon, CheckCircle, XCircle, Send } from 'lucide-react';

export default function Settings({ isVisitor }) {
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qr: null });
  const [metaForm, setMetaForm] = useState({ pixelId: '', accessToken: '', eventSourceUrl: '', testEventCode: '' });
  const [settings, setSettings] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getWhatsAppStatus().then(setWaStatus).catch(() => {});
    api.getSettings().then(data => {
      setSettings(data);
      setMetaForm({
        pixelId: data.meta_pixel_id || '',
        accessToken: data.meta_access_token || '',
        eventSourceUrl: data.meta_event_source_url || '',
        testEventCode: data.meta_test_event_code || '',
      });
    }).catch(() => {});

    // Poll WA status
    const interval = setInterval(() => {
      api.getWhatsAppStatus().then(setWaStatus).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const connectWA = async () => {
    if (isVisitor) return;
    try { await api.connectWhatsApp(); } catch (err) { console.error(err); }
  };

  const disconnectWA = async () => {
    if (isVisitor) return;
    try { await api.disconnectWhatsApp(); setWaStatus({ status: 'disconnected', qr: null }); } catch (err) { console.error(err); }
  };

  const saveMeta = async () => {
    if (isVisitor) return;
    setSaving(true);
    try {
      await api.updateMetaConfig(metaForm);
      setTestResult(null);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const testMeta = async () => {
    if (isVisitor) return;
    try {
      const result = await api.testMetaEvent();
      setTestResult(result);
    } catch (err) { setTestResult({ success: false, error: err.message }); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold flex items-center gap-2"><SettingsIcon size={20} /> Configurações</h1>
      </header>

      <div className="p-6 max-w-2xl space-y-6">
        {/* WhatsApp Connection */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">WhatsApp</h3>
            <StatusBadge status={waStatus.status} />
          </div>
          <div className="p-4 space-y-4">
            {waStatus.status === 'qr_pending' && waStatus.qr && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-gray-400">Escaneie o QR Code com seu WhatsApp Business:</p>
                <img src={waStatus.qr} alt="QR Code" className="w-64 h-64 rounded-lg" />
              </div>
            )}
            {waStatus.status === 'ready' && (
              <p className="text-sm text-green-400 flex items-center gap-2"><Wifi size={16} /> Conectado e pronto</p>
            )}
            {waStatus.status === 'disconnected' && (
              <p className="text-sm text-gray-500 flex items-center gap-2"><WifiOff size={16} /> Desconectado</p>
            )}
            <div className="flex gap-2">
              {waStatus.status !== 'ready' && (
                <button onClick={connectWA} disabled={isVisitor} className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-30">
                  Conectar
                </button>
              )}
              {waStatus.status === 'ready' && (
                <button onClick={disconnectWA} disabled={isVisitor} className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-30">
                  Desconectar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Meta CAPI */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Meta Conversions API (CAPI)</h3>
            {settings.meta_configured ? (
              <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle size={12} /> Configurado</span>
            ) : (
              <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded flex items-center gap-1"><XCircle size={12} /> Não configurado</span>
            )}
          </div>
          <div className="p-4 space-y-4">
            <p className="text-xs text-gray-500">
              Eventos enviados automaticamente: <strong className="text-gray-300">Lead</strong> (ao qualificar) e <strong className="text-gray-300">Purchase</strong> (ao fechar com valor).
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Pixel ID</label>
              <input value={metaForm.pixelId} onChange={e => setMetaForm(p => ({ ...p, pixelId: e.target.value }))} disabled={isVisitor}
                placeholder="123456789012345" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Token CAPI (Access Token)</label>
              <input value={metaForm.accessToken} onChange={e => setMetaForm(p => ({ ...p, accessToken: e.target.value }))} disabled={isVisitor}
                type="password" placeholder="EAAxxxxxxx..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Event Source URL</label>
              <input value={metaForm.eventSourceUrl} onChange={e => setMetaForm(p => ({ ...p, eventSourceUrl: e.target.value }))} disabled={isVisitor}
                placeholder="https://seusite.com" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Test Event Code (opcional)</label>
              <input value={metaForm.testEventCode} onChange={e => setMetaForm(p => ({ ...p, testEventCode: e.target.value }))} disabled={isVisitor}
                placeholder="TEST12345" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveMeta} disabled={isVisitor || saving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-30">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={testMeta} disabled={isVisitor} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-30">
                <Send size={14} /> Enviar Evento Teste
              </button>
            </div>
            {testResult && (
              <div className={`text-xs p-3 rounded-lg ${testResult.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                {testResult.success ? 'Evento de teste enviado com sucesso!' : `Erro: ${JSON.stringify(testResult.error)}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ready: 'bg-green-900/50 text-green-300',
    qr_pending: 'bg-yellow-900/50 text-yellow-300',
    connecting: 'bg-blue-900/50 text-blue-300',
    disconnected: 'bg-gray-800 text-gray-400',
  };
  const labels = { ready: 'Conectado', qr_pending: 'Aguardando QR', connecting: 'Conectando...', disconnected: 'Desconectado' };
  return <span className={`text-xs px-2 py-0.5 rounded ${styles[status] || styles.disconnected}`}>{labels[status] || status}</span>;
}
