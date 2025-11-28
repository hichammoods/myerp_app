-- Migration: Create notifications table
-- Description: Store notifications for users when sales orders are created

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'sales_order_created',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(50), -- e.g., 'sales_order', 'invoice'
  related_entity_id UUID, -- e.g., sales_order.id
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Create index for faster lookups by user
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Create index for unread notifications
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Create index for created_at (for sorting)
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
