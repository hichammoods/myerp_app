-- Seed: Create Initial Admin User
-- This creates the first super admin user for the system
-- Default credentials: admin@myerp.com / Admin@123456
-- IMPORTANT: Change password immediately after first login!

-- Generate bcrypt hash for password "Admin@123456" (10 rounds)
-- Hash: $2a$10$xYz9KPqH4mN8vLwO.QrJXe8kF2hG6jR5tA3bC7dE1fI0gH9jK8lM
-- You should change this password immediately after deployment!

INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  role,
  is_active,
  email_verified,
  created_at,
  updated_at
) VALUES (
  'admin@myerp.com',
  '$2a$10$rHf16s7daLddDyrv9C1sDOk0fuurEqD6e1joBPJVeNtfCaZ1OUPjW',  -- Password: Admin@123456
  'Admin',
  'MyERP',
  'admin',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ======================
-- SUCCESS MESSAGE
-- ======================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin user created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email: admin@myerp.com';
  RAISE NOTICE 'Password: Admin@123456';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'IMPORTANT: Change this password immediately after first login!';
  RAISE NOTICE '========================================';
END $$;
