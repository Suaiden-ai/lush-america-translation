/*
  # Create Action Logs System for Audit Trail

  1. Table: action_logs
    - Stores all user actions for audit and tracking
    - Cached fields for performance (avoid JOINs)
    - Imutable (no updates/deletes)
    - RLS enabled with strict policies

  2. Function: log_action
    - RPC function to safely log actions
    - Automatically captures authenticated user
    - Caches performer name/email
    - Returns log ID
*/

-- Create action_logs table
CREATE TABLE IF NOT EXISTS public.action_logs (
    -- Primary identification
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Who performed the action (with cached name/email for performance)
    performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    performed_by_type TEXT NOT NULL CHECK (performed_by_type IN ('user', 'admin', 'authenticator', 'finance', 'affiliate', 'system')),
    performed_by_name TEXT,
    performed_by_email TEXT,
    
    -- What action was performed
    action_type TEXT NOT NULL,
    action_description TEXT NOT NULL,
    
    -- What entity was affected
    entity_type TEXT,
    entity_id UUID,
    
    -- Flexible metadata (JSONB for extensibility)
    metadata JSONB,
    
    -- Affected user (if different from performer)
    affected_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_action_logs_performed_by ON public.action_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON public.action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_action_type ON public.action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_entity ON public.action_logs(entity_type, entity_id) WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_logs_affected_user ON public.action_logs(affected_user_id) WHERE affected_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_logs_performed_by_type ON public.action_logs(performed_by_type);

-- Enable RLS
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Users can view their own logs
CREATE POLICY "Users view their own logs"
ON public.action_logs
FOR SELECT
USING (
    affected_user_id = auth.uid() OR performed_by = auth.uid()
);

-- RLS Policy 2: Admins and Finance can view all logs
CREATE POLICY "Admins and Finance view all logs"
ON public.action_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'finance')
    )
);

-- RLS Policy 3: Anyone authenticated can insert logs (system integrity)
CREATE POLICY "Authenticated users can insert logs"
ON public.action_logs
FOR INSERT
WITH CHECK (performed_by = auth.uid());

-- RLS Policy 4: Nobody can update logs (immutability)
CREATE POLICY "Nobody can update logs"
ON public.action_logs
FOR UPDATE
USING (false);

-- RLS Policy 5: Nobody can delete logs (audit trail protection)
CREATE POLICY "Nobody can delete logs"
ON public.action_logs
FOR DELETE
USING (false);

-- Function to log actions (SECURITY DEFINER for proper permissions)
CREATE OR REPLACE FUNCTION public.log_action(
    p_action_type TEXT,
    p_action_description TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_affected_user_id UUID DEFAULT NULL,
    p_performed_by_type TEXT DEFAULT 'user'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
    v_current_user_id UUID;
    v_performer_name TEXT;
    v_performer_email TEXT;
BEGIN
    -- Get current authenticated user ID
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to log actions';
    END IF;
    
    -- Validate performed_by_type
    IF p_performed_by_type NOT IN ('user', 'admin', 'authenticator', 'finance', 'affiliate', 'system') THEN
        RAISE EXCEPTION 'Invalid performed_by_type: %', p_performed_by_type;
    END IF;
    
    -- Cache performer info (avoid JOINs on reads)
    SELECT 
        COALESCE(name, 'Unknown'),
        COALESCE(email, '')
    INTO 
        v_performer_name,
        v_performer_email
    FROM public.profiles 
    WHERE id = v_current_user_id;
    
    -- If profile not found, try to get from auth.users metadata
    IF v_performer_name IS NULL OR v_performer_name = 'Unknown' THEN
        SELECT 
            COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', 'Unknown'),
            COALESCE(email, '')
        INTO 
            v_performer_name,
            v_performer_email
        FROM auth.users 
        WHERE id = v_current_user_id;
    END IF;
    
    -- Final fallback
    v_performer_name := COALESCE(v_performer_name, 'Unknown User');
    v_performer_email := COALESCE(v_performer_email, 'unknown@example.com');
    
    -- Insert the log
    INSERT INTO public.action_logs (
        performed_by,
        performed_by_type,
        performed_by_name,
        performed_by_email,
        action_type,
        action_description,
        entity_type,
        entity_id,
        metadata,
        affected_user_id
    ) VALUES (
        v_current_user_id,
        p_performed_by_type,
        v_performer_name,
        v_performer_email,
        p_action_type,
        p_action_description,
        p_entity_type,
        p_entity_id,
        p_metadata,
        COALESCE(p_affected_user_id, v_current_user_id)
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the main operation
    RAISE WARNING 'Error logging action: %', SQLERRM;
    RETURN NULL;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.log_action TO authenticated;

-- Comment on function for documentation
COMMENT ON FUNCTION public.log_action IS 
'Safely logs an action performed by an authenticated user. Automatically captures user context and caches performer information for performance. Returns the log ID or NULL if logging fails.';

COMMENT ON TABLE public.action_logs IS 
'Audit trail of all user actions in the system. Logs are immutable and cannot be updated or deleted.';

