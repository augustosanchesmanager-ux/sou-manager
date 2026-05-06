import { useState, useCallback } from 'react';
import type { ImportExportTemplate, EntityType } from '../types';
import * as api from '../services/importExportApi';

export function useTemplates() {
  const [templates, setTemplates] = useState<ImportExportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async (entity?: EntityType, appSlug?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTemplates(entity, appSlug);
      setTemplates(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (
    template: Omit<ImportExportTemplate, 'id' | 'created_at' | 'updated_at'>,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.createTemplate(template);
      setTemplates(prev => [...prev, created]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, updates: Partial<ImportExportTemplate>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.updateTemplate(id, updates);
      setTemplates(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDefaultTemplate = useCallback((
    entity: EntityType,
    direction: 'import' | 'export' = 'import',
  ) => {
    return templates.find(
      t => t.entity === entity &&
           (t.direction === direction || t.direction === 'both') &&
           t.is_default &&
           t.is_active,
    ) ?? null;
  }, [templates]);

  const getActiveTemplatesByEntity = useCallback((entity: EntityType) => {
    return templates.filter(
      t => t.entity === entity && t.is_active,
    );
  }, [templates]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getDefaultTemplate,
    getActiveTemplatesByEntity,
  };
}