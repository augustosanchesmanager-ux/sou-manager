-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL, -- using text to handle UUIDs or integer IDs
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    tenant_id UUID -- optional, derived from the row
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Superadmins can view all audit logs
CREATE POLICY "Superadmins can view all audit logs" 
ON public.audit_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles px 
    WHERE px.id = auth.uid() AND px.role IN ('Super Admin', 'superadmin')
  )
);

-- Tenants managers can view audit logs for their own tenant
CREATE POLICY "Managers can view tenant audit logs" 
ON public.audit_logs FOR SELECT 
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);


-- Create the generic trigger function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as the function owner to bypass RLS for inserting logs
SET search_path = public
AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id TEXT;
    v_tenant_id UUID;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Try to extract common ID formats
        BEGIN v_record_id := NEW.id::text; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
        -- Try to extract tenant_id if present
        BEGIN v_tenant_id := NEW.tenant_id; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        
        -- Optimization: Don't log if data didn't actually change
        IF v_old_data = v_new_data THEN
            RETURN NEW;
        END IF;

        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME::text, COALESCE(v_record_id, 'UNKNOWN'), TG_OP, v_old_data, v_new_data, auth.uid(), v_tenant_id);
        
        RETURN NEW;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        BEGIN v_record_id := OLD.id::text; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
        BEGIN v_tenant_id := OLD.tenant_id; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME::text, COALESCE(v_record_id, 'UNKNOWN'), TG_OP, v_old_data, auth.uid(), v_tenant_id);
        
        RETURN OLD;
        
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        BEGIN v_record_id := NEW.id::text; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
        BEGIN v_tenant_id := NEW.tenant_id; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME::text, COALESCE(v_record_id, 'UNKNOWN'), TG_OP, v_new_data, auth.uid(), v_tenant_id);
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;;
