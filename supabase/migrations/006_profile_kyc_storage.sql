-- Private KYC document storage and transactional profile/KYC operations.
-- Apply after migrations 001-005.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('client-kyc-documents', 'client-kyc-documents', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('companion-kyc-documents', 'companion-kyc-documents', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Backend service role manages private KYC documents" ON storage.objects;
CREATE POLICY "Backend service role manages private KYC documents"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id IN ('client-kyc-documents', 'companion-kyc-documents'))
    WITH CHECK (bucket_id IN ('client-kyc-documents', 'companion-kyc-documents'));

CREATE OR REPLACE FUNCTION public.submit_profile_kyc(
    p_user_id UUID,
    p_submission_id UUID,
    p_role VARCHAR,
    p_legal_name VARCHAR,
    p_dob DATE,
    p_id_type VARCHAR,
    p_id_front_path TEXT,
    p_id_back_path TEXT,
    p_selfie_path TEXT,
    p_bio TEXT,
    p_photos JSONB,
    p_city VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_submission public.kyc_submissions%ROWTYPE;
BEGIN
    IF p_role NOT IN ('CLIENT', 'COMPANION') THEN
        RAISE EXCEPTION 'Invalid KYC submission role';
    END IF;
    IF p_dob > CURRENT_DATE - INTERVAL '18 years' THEN
        RAISE EXCEPTION 'KYC applicant must be at least 18 years old';
    END IF;
    IF p_id_front_path IS NULL OR p_selfie_path IS NULL THEN
        RAISE EXCEPTION 'Required private KYC document paths are missing';
    END IF;

    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KYC user does not exist';
    END IF;
    IF v_user.role NOT IN (p_role, 'DUAL') THEN
        RAISE EXCEPTION 'User is not permitted to submit KYC for this role';
    END IF;

    INSERT INTO public.kyc_submissions (
        id, user_id, submission_role, legal_name, dob, id_type,
        id_front_document_path, id_back_document_path, selfie_document_path,
        status, submitted_at, profile_bio, profile_photos, city
    ) VALUES (
        p_submission_id, p_user_id, p_role, p_legal_name, p_dob, p_id_type,
        p_id_front_path, p_id_back_path, p_selfie_path,
        'PENDING', NOW(), p_bio, p_photos, p_city
    )
    ON CONFLICT (user_id, submission_role) DO UPDATE
    SET legal_name = EXCLUDED.legal_name,
        dob = EXCLUDED.dob,
        id_type = EXCLUDED.id_type,
        id_front_document_path = EXCLUDED.id_front_document_path,
        id_back_document_path = EXCLUDED.id_back_document_path,
        selfie_document_path = EXCLUDED.selfie_document_path,
        status = 'PENDING',
        submitted_at = NOW(),
        reviewed_at = NULL,
        reviewed_by = NULL,
        reviewed_by_admin_id = NULL,
        rejection_reason = NULL,
        profile_bio = EXCLUDED.profile_bio,
        profile_photos = EXCLUDED.profile_photos,
        city = EXCLUDED.city
    WHERE public.kyc_submissions.status <> 'APPROVED'
    RETURNING * INTO v_submission;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Approved KYC records cannot be replaced';
    END IF;

    UPDATE public.users
    SET legal_name = p_legal_name,
        dob = p_dob,
        age = DATE_PART('year', AGE(CURRENT_DATE, p_dob))::INTEGER,
        kyc_status = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN 'PENDING'
            ELSE kyc_status
        END,
        kyc_submitted_at = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NOW()
            ELSE kyc_submitted_at
        END,
        kyc_decided_at = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_decided_at
        END,
        kyc_decided_by = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_decided_by
        END,
        kyc_decided_by_admin_id = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_decided_by_admin_id
        END,
        kyc_rejection_reason = CASE
            WHEN role <> 'DUAL' OR p_role = 'CLIENT' THEN NULL
            ELSE kyc_rejection_reason
        END,
        bio = p_bio,
        photos = p_photos,
        city = p_city,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TO_JSONB(v_submission);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_profile_kyc(UUID, UUID, VARCHAR, VARCHAR, DATE, VARCHAR, TEXT, TEXT, TEXT, TEXT, JSONB, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_profile_kyc(UUID, UUID, VARCHAR, VARCHAR, DATE, VARCHAR, TEXT, TEXT, TEXT, TEXT, JSONB, VARCHAR)
    TO service_role;

CREATE OR REPLACE FUNCTION public.review_profile_kyc(
    p_submission_id UUID,
    p_decision VARCHAR,
    p_rejection_reason TEXT,
    p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_submission public.kyc_submissions%ROWTYPE;
    v_user public.users%ROWTYPE;
    v_admin public.admin_users%ROWTYPE;
BEGIN
    IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'Invalid KYC decision';
    END IF;
    IF p_decision = 'REJECTED' AND NULLIF(BTRIM(p_rejection_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A rejection reason is required';
    END IF;

    SELECT * INTO v_admin
    FROM public.admin_users
    WHERE id = p_admin_user_id AND is_active = TRUE
    FOR SHARE;
    IF NOT FOUND OR v_admin.role NOT IN ('SUPER_ADMIN', 'KYC_ADMIN') THEN
        RAISE EXCEPTION 'Administrator is not authorized to review KYC';
    END IF;

    SELECT * INTO v_submission
    FROM public.kyc_submissions
    WHERE id = p_submission_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KYC submission not found';
    END IF;

    UPDATE public.kyc_submissions
    SET status = p_decision,
        reviewed_at = NOW(),
        reviewed_by_admin_id = p_admin_user_id,
        rejection_reason = CASE WHEN p_decision = 'REJECTED' THEN BTRIM(p_rejection_reason) ELSE NULL END
    WHERE id = p_submission_id
    RETURNING * INTO v_submission;

    UPDATE public.users
    SET kyc_status = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN p_decision
            ELSE kyc_status
        END,
        kyc_decided_at = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN v_submission.reviewed_at
            ELSE kyc_decided_at
        END,
        kyc_decided_by_admin_id = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN p_admin_user_id
            ELSE kyc_decided_by_admin_id
        END,
        kyc_rejection_reason = CASE
            WHEN role <> 'DUAL' OR v_submission.submission_role = 'CLIENT' THEN v_submission.rejection_reason
            ELSE kyc_rejection_reason
        END,
        updated_at = NOW()
    WHERE id = v_submission.user_id
    RETURNING * INTO v_user;

    IF v_submission.submission_role = 'COMPANION' THEN
        UPDATE public.companion_profiles cp
        SET is_live = (
            p_decision = 'APPROVED'
            AND NOT COALESCE(cp.is_paused, FALSE)
            AND EXISTS (
                SELECT 1 FROM public.kyc_submissions k
                WHERE k.user_id = cp.user_id
                  AND k.submission_role = 'COMPANION'
                  AND k.status = 'APPROVED'
            )
            AND EXISTS (
                SELECT 1 FROM public.companion_memberships m
                WHERE m.user_id = cp.user_id
                  AND m.payment_status = 'PAID'
                  AND m.expiry_date > NOW()
            )
            AND EXISTS (
                SELECT 1 FROM public.bank_verifications b
                WHERE b.user_id = cp.user_id
                  AND b.verification_status = 'VERIFIED'
            )
        )
        WHERE cp.user_id = v_submission.user_id;
    END IF;

    INSERT INTO public.audit_logs (
        admin_user_id, user_id, action, entity_type, entity_id, details
    ) VALUES (
        p_admin_user_id, v_submission.user_id, 'KYC_' || p_decision,
        'kyc_submission', v_submission.id,
        jsonb_build_object(
            'submission_role', v_submission.submission_role,
            'rejection_reason', v_submission.rejection_reason
        )
    );

    RETURN JSONB_BUILD_OBJECT('submission', TO_JSONB(v_submission), 'user', TO_JSONB(v_user));
END;
$$;

REVOKE ALL ON FUNCTION public.review_profile_kyc(UUID, VARCHAR, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_profile_kyc(UUID, VARCHAR, TEXT, UUID)
    TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_companion_activation_gates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.is_live THEN
        NEW.is_live := NOT COALESCE(NEW.is_paused, FALSE) AND EXISTS (
            SELECT 1
            FROM public.kyc_submissions k
            WHERE k.user_id = NEW.user_id
              AND k.submission_role = 'COMPANION'
              AND k.status = 'APPROVED'
        ) AND EXISTS (
            SELECT 1
            FROM public.companion_memberships m
            WHERE m.user_id = NEW.user_id
              AND m.payment_status = 'PAID'
              AND m.expiry_date > NOW()
        ) AND EXISTS (
            SELECT 1
            FROM public.bank_verifications b
            WHERE b.user_id = NEW.user_id
              AND b.verification_status = 'VERIFIED'
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_companion_activation_gates
    BEFORE INSERT OR UPDATE OF is_live ON public.companion_profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_companion_activation_gates();
