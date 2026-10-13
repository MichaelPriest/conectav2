'use client';

import { useEffect, useState } from 'react';
import { Archive, FileText, RotateCcw, Trash2 } from 'lucide-react';

export type PostDraftRecord = {
  id: string;
  text: string;
  privacy: 'public' | 'friends' | 'private';
  pollMode: boolean;
  pollOptions: string[];
  pollDays: number;
  updatedAt: string;
};

type DraftInput = Omit<PostDraftRecord, 'id' | 'updatedAt'>;

const STORAGE_PREFIX = 'conecta:post-drafts:v1:';
const MAX_DRAFTS = 20;

function readDrafts(userId: string): PostDraftRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PostDraftRecord =>
      item && typeof item.id === 'string' && typeof item.text === 'string' &&
      ['public', 'friends', 'private'].includes(item.privacy) &&
      typeof item.pollMode === 'boolean' && Array.isArray(item.pollOptions) &&
      item.pollOptions.every((option: unknown) => typeof option === 'string') &&
      [1, 3, 7, 14].includes(item.pollDays) && typeof item.updatedAt === 'string'
    ).slice(0, MAX_DRAFTS);
  } catch {
    return [];
  }
}

function writeDrafts(userId: string, drafts: PostDraftRecord[]) {
  window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(drafts.slice(0, MAX_DRAFTS)));
}

export function PostDrafts({
  userId, current, onRestore,
}: {
  userId: string;
  current: DraftInput;
  onRestore: (draft: DraftInput) => void;
}) {
  const [drafts, setDrafts] = useState<PostDraftRecord[]>([]);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDrafts(readDrafts(userId));
  }, [userId]);

  function saveDraft() {
    if (!current.text.trim()) {
      setMessage('Escreva o texto da publicação ou da enquete antes de salvar.');
      return;
    }
    const next: PostDraftRecord = {
      ...current,
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      updatedAt: new Date().toISOString(),
    };
    try {
      const updated = [next, ...readDrafts(userId)].slice(0, MAX_DRAFTS);
      writeDrafts(userId, updated);
      setDrafts(updated);
      setExpanded(true);
      setMessage('Rascunho salvo neste dispositivo. Anexos não são incluídos.');
    } catch {
      setMessage('Não foi possível salvar o rascunho neste dispositivo. Verifique o espaço disponível no navegador.');
    }
  }

  function removeDraft(id: string) {
    const updated = drafts.filter(draft => draft.id !== id);
    try {
      writeDrafts(userId, updated);
      setDrafts(updated);
      setMessage('Rascunho excluído.');
    } catch {
      setMessage('Não foi possível atualizar os rascunhos neste dispositivo.');
    }
  }

  function restoreDraft(draft: PostDraftRecord) {
    onRestore({
      text: draft.text,
      privacy: draft.privacy,
      pollMode: draft.pollMode,
      pollOptions: [...draft.pollOptions],
      pollDays: draft.pollDays,
    });
    setMessage('Rascunho carregado. Confira o conteúdo e a privacidade antes de publicar.');
  }

  return <section className="conecta-post-drafts" aria-label="Rascunhos de publicação">
    <div className="conecta-post-drafts-actions">
      <button type="button" className="btn btn-outline" onClick={saveDraft}><Archive size={16}/> Salvar rascunho</button>
      <button type="button" className="btn btn-outline" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <FileText size={16}/> Rascunhos ({drafts.length})
      </button>
    </div>
    <p className="small-note">Rascunhos ficam somente neste navegador e neste dispositivo. Fotos e vídeos anexados não são salvos.</p>
    {message && <p className="small-note" role="status">{message}</p>}
    {expanded && <div className="conecta-post-drafts-list">
      {drafts.length === 0 && <p className="small-note">Você ainda não tem rascunhos salvos neste dispositivo.</p>}
      {drafts.map(draft => <article className="conecta-post-draft-item" key={draft.id}>
        <div className="conecta-post-draft-copy">
          <strong>{draft.pollMode ? 'Enquete' : 'Publicação'} · {draft.privacy === 'public' ? 'Público' : draft.privacy === 'friends' ? 'Amigos' : 'Só eu'}</strong>
          <p>{draft.text}</p>
          <time dateTime={draft.updatedAt}>{new Date(draft.updatedAt).toLocaleString('pt-BR')}</time>
        </div>
        <div className="conecta-post-draft-buttons">
          <button type="button" className="btn btn-outline" onClick={() => restoreDraft(draft)}><RotateCcw size={15}/> Abrir</button>
          <button type="button" className="btn btn-outline" aria-label="Excluir rascunho" onClick={() => removeDraft(draft.id)}><Trash2 size={15}/></button>
        </div>
      </article>)}
    </div>}
  </section>;
}
