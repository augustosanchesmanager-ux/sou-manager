import { supabase } from '../../services/supabaseClient';
import type {
  InternalNotification,
  InternalNotificationStatus,
  NotificationPreference,
} from '../types/notifications';

export const notificationsService = {
  async list(status: InternalNotificationStatus | null = null, limit = 50) {
    const [{ data, error }, alertsResult] = await Promise.all([
      supabase.rpc('list_internal_notifications', {
        p_status: status,
        p_limit: limit,
        p_offset: 0,
      }),
      supabase
        .from('tenant_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (error) throw error;
    const baseItems = (data || []) as InternalNotification[];

    const mappedAlerts: InternalNotification[] = ((alertsResult.data || []) as Array<Record<string, unknown>>)
      .filter((row) => {
        if (status === 'unread') return !row.is_read;
        if (status === 'read') return Boolean(row.is_read);
        return true;
      })
      .map((row) => ({
        id: `alert:${String(row.id)}`,
        tenant_id: String(row.tenant_id ?? ''),
        user_id: null,
        type: 'alerta_avaliacao',
        title: String(row.title ?? 'Alerta de Avaliação'),
        message: String(row.message ?? ''),
        entity_type: typeof row.reference_table === 'string' ? row.reference_table : 'tenant_reviews',
        entity_id: typeof row.reference_id === 'string' ? row.reference_id : null,
        severity:
          row.severity === 'critical' || row.severity === 'info' ? row.severity : 'warning',
        status: row.is_read ? 'read' : 'unread',
        read_at: typeof row.read_at === 'string' ? row.read_at : null,
        metadata:
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {},
        created_at: String(row.created_at ?? new Date().toISOString()),
      }));

    return [...mappedAlerts, ...baseItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },

  async countUnread() {
    const [{ data, error }, alertsCountResult] = await Promise.all([
      supabase.rpc('count_unread_notifications'),
      supabase
        .from('tenant_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false),
    ]);
    if (error) throw error;
    const alertsUnread = Number(alertsCountResult.count || 0);
    return Number(data || 0) + alertsUnread;
  },

  async markAsRead(id: string) {
    if (id.startsWith('alert:')) {
      const rawId = id.slice('alert:'.length);
      await supabase
        .from('tenant_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', rawId);
      return;
    }
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: id,
    });
    if (error) throw error;
  },

  async markAllAsRead() {
    const [{ data, error }] = await Promise.all([
      supabase.rpc('mark_all_notifications_read'),
      supabase
        .from('tenant_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false),
    ]);
    if (error) throw error;
    return Number(data || 0);
  },

  async archive(id: string) {
    const { error } = await supabase.rpc('archive_notification', {
      p_notification_id: id,
    });
    if (error) throw error;
  },

  async sweep(tenantId: string) {
    const { data, error } = await supabase.rpc('generate_system_notifications', {
      p_tenant_id: tenantId,
      p_upcoming_minutes: 60,
      p_billing_days: 3,
    });
    if (error) throw error;
    return data;
  },

  async getPreferences() {
    const { data, error } = await supabase.rpc('get_notification_preferences');
    if (error) throw error;
    return (data || []) as NotificationPreference[];
  },

  async setPreferences(preferences: Array<Pick<NotificationPreference, 'type' | 'enabled'>>) {
    const { data, error } = await supabase.rpc('set_notification_preferences', {
      p_preferences: preferences,
    });
    if (error) throw error;
    return (data || []) as NotificationPreference[];
  },
};
