'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { cmsAPI } from '@/lib/api';

type CmsEntry = {
  _id: string;
  key: string;
  value: string;
  locale: string;
  page?: string;
  section?: string;
  description?: string;
  version: number;
  updatedAt: string;
};

export default function AdminCmsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState<CmsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [editingEntry, setEditingEntry] = useState<CmsEntry | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newPage, setNewPage] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sécuriser l'accès : uniquement admin / superadmin
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    const role = (session?.user as any)?.role;
    if (role !== 'admin' && role !== 'superadmin') {
      router.push('/client');
      return;
    }
    loadEntries();
  }, [status, session]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        locale: 'fr-FR',
        limit: 200,
      };
      if (search) params.search = search;
      if (pageFilter) params.page = pageFilter;
      if (sectionFilter) params.section = sectionFilter;

      const res = await cmsAPI.listEntries(params);
      setEntries(res.data.entries || []);
    } catch (e: any) {
      console.error('Erreur chargement CMS:', e);
      setError(e?.response?.data?.message || 'Erreur lors du chargement des contenus');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (entry: CmsEntry) => {
    setEditingEntry(entry);
    setEditValue(entry.value);
    setEditDescription(entry.description || '');
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    setEditValue('');
    setEditDescription('');
  };

  const saveEdit = async () => {
    if (!editingEntry) return;
    try {
      setIsSaving(true);
      setError(null);
      await cmsAPI.updateEntry(editingEntry._id, {
        value: editValue,
        description: editDescription,
        page: editingEntry.page,
        section: editingEntry.section,
      });
      await loadEntries();
      cancelEdit();
    } catch (e: any) {
      console.error('Erreur mise à jour CMS:', e);
      setError(e?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const createEntry = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      setError('La clé et la valeur sont obligatoires');
      return;
    }
    try {
      setCreating(true);
      setError(null);
      await cmsAPI.createEntry({
        key: newKey.trim(),
        value: newValue,
        page: newPage || undefined,
        section: newSection || undefined,
        description: newDescription || undefined,
      });
      setNewKey('');
      setNewValue('');
      setNewPage('');
      setNewSection('');
      setNewDescription('');
      await loadEntries();
    } catch (e: any) {
      console.error('Erreur création CMS:', e);
      setError(e?.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const distinctPages = Array.from(
    new Set(entries.map((e) => e.page).filter((p): p is string => !!p))
  ).sort();

  const distinctSections = Array.from(
    new Set(entries.map((e) => e.section).filter((s): s is string => !!s))
  ).sort();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              CMS de contenu
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérez les textes affichés sur le site (par page, section et clé).
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filtres */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Recherche
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Clé, texte, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={loadEntries}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadEntries();
                }
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Page
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={pageFilter}
              onChange={(e) => {
                setPageFilter(e.target.value);
                setTimeout(loadEntries, 0);
              }}
            >
              <option value="">Toutes</option>
              {distinctPages.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Section
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setTimeout(loadEntries, 0);
              }}
            >
              <option value="">Toutes</option>
              {distinctSections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={loadEntries}
              disabled={loading}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Chargement...' : 'Actualiser'}
            </button>
          </div>
        </div>

        {/* Création rapide */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-gray-800">
            Ajouter un nouveau texte
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Utilisez des clés structurées (ex : <code>home.hero.title</code>).
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Clé (ex : home.hero.title)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Page (ex : home)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={newPage}
                onChange={(e) => setNewPage(e.target.value)}
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Section (ex : hero)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-3">
              <textarea
                placeholder="Texte"
                className="h-16 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div>
              <textarea
                placeholder="Description (optionnelle)"
                className="h-16 w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={createEntry}
              disabled={creating}
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {creating ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
        </div>

        {/* Tableau des entrées */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Clé
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Texte
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Page / Section
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Version
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    {loading
                      ? 'Chargement des contenus...'
                      : 'Aucun contenu CMS pour le moment.'}
                  </td>
                </tr>
              )}

              {entries.map((entry) => {
                const isEditing = editingEntry?._id === entry._id;
                return (
                  <tr key={entry._id}>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {entry.key}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {isEditing ? (
                        <textarea
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                          rows={3}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                        />
                      ) : (
                        <div className="line-clamp-3 whitespace-pre-line">
                          {entry.value}
                        </div>
                      )}
                      {isEditing && (
                        <textarea
                          className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                          rows={2}
                          placeholder="Description interne (optionnelle)"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>{entry.page || '-'}</div>
                      <div className="text-[11px] text-gray-400">
                        {entry.section || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      v{entry.version}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {isEditing ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={isSaving}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          Modifier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}



