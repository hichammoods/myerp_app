# MyERP - Sales Order Management System Specifications

## 1. Executive Summary

MyERP is a scalable, dockerized enterprise resource planning (ERP) application designed for creating and managing sales orders. Following the paradigm of established tools like Odoo, it provides a comprehensive solution for contact management, inventory control, quotation creation, and sales performance tracking.

## 2. System Architecture

### 2.1 Technology Stack
- **Backend**: Node.js with Express.js / NestJS
- **Frontend**: React with TypeScript
- **Database**: PostgreSQL
- **File Storage**: MinIO (S3-compatible object storage)
- **Containerization**: Docker & Docker Compose
- **Authentication**: JWT with role-based access control
- **PDF Generation**: Puppeteer or jsPDF
- **Monitoring**: Prometheus + Grafana
- **Backup**: pg_dump with automated scheduling

### 2.2 Architecture Pattern
- **Microservices-based architecture** with the following services:
  - API Gateway
  - Authentication Service
  - Contact Management Service
  - Inventory Service
  - Quotation Service
  - Sales Order Service
  - Reporting Service
  - File Storage Service
  - Notification Service

## 3. Functional Requirements

### 3.1 User Roles & Authentication

#### Roles:
1. **Administrator**
   - Full system access
   - User management
   - System configuration
   - Access to all data and reports

2. **Sales Representative**
   - Create/edit own quotations
   - View assigned contacts
   - Access to own sales dashboard
   - Limited inventory view

#### Authentication Features:
- Secure login with email/password
- JWT token-based authentication
- Role-based access control (RBAC)
- Session management
- Password reset functionality
- Multi-factor authentication (future enhancement)

### 3.2 Contact Management Module

#### Features:
- **CRUD Operations** for customer contacts
- **Fields**:
  - First Name (required)
  - Last Name (required)
  - Email (required, unique)
  - Phone Number
  - Company Name
  - Address (Street, City, State, Zip, Country)
  - Tax ID
  - Notes
  - Tags for categorization
  - Created Date
  - Last Modified Date
  - Assigned Sales Rep

#### Functionality:
- Search and filter contacts
- Import/Export contacts (CSV, Excel)
- Duplicate detection
- Contact history tracking
- Activity log

### 3.3 Inventory Management Module

#### Features:
- **Product Management**
  - SKU (unique identifier)
  - Product Name
  - Description
  - Category
  - Unit Price
  - Cost Price
  - Current Quantity
  - Minimum Stock Level
  - Unit of Measure
  - Product Images (stored in MinIO)
  - Barcode
  - Supplier Information
  - Tax Rate

#### Functionality:
- Real-time stock tracking
- Low stock alerts
- Stock movement history
- Batch/Serial number tracking
- Product categories and tags
- Bulk import/export
- Price history
- Multi-currency support

### 3.4 Quotation Management Module

#### Features:
- **Quotation Header**:
  - Quotation Number (auto-generated)
  - Customer (linked to Contact)
  - Sales Representative (auto-assigned)
  - Creation Date
  - Expiration Date
  - Delivery Date
  - Status (Draft, Sent, Accepted, Rejected, Expired)
  - Payment Terms
  - Delivery Terms
  - Currency

- **Quotation Lines**:
  - Product (dropdown from inventory or free text)
  - Description
  - Quantity
  - Unit Price (auto-filled, editable)
  - Discount (% or amount)
  - Tax Rate
  - Line Total
  - Stock Availability Indicator
  - Notes

- **Sections/Categories**:
  - Group items by category
  - Section headers
  - Section subtotals

- **Additional Features**:
  - Notes/Comments section
  - Terms & Conditions
  - Attachments
  - Version control
  - Quotation templates

#### Functionality:
- Auto-save draft
- Stock verification
- Automatic inventory deduction (on confirmation)
- PDF generation with professional template
- Email quotation to customer
- Quotation duplication
- Convert to Sales Order
- Quotation comparison
- Approval workflow

### 3.5 Sales Order Module

#### Features:
- Inherit all quotation data
- Additional fields:
  - Order Number
  - Order Date
  - Payment Status
  - Delivery Status
  - Invoice Number
  - Tracking Information

#### Functionality:
- Order confirmation workflow
- Payment tracking
- Delivery management
- Invoice generation
- Order history
- Returns management

### 3.6 Sales Dashboard

