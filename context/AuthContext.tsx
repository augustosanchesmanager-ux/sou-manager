import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    tenantId: string | null;
    isSuperAdmin: boolean;
    profileStatus: 'pending' | 'active' | 'suspended' | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [profileStatus, setProfileStatus] = useState<'pending' | 'active' | 'suspended' | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTenantId = async (userId: string, userMeta?: any) => {
        try {
            const role = userMeta?.role || '';

            // Super Admins don't have a tenant — skip DB lookup
            if (role === 'Super Admin' || role === 'superadmin') {
                setTenantId(null);
                setProfileStatus('active'); // Super Admin is always active
                return;
            }

            // First check profiles (for admins/owners) — also get status
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('tenant_id, status')
                .eq('id', userId)
                .single();

            if (profileData && !profileError) {
                setTenantId(profileData.tenant_id);
                setProfileStatus((profileData.status as any) || 'pending');
                return;
            }

            // Then check staff (for barbers/receptionists)
            const { data: staffData, error: staffError } = await supabase
                .from('staff')
                .select('tenant_id')
                .eq('id', userId)
                .single();

            if (staffData && !staffError) {
                setTenantId(staffData.tenant_id);
                setProfileStatus('active'); // Staff members approved through team creation
            }
        } catch (err) {
            console.error('Error fetching tenant_id:', err);
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchTenantId(session.user.id, session.user.user_metadata).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                setLoading(true);
                fetchTenantId(session.user.id, session.user.user_metadata).finally(() => setLoading(false));
            } else {
                setTenantId(null);
                setProfileStatus(null);
                setLoading(false);
            }
        });

        return () => { subscription.unsubscribe(); };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const isSuperAdmin =
        user?.user_metadata?.role === 'Super Admin' ||
        user?.user_metadata?.role === 'superadmin';

    return (
        <AuthContext.Provider value={{ session, user, tenantId, isSuperAdmin, profileStatus, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
