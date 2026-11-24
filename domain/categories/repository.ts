/**
 * [SMG][DOMAIN][CATEGORIES] repository
 *
 * RESPONSABILIDADE: Acesso a dados da tabela `categories` (Issue #382 / FIN-005).
 * Substitui persistência em localStorage por Supabase com isolamento explícito
 * por `tenant_id`.
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import { RepositoryError } from '../shared/errors';

export { RepositoryError } from '../shared/errors';

export interface CategoryRecord {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateCategoryInput {
  name: string;
  description: string;
}

export interface UpdateCategoryInput {
  name: string;
  description: string;
}

export interface CategoriesRepository {
  listByTenant(tenantId: string): Promise<CategoryRecord[]>;
  create(tenantId: string, input: CreateCategoryInput): Promise<CategoryRecord>;
  update(tenantId: string, id: string, input: UpdateCategoryInput): Promise<CategoryRecord>;
  toggleActive(tenantId: string, id: string, nextActive: boolean): Promise<CategoryRecord>;
  remove(tenantId: string, id: string): Promise<void>;
}

export class CategoriesRepositoryImpl extends SupabaseRepository implements CategoriesRepository {
  constructor(db: DatabaseClient = createSupabaseClient('categories', 'barber')) {
    super('categories', db);
  }

  async listByTenant(tenantId: string): Promise<CategoryRecord[]> {
    const { data, error } = await this.db
      .from('categories')
      .select('id, tenant_id, name, description, active, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new RepositoryError(`Erro ao listar categorias: ${error.message}`, 'categories', error);
    }

    return ((data as CategoryRecord[] | null) ?? []).map((row) => ({
      ...row,
      description: row.description ?? '',
    }));
  }

  async create(tenantId: string, input: CreateCategoryInput): Promise<CategoryRecord> {
    const { data, error } = await this.db
      .from('categories')
      .insert({
        tenant_id: tenantId,
        name: input.name.trim(),
        description: input.description.trim(),
        active: true,
      })
      .select('id, tenant_id, name, description, active, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new RepositoryError(
        `Erro ao criar categoria: ${error?.message ?? 'registro não retornado'}`,
        'categories',
        error
      );
    }

    return data as CategoryRecord;
  }

  async update(tenantId: string, id: string, input: UpdateCategoryInput): Promise<CategoryRecord> {
    const { data, error } = await this.db
      .from('categories')
      .update({
        name: input.name.trim(),
        description: input.description.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, tenant_id, name, description, active, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new RepositoryError(
        `Erro ao atualizar categoria: ${error?.message ?? 'registro não encontrado'}`,
        'categories',
        error
      );
    }

    return data as CategoryRecord;
  }

  async toggleActive(tenantId: string, id: string, nextActive: boolean): Promise<CategoryRecord> {
    const { data, error } = await this.db
      .from('categories')
      .update({
        active: nextActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, tenant_id, name, description, active, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new RepositoryError(
        `Erro ao atualizar status da categoria: ${error?.message ?? 'registro não encontrado'}`,
        'categories',
        error
      );
    }

    return data as CategoryRecord;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const { error } = await this.db
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new RepositoryError(`Erro ao remover categoria: ${error.message}`, 'categories', error);
    }
  }
}

export const categoriesRepository = new CategoriesRepositoryImpl();