#### Key Performance Indicators (KPIs):
- **Revenue Metrics**:
  - Total Revenue (MTD, QTD, YTD)
  - Average Order Value
  - Revenue by Product Category
  - Revenue by Customer

- **Sales Performance**:
  - Number of Quotations (by status)
  - Conversion Rate (Quotation to Order)
  - Sales by Representative
  - Sales Cycle Length
  - Win/Loss Ratio

- **Customer Metrics**:
  - New Customers
  - Customer Lifetime Value
  - Top Customers
  - Customer Retention Rate

- **Product Metrics**:
  - Best Selling Products
  - Inventory Turnover
  - Product Performance

#### Filtering Options:
- Date Range
- Sales Representative
- Customer
- Product Category
- Region
- Status

#### Visualizations:
- Line charts for trends
- Bar charts for comparisons
- Pie charts for distributions
- Tables for detailed data
- Heat maps for geographic data

## 4. Non-Functional Requirements

### 4.1 Performance
- Page load time < 2 seconds
- API response time < 500ms
- Support 100+ concurrent users
- Handle 10,000+ products in inventory
- Process 1,000+ orders per day

### 4.2 Scalability
- Horizontal scaling capability
- Microservices architecture
- Load balancing
- Database replication
- Caching strategy (Redis)

### 4.3 Security
- HTTPS/TLS encryption
- Data encryption at rest
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting
- Audit logging
- GDPR compliance

### 4.4 Reliability
- 99.9% uptime SLA
- Automated backups (daily)
- Disaster recovery plan
- Error monitoring and logging
- Graceful error handling

### 4.5 Usability
- Responsive design (desktop, tablet, mobile)
- Intuitive UI/UX
- Multi-language support
- Keyboard shortcuts
- Bulk operations
- Advanced search capabilities

## 5. Database Schema

### 5.1 Core Tables

#### users
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- first_name (VARCHAR)
- last_name (VARCHAR)
- role (ENUM: admin, sales)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)

#### contacts
- id (UUID, PK)
- first_name (VARCHAR)
- last_name (VARCHAR)
- email (VARCHAR)
- phone (VARCHAR)
- company_name (VARCHAR)
- address_street (VARCHAR)
- address_city (VARCHAR)
- address_state (VARCHAR)
- address_zip (VARCHAR)
- address_country (VARCHAR)
- tax_id (VARCHAR)
- notes (TEXT)
- assigned_to (UUID, FK -> users)
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### products
- id (UUID, PK)
- sku (VARCHAR, UNIQUE)
- name (VARCHAR)
- description (TEXT)
- category_id (UUID, FK -> categories)
- unit_price (DECIMAL)
- cost_price (DECIMAL)
- quantity (INTEGER)
- min_stock_level (INTEGER)
- unit_of_measure (VARCHAR)
- tax_rate (DECIMAL)
- image_url (VARCHAR)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### categories
- id (UUID, PK)
- name (VARCHAR)
- parent_id (UUID, FK -> categories, NULL)
- description (TEXT)
- created_at (TIMESTAMP)

