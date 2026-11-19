-- HANYA pengembangan: Mitra tiruan (scripts/mitra-tiruan.mjs) dengan rahasia dev yang diketahui.
-- client_secret = 'rahasia-klien-mitra-dev' ; hmac = 'rahasia-hmac-mitra-dev-0123456789'
SET search_path = integrasi;
INSERT INTO mitra_siplah (kode, nama, base_url, client_id, client_secret_hash, hmac_rahasia, ip_diizinkan)
VALUES ('MITRA_DEV', 'Toko Daring Contoh (Mitra tiruan)', 'http://localhost:3190', 'mitra-dev',
        encode(sha256('rahasia-klien-mitra-dev'::bytea), 'hex'), 'rahasia-hmac-mitra-dev-0123456789', ARRAY['127.0.0.1','::1'])
ON CONFLICT (kode) DO NOTHING;
