import { supabase } from '../../services/supabaseClient';
import type {
  InternalNotification,
  InternalNotificationStatus,
  NotificationPreference,
} from '../types/notifications';

export const notificationsService = {
  async list(status: InternalNotificationStatus | null = null, limit = 50) {
    const { data, error } = await supabase.rpc('list_internal_notifications', {
      p_status: status,
      p_limit: limit,
      p_offset: 0,
    });

    if (error) throw error;
    return (data || []) as InternalNotification[];
  },

  async countUnread() {
    const { data, error } = await supabase.rpc('count_unread_notifications');
    if (error) throw error;
    return Number(data || 0);
  },

  async markAsRead(id: string) {
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: id,
    });
    if (error) throw error;
  },

  async markAllAsRead() {
    const { data, error } = await supabase.rpc('mark_all_notifications_read');
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