#### quotations
- id (UUID, PK)
- quotation_number (VARCHAR, UNIQUE)
- contact_id (UUID, FK -> contacts)
- sales_rep_id (UUID, FK -> users)
- status (ENUM: draft, sent, accepted, rejected, expired)
- expiration_date (DATE)
- delivery_date (DATE)
- payment_terms (VARCHAR)
- delivery_terms (VARCHAR)
- currency (VARCHAR)
- subtotal (DECIMAL)
- tax_amount (DECIMAL)
- discount_amount (DECIMAL)
- total_amount (DECIMAL)
- notes (TEXT)
- terms_conditions (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- version (INTEGER)

#### quotation_lines
- id (UUID, PK)
- quotation_id (UUID, FK -> quotations)
- product_id (UUID, FK -> products, NULL)
- section_id (UUID, FK -> quotation_sections, NULL)
- line_number (INTEGER)
- product_name (VARCHAR)
- description (TEXT)
- quantity (DECIMAL)
- unit_price (DECIMAL)
- discount_percent (DECIMAL)
- discount_amount (DECIMAL)
- tax_rate (DECIMAL)
- line_total (DECIMAL)
- notes (TEXT)
- created_at (TIMESTAMP)

#### quotation_sections
- id (UUID, PK)
- quotation_id (UUID, FK -> quotations)
- name (VARCHAR)
- display_order (INTEGER)
- created_at (TIMESTAMP)

#### sales_orders
- id (UUID, PK)
- order_number (VARCHAR, UNIQUE)
- quotation_id (UUID, FK -> quotations)
- contact_id (UUID, FK -> contacts)
- sales_rep_id (UUID, FK -> users)
- order_date (DATE)
- payment_status (ENUM: pending, partial, paid)
- delivery_status (ENUM: pending, processing, shipped, delivered)
- invoice_number (VARCHAR)
- tracking_number (VARCHAR)
- total_amount (DECIMAL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### inventory_movements
- id (UUID, PK)
- product_id (UUID, FK -> products)
- movement_type (ENUM: in, out, adjustment)
- quantity (DECIMAL)
- reference_type (VARCHAR)
- reference_id (UUID)
- reason (VARCHAR)
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)

### 5.2 Indexes
- users: email, role
- contacts: email, assigned_to, company_name
- products: sku, name, category_id
- quotations: quotation_number, contact_id, sales_rep_id, status
- sales_orders: order_number, quotation_id, payment_status

## 6. API Endpoints

### 6.1 Authentication
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

### 6.2 Contacts
- GET /api/contacts
- GET /api/contacts/:id
- POST /api/contacts
- PUT /api/contacts/:id
- DELETE /api/contacts/:id
- GET /api/contacts/search
- POST /api/contacts/import
- GET /api/contacts/export

### 6.3 Products
- GET /api/products
- GET /api/products/:id
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id
- GET /api/products/search
- POST /api/products/upload-image
- GET /api/products/low-stock

### 6.4 Quotations
- GET /api/quotations
- GET /api/quotations/:id
- POST /api/quotations
- PUT /api/quotations/:id
- DELETE /api/quotations/:id
- POST /api/quotations/:id/send
- POST /api/quotations/:id/duplicate
- POST /api/quotations/:id/convert-to-order
- GET /api/quotations/:id/pdf
- GET /api/quotations/:id/versions

### 6.5 Sales Orders
- GET /api/sales-orders
- GET /api/sales-orders/:id
- POST /api/sales-orders
- PUT /api/sales-orders/:id
- GET /api/sales-orders/:id/invoice

### 6.6 Dashboard
- GET /api/dashboard/summary
- GET /api/dashboard/revenue
- GET /api/dashboard/sales-performance
- GET /api/dashboard/top-products
- GET /api/dashboard/top-customers

## 7. Deployment & Infrastructure

### 7.1 Docker Services
- **app**: Main application (Node.js)
- **postgres**: PostgreSQL database
- **redis**: Caching layer
- **minio**: Object storage
- **nginx**: Reverse proxy
- **prometheus**: Metrics collection
- **grafana**: Metrics visualization
- **backup**: Automated backup service

### 7.2 Environment Variables
- DATABASE_URL
- REDIS_URL
- MINIO_ENDPOINT
- MINIO_ACCESS_KEY
- MINIO_SECRET_KEY
- JWT_SECRET
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- BACKUP_SCHEDULE
- BACKUP_RETENTION_DAYS

### 7.3 Backup Strategy
- Daily automated backups at 2 AM
- PostgreSQL: pg_dump with compression
- MinIO: S3 sync to backup bucket
- Retention: 30 days
- Off-site backup to cloud storage
- Backup verification and restoration testing

### 7.4 Monitoring
- Application metrics (Prometheus)
- Error tracking (Sentry)
- Log aggregation (ELK Stack)
- Uptime monitoring
- Performance monitoring
- Alert configuration

## 8. Development Phases

### Phase 1: Foundation (Weeks 1-2)
- Project setup and configuration
- Database design and migration
- Authentication system
- Basic CRUD for users

### Phase 2: Core Modules (Weeks 3-5)
- Contact management
- Inventory management
- Basic UI implementation

### Phase 3: Quotation System (Weeks 6-8)
- Quotation creation and management
- PDF generation
- Email integration

### Phase 4: Sales Orders (Weeks 9-10)
- Order conversion
- Order management
- Invoice generation

### Phase 5: Dashboard & Reporting (Weeks 11-12)
- Dashboard implementation
- Report generation
- Data visualization

### Phase 6: Polish & Deployment (Weeks 13-14)
- Testing and bug fixes
- Performance optimization
- Documentation
- Deployment setup

## 9. Future Enhancements
- Mobile application
- Advanced reporting and analytics
- CRM integration
- Accounting module
- Purchase order management
- Multi-company support
- Workflow automation
- AI-powered insights
- Customer portal
- Supplier portal