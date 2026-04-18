-- Helper function to safely create trigger
CREATE OR REPLACE FUNCTION create_audit_trigger_if_not_exists(t_name text) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger_row_' || t_name) THEN
        EXECUTE 'CREATE TRIGGER audit_trigger_row_' || t_name ||
                ' AFTER INSERT OR UPDATE OR DELETE ON public.' || quote_ident(t_name) ||
                ' FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
SELECT create_audit_trigger_if_not_exists('clients');
SELECT create_audit_trigger_if_not_exists('appointments');
SELECT create_audit_trigger_if_not_exists('products');
SELECT create_audit_trigger_if_not_exists('services');
SELECT create_audit_trigger_if_not_exists('comandas');

-- Clean up helper
DROP FUNCTION create_audit_trigger_if_not_exists(text);;
