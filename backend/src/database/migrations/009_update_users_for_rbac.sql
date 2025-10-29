-- Migration: Update users table for RBAC
-- Description: Add inventory_manager role and suspended status

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with inventory_manager role
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'sales', 'inventory_manager'));

-- Add suspended column (keeping is_active for backward compatibility)
-- is_active = true AND suspended = false means user is fully active
-- is_active = false means soft deleted
-- suspended = true means temporarily suspended by admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false;

-- Add suspended_at timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;

-- Add suspended_by reference to track who suspended the user
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for suspended users
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended) WHERE suspended = true;

-- Add must_change_password flag for first login
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN users.is_active IS 'Soft delete flag - false means user is deleted';
COMMENT ON COLUMN users.suspended IS 'Temporary suspension by admin - true means user cannot log in';
COMMENT ON COLUMN users.must_change_password IS 'Forces user to change password on next login';
COMMENT ON COLUMN users.role IS 'User role: admin (full access), sales (no params, no delete), inventory_manager (products/stock only)';
