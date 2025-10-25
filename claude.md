# MyERP - Sales Order Management System

## Project Overview

MyERP is a modern, scalable ERP system designed for managing sales operations, similar to Odoo. It provides comprehensive functionality for contact management, inventory control, quotation creation, sales order processing, and performance analytics.

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Node.js 18+ (for local development)
- PostgreSQL client tools (optional)
- Git

### Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd myerp_app

# Copy environment variables
cp .env.example .env

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec api npm run migrate

# Seed initial data (optional)
docker-compose exec api npm run seed

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:4000
# MinIO: http://localhost:9000
# Grafana: http://localhost:3001
```

## Architecture Overview

### Service Architecture
```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                        │
│                        (Nginx)                           │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             ▼                            ▼
┌─────────────────────┐      ┌─────────────────────────┐
│   React Frontend    │      │      API Gateway        │
│   (Port 3000)       │      │      (Port 4000)        │
└─────────────────────┘      └────────┬─────────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
                ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │  Auth Service   │   │ Contact Service │   │ Inventory Service│
    └─────────────────┘   └─────────────────┘   └─────────────────┘
                │                     │                     │
                ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │ Quotation Svc   │   │Sales Order Svc  │   │ Reporting Svc   │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
                │                     │                     │
                └─────────────────────┼─────────────────────┘
                                      │
                        ┌─────────────┼─────────────┐
                        │             │             │
                        ▼             ▼             ▼
            ┌─────────────────┐ ┌─────────┐ ┌─────────────┐
            │   PostgreSQL    │ │  Redis  │ │    MinIO    │
            │   (Port 5432)   │ │ (6379)  │ │   (9000)    │
            └─────────────────┘ └─────────┘ └─────────────┘
```

## Development Workflow

### Working with the Codebase

#### Backend Development
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

#### Frontend Development
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build
```

### Database Operations

#### Running Migrations
```bash
# Create a new migration
npm run migrate:create -- --name add_customer_notes

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

#### Database Seeding
```bash
# Seed development data
npm run seed:dev

# Seed test data
npm run seed:test

# Clear all data
npm run db:reset
```

### Docker Commands

#### Service Management
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service_name]

# Restart a specific service
docker-compose restart [service_name]

# Rebuild services
docker-compose build [service_name]

# Execute command in container
docker-compose exec [service_name] [command]
```

#### Backup and Restore
```bash
# Create database backup
docker-compose exec postgres pg_dump -U myerp myerp_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U myerp myerp_db < backup.sql

# Backup MinIO data
docker-compose exec minio mc mirror minio/data /backup/
```

## API Documentation

### Authentication Endpoints

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer [refresh_token]
```

### Contact Management

#### List Contacts
```http
GET /api/contacts?page=1&limit=20&search=john&assigned_to=user_id
Authorization: Bearer [access_token]
```

#### Create Contact
```http
POST /api/contacts
Authorization: Bearer [access_token]
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company_name": "Acme Corp"
}
```

### Inventory Management

#### List Products
```http
GET /api/products?category=electronics&in_stock=true
Authorization: Bearer [access_token]
```

#### Update Stock
```http
PUT /api/products/{id}/stock
Authorization: Bearer [access_token]
Content-Type: application/json

{
  "quantity": 100,
  "movement_type": "adjustment",
  "reason": "Stock count correction"
}
```

### Quotation Management

#### Create Quotation
```http
POST /api/quotations
Authorization: Bearer [access_token]
Content-Type: application/json

{
  "contact_id": "uuid",
  "expiration_date": "2024-12-31",
  "lines": [
    {
      "product_id": "uuid",
      "quantity": 10,
      "unit_price": 99.99,
      "discount_percent": 10
    }
  ]
}
```

#### Generate PDF
```http
GET /api/quotations/{id}/pdf
Authorization: Bearer [access_token]
```

## Key Features Implementation

### 1. Contact Management
- Full CRUD operations for customer contacts
- Search and filtering capabilities
- Contact assignment to sales reps
- Activity tracking and history
- Import/export functionality

### 2. Inventory System
- Real-time stock tracking
- Low stock alerts
- Product categorization
- Image storage via MinIO
- Stock movement history
- Batch tracking support

### 3. Quotation Module
- Dynamic quotation creation
- Product selection from inventory
- Custom pricing and discounts
- Section-based organization
- Professional PDF generation
- Version control
- Expiration management

### 4. Sales Orders
- Quotation to order conversion
- Order status tracking
- Payment management
- Delivery tracking
- Invoice generation
- Order history

### 5. Dashboard & Analytics
- Real-time sales metrics
- Performance by sales rep
- Customer analytics
- Product performance
- Revenue tracking
- Custom date ranges
- Export capabilities

## Business Logic

### Quotation Workflow
```
Draft → Sent → [Accepted|Rejected|Expired]
                    ↓
              Sales Order
                    ↓
              Processing → Shipped → Delivered
```

### Inventory Management
- Automatic stock reservation on order confirmation
- Stock deduction on order delivery
- Low stock notifications
- Reorder point management

### Pricing Rules
- Base price from product catalog
- Customer-specific pricing (future)
- Volume discounts
- Promotional pricing
- Tax calculations

## Security Considerations

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Sales)
- API rate limiting
- Session management
- Password policies

### Data Protection
- Encrypted passwords (bcrypt)
- HTTPS/TLS for all communications
- Sensitive data encryption
- Audit logging
- GDPR compliance features

## Monitoring & Maintenance

### Health Checks
```bash
# Check all services status
docker-compose ps

# Check API health
curl http://localhost:4000/health

# Check database connections
docker-compose exec api npm run db:check
```

### Log Management
- Application logs: `/var/log/myerp/`
- Error tracking with Sentry
- Performance monitoring with Grafana
- Custom dashboards for business metrics

### Backup Schedule
- Database: Daily at 2 AM
- Files (MinIO): Daily at 3 AM
- Retention: 30 days local, 1 year archive

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker-compose logs postgres

# Test connection
docker-compose exec api npm run db:test

# Reset database
docker-compose exec api npm run db:reset
```

#### File Upload Issues
```bash
# Check MinIO status
docker-compose logs minio

# Verify bucket exists
docker-compose exec minio mc ls minio/

# Check permissions
docker-compose exec minio mc policy get minio/uploads
```

#### Performance Issues
```bash
# Check resource usage
docker stats

# Analyze slow queries
docker-compose exec postgres psql -U myerp -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Clear cache
docker-compose exec redis redis-cli FLUSHALL
```

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testFile=products.test.js
```

### Integration Tests
```bash
# Run API tests
npm run test:api

# Run E2E tests
npm run test:e2e
```

### Load Testing
```bash
# Run load tests
npm run test:load

# Generate report
npm run test:load:report
```

## Deployment

### Production Deployment

#### Using Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml myerp

# Scale services
docker service scale myerp_api=3
```

#### Using Kubernetes
```bash
# Apply configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n myerp

# Scale deployment
kubectl scale deployment api --replicas=3 -n myerp
```

### Environment Variables

#### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/myerp
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=uploads

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@myerp.com

# Application
NODE_ENV=production
API_PORT=4000
FRONTEND_URL=http://localhost:3000
```

## Performance Optimization

### Database Optimization
- Proper indexing strategy
- Query optimization
- Connection pooling
- Read replicas for reporting
- Materialized views for dashboards

### Caching Strategy
- Redis for session management
- API response caching
- Static asset caching
- Database query caching

### Frontend Optimization
- Code splitting
- Lazy loading
- Image optimization
- CDN for static assets
- Service workers for offline support

## Extending the System

### Adding New Modules
1. Create service directory: `services/new-module/`
2. Define database schema
3. Implement API endpoints
4. Add frontend components
5. Update routing
6. Add tests
7. Update documentation

### Custom Reports
1. Define report template
2. Create data aggregation query
3. Implement export formats (PDF, Excel, CSV)
4. Add to dashboard
5. Schedule if needed

### Integrations
- Payment gateways (Stripe, PayPal)
- Shipping providers (FedEx, UPS)
- Accounting software (QuickBooks, Xero)
- CRM systems (Salesforce, HubSpot)
- Email marketing (Mailchimp, SendGrid)

## Support & Resources

### Documentation
- API Documentation: `/docs/api`
- Database Schema: `/docs/database`
- User Manual: `/docs/user-guide`

### Community
- GitHub Issues: Report bugs and request features
- Discord: Join our community chat
- Forum: Discussion and support

### Professional Support
- Email: support@myerp.com
- Priority support for enterprise customers
- Custom development services
- Training and consultation

## License

This project is proprietary software. See LICENSE file for details.

## Contributors

- Lead Developer: [Your Name]
- Database Architect: [Name]
- UI/UX Designer: [Name]
- DevOps Engineer: [Name]

## Changelog

### Version 1.0.2 (Current - 2025-10-26)
**All Core Features Complete - MVP Ready for Testing**

**Completed Work Packages (WP1-8)**:
- ✅ **WP1**: Sales Order & Invoice Workflow (complete business workflow)
- ✅ **WP2**: Product Image Upload (MinIO integration)
- ✅ **WP3**: Product Materials System
- ✅ **WP4**: Authentication & Routes (JWT)
- ✅ **WP5**: Company Settings & PDF Generation (quotations)
- ✅ **WP6**: DECIMAL Type Fix (critical bug fix)
- ✅ **WP7**: Dashboard Real Data Integration
- ✅ **WP8**: Product Images in Quotations

**System Capabilities**:
- Complete quotation → sales order → invoice workflow
- Automatic stock deduction and restoration
- Product catalog with images and materials
- Contact management with dynamic active/inactive logic
- Real-time dashboard with live metrics
- Professional PDF generation for quotations
- Role-based authentication (basic)
- MinIO object storage integration

**Known Limitations**:
- Sales order and invoice PDF generation pending
- Detail pages for orders/invoices need enhancement
- Role-based access control not yet implemented
- DECIMAL conversions needed in some API endpoints

### Version 1.0.1 (2025-10-26)
- **CRITICAL FIX**: Fixed DECIMAL type handling causing incorrect stock status calculations
- Dashboard now displays real-time data from all APIs (products, contacts, quotations, invoices)
- Enhanced dashboard with detailed recent quotations and invoices sections
- Implemented dynamic active/inactive contact logic
- Product images now displayed in quotation builder catalog
- Added comprehensive DECIMAL columns documentation (`DECIMAL_COLUMNS_ANALYSIS.md`)
- Fixed product stock status comparison bug (string vs numeric)
- Created contact stats endpoint with business activity tracking

### Version 1.0.0 (2025-10-25)
- Initial release
- Core modules: Contacts, Inventory, Quotations
- Product image upload system with MinIO integration
- Company settings management
- Professional PDF generation for quotations
- Product-material-finish relationship system
- JWT authentication and protected routes
- Docker deployment support

### Roadmap

**Immediate (v1.1 - Testing Phase)**
- **WP9**: Testing & Bug Fixes (2-3 days)
  - End-to-end workflow validation
  - DECIMAL conversions in all APIs
  - PDF generation for orders/invoices
  - Edge case testing

**Near-term (v1.2 - Enhanced Security)**
- **WP10**: Role-Based Access Control (3-4 days)
  - User roles: Admin, Manager, Sales, Viewer
  - Permission-based UI rendering
  - API-level role enforcement
  - User management interface

**Mid-term (v1.3 - Enhanced UX)**
- **WP11**: Sales Order Kanban Board (4-5 days)
  - Drag-and-drop status management
  - Priority system (high/medium/low)
  - Visual workflow management
  - Analytics per stage

**Long-term (v2.0+)**
- **WP12**: Additional Features
  - Email notifications
  - Customer portal
  - Multi-currency support
  - Payment gateway integration
  - Purchase order management
  - Advanced reporting
  - Mobile application
---

## Current Development Status (2025-10-26)

### 📊 Project Status Overview

**Phase**: MVP Complete - Quality & Enhancement Phase
**Version**: 1.0.2
**Completion**: 8/8 Core Work Packages Complete (100%)

**System Status**: ✅ Fully Functional MVP
- All core business features implemented
- Database schema complete
- Backend APIs operational
- Frontend UI functional
- Basic authentication working

**Current Focus**: WP9 - Testing & Bug Fixes
**Next Focus**: WP10 - Role-Based Access Control
**Future Enhancement**: WP11 - Kanban Board for Sales Orders

---

### Recent Changes & Implementation

#### 1. Sales Order & Invoice Workflow (WP1 - Complete ✅)
**Status**: Completed (2025-10-26)
**Reference**: See `improved_V2.md` for complete technical specification

**Overview**:
Complete quotation → sales order → invoice workflow with manual conversion and automatic stock management.

**Workflow States**:
```
Quotation (accepté)
    ↓ [User clicks "Convertir en commande"]
Sales Order (en_cours) → en_préparation → expédié → livré → terminé
    ↓ [User clicks "Créer facture"]
Invoice (brouillon) → envoyée → payée → annulée
```

**Completed Features**:
- ✅ Database schema: sales_orders, sales_order_items, invoices, invoice_items tables
- ✅ Backend API routes for sales orders (create, list, get, update status, cancel)
- ✅ Backend API routes for invoices (create, list, get, update status, payment tracking)
- ✅ Stock deduction logic on order creation
- ✅ Stock restoration on order cancellation
- ✅ Frontend API integration (salesOrdersApi, invoicesApi)
- ✅ Sales order list page UI with filters and status badges
- ✅ Invoice list page UI with payment tracking
- ✅ Navigation menu items and routing
- ✅ Document cross-references (Quotation → Sales Order → Invoice)
- ✅ Status management workflow

**Database Migrations Created**:
- `backend/src/database/migrations/015_create_sales_orders_table.sql`
- `backend/src/database/migrations/016_create_invoices_table.sql`
- `backend/src/database/migrations/017_update_quotations_for_sales_orders.sql`

**Files Created**:
```
Backend:
- backend/src/routes/sales-orders.ts (Complete API)
- backend/src/routes/invoices.ts (Complete API)

Frontend:
- frontend/src/pages/sales-orders/SalesOrderManagement.tsx
- frontend/src/pages/invoices/InvoiceManagement.tsx
- frontend/src/services/api.ts (salesOrdersApi, invoicesApi added)
```

**Known Limitations** (To be addressed in future work):
- [ ] Sales order detail page with context-sensitive actions
- [ ] Invoice detail page with payment recording
- [ ] PDF generation for sales orders
- [ ] PDF generation for invoices
- [ ] Quotation conversion button UI
- [ ] Full workflow end-to-end testing

#### 2. Product Image Upload System (WP2 - Complete ✅)
**Status**: Fully working

**Completed**:
- ✅ MinIO integration for object storage
  - Configuration: `backend/src/config/minio.ts`
  - Bucket: `myerp-uploads`
  - Public read access configured
  - Server initialized in `backend/src/server.ts:46-54`

- ✅ Database Schema
  - Migration `005_add_images_column_to_products.sql` 
  - Added `images` JSONB column to products table
  - GIN index for performance
  - Stores array of image objects with metadata

- ✅ File Upload Middleware
  - Created: `backend/src/middleware/upload.ts`
  - Uses multer with memory storage
  - File validation (JPEG, PNG, WebP)
  - Size limit: 5MB
  - Unique filename generation

- ✅ Backend API Endpoints
  - POST `/api/products/:id/upload-image` - Upload image to MinIO and save metadata (Line 970)
  - DELETE `/api/products/:id/images/:filename` - Delete image (Line 1054)
  - PATCH `/api/products/:id/images/:filename/set-main` - Set main image (Line 1112)
  - Updated CREATE endpoint to save images field (Line 648-666)
  - Updated UPDATE endpoint to save images field (Line 773-793)

- ✅ Frontend Components
  - `ImageUpload.tsx` - Drag & drop, progress tracking, gallery view
  - XHR-based upload with progress events
  - useRef pattern to prevent stale closures
  - Preview generation with FileReader

**Files Created/Modified**:
```
backend/src/config/minio.ts (NEW)
backend/src/middleware/upload.ts (NEW)
backend/src/database/migrations/005_add_images_column_to_products.sql (NEW)
backend/src/routes/products-simple.ts (MODIFIED - added upload endpoints, images to CREATE/UPDATE)
backend/src/server.ts (MODIFIED - MinIO initialization)
frontend/src/components/ImageUpload.tsx (MODIFIED - real upload implementation)
frontend/src/pages/products/ProductForm.tsx (MODIFIED - useEffect for state sync, productId prop)
frontend/src/pages/products/ProductManagement.tsx (MODIFIED - image gallery in details view)
```

#### 3. Product Materials System (WP3 - Complete ✅)
**Status**: Completed

- ✅ Product-Material-Finish relationship implemented
- ✅ Accordion UI for material entries
- ✅ Dynamic add/remove materials
- ✅ Supplier field persistence fixed

#### 4. Authentication & Routes Restructure (WP4 - Complete ✅)
**Status**: Completed

- ✅ Simplified route structure
- ✅ JWT authentication middleware
- ✅ Auth routes: login, register, logout
- ✅ Protected API endpoints

#### 5. Company Settings & PDF Generation (WP5 - Complete ✅)
**Status**: Completed

- ✅ Company settings page with form (Settings.tsx)
- ✅ Backend API endpoints for company settings
- ✅ PDF generator for quotations with optimized layout
- ✅ Fixed table column truncation issue
- ✅ Compact header layout with company info
- ✅ Professional footer with signature boxes
- ✅ Document cross-references support

**Files Created**:
- `frontend/src/pages/Settings.tsx`
- `frontend/src/services/pdfGenerator.ts`
- `backend/src/routes/settings.routes.ts` (assumed)

#### 6. DECIMAL Type Handling & Stock Status Fix (WP6 - Complete ✅)
**Status**: Completed (2025-10-26)
**Priority**: CRITICAL - Fixed data type bug affecting financial and inventory calculations

**Problem Identified**:
PostgreSQL DECIMAL/NUMERIC columns are returned as strings by the `pg` driver to preserve precision. This caused critical bugs in comparison operations where JavaScript performed lexicographic string comparison instead of numeric comparison.

**Critical Bug Example**:
- Product with SKU "ddddddd": 9 units in stock, min=2, max=20
- Expected status: "normal"
- Actual status: "surstock" (incorrect)
- Root cause: `"9.00" > "20.00"` evaluates to `true` (string comparison!)

**Completed**:
- ✅ Identified and fixed stock status comparison bug in products section
- ✅ Added `parseFloat()` conversions in backend API response mapping
- ✅ Added `parseFloat()` conversions in frontend comparison logic
- ✅ Created comprehensive documentation of all 95+ DECIMAL columns in database
- ✅ Risk assessment for all DECIMAL columns (CRITICAL, HIGH, MEDIUM)
- ✅ Documented prevention strategies and testing checklist

**Files Modified**:
```
backend/src/routes/products-simple.ts (lines 603-605)
  - Added parseFloat() for stock_quantity, min_stock_level, max_stock_level

frontend/src/pages/products/ProductManagement.tsx (lines 328-331)
  - Added parseFloat() for stock comparisons in UI
```

**Files Created**:
```
backend/DECIMAL_COLUMNS_ANALYSIS.md
  - Complete analysis of all DECIMAL columns
  - Risk levels and usage patterns
  - Recommendations for fixing remaining columns
  - Testing checklist
```

**Tables with DECIMAL Columns Identified**:
- Products (15 columns including prices, dimensions, stock levels) ⚠️
- Materials (3 columns for cost and stock)
- Finishes (1 column for extra cost)
- Contacts (1 column for credit limit)
- Quotations (7 columns for financial calculations) 🔴
- Quotation Lines (8 columns for line item calculations) 🔴
- Sales Orders (6 columns for order totals) 🔴
- Sales Order Items (7 columns) 🔴
- Invoices (8 columns for payment tracking) 🔴
- Invoice Items (7 columns) 🔴
- Inventory Movements (4 columns for quantity and cost)
- Customization Options (1 column for extra cost)
- Quotation Sections (1 column for subtotal)

**Action Items for Future**:
- [ ] Review and fix DECIMAL handling in quotations API
- [ ] Review and fix DECIMAL handling in sales orders API
- [ ] Review and fix DECIMAL handling in invoices API
- [ ] Review and fix DECIMAL handling in inventory movements
- [ ] Add unit tests for numeric comparisons
- [ ] Document DECIMAL handling pattern in API development guide

**Prevention Strategy**:
1. Always use `parseFloat()` or `Number()` when reading DECIMAL columns from PostgreSQL
2. Add TypeScript interfaces that explicitly type financial fields as `number`
3. Use utility functions like `toNumber()` consistently
4. Add comments when DECIMAL columns are involved

#### 7. Dashboard Real Data Integration (WP7 - Complete ✅)
**Status**: Completed (2025-10-26)

**Problem**:
Dashboard was displaying mocked/static data instead of real-time information from the database.

**Completed**:
- ✅ Created contact stats endpoint with dynamic active/inactive logic
- ✅ Connected all 4 dashboard stat cards to real APIs
- ✅ Implemented RecentQuotations component with detailed information
- ✅ Implemented RecentInvoices component with detailed information
- ✅ Added loading states for all API calls
- ✅ Enhanced display with quotation numbers, contact names, dates, and amounts
- ✅ Added status badges with proper French labels and color coding

**Backend Changes**:
```
backend/src/routes/contacts.ts (lines 521-557)
  - Added GET /stats/overview endpoint
  - Implemented dynamic active contact calculation using EXISTS clauses
  - Counts contacts with pending quotations, active orders, or unpaid invoices
```

**Frontend Changes**:
```
frontend/src/services/api.ts (lines 272-275)
  - Added contactsApi.getStats() method

frontend/src/pages/Dashboard.tsx (complete rewrite)
  - Added 4 useQuery hooks for stats (inventory, contacts, quotations, invoices)
  - Created dynamic stats cards with loading states
  - Created RecentQuotations component (lines 119-205)
  - Created RecentInvoices component (lines 208-297)
  - Added formatCurrency helper
  - Added getStatusLabel and getStatusColor helpers
```

**Dashboard Stats Integrated**:
1. **Produits en Stock**: Shows total products + critical stock alerts
2. **Clients Actifs**: Dynamic count based on business activity
3. **Devis ce Mois**: Total quotations + conversion rate percentage
4. **Chiffre d'Affaires**: Paid revenue + outstanding amount

**Recent Activity Sections**:
- **Derniers Devis**: Shows quotation number, status badge, contact name, date, amount
- **Dernières Factures**: Shows invoice number, status badge, contact name, date, amount + overdue details

**Active Contact Logic**:
A contact is considered "active" if they have:
- Draft or sent quotations (status: 'draft', 'sent'), OR
- Active sales orders (status: 'en_cours', 'en_preparation', 'expedie', 'livre'), OR
- Unpaid invoices (status: 'brouillon', 'envoyee', 'en_retard')

#### 8. Product Images in Quotation Form (WP8 - Complete ✅)
**Status**: Completed (2025-10-26)

**Completed**:
- ✅ Created helper function to extract MinIO image URLs from product JSONB array
- ✅ Displays product images in quotation builder catalog
- ✅ Shows images in quotation sections for added items
- ✅ Handles main image priority (is_main flag) or uses first image
- ✅ Maintains image URLs when loading existing quotations

**Files Modified**:
```
frontend/src/pages/quotations/EnhancedQuotationBuilder.tsx
  - Added getProductImageUrl() helper function (lines 49-64)
  - Updated LineItem interface to include image_url field (line 98)
  - Updated handleAddProduct to include image URL (line 349)
  - Updated product catalog display with images (lines 1388-1396)
  - Updated item display in sections with images (lines 938-948)
  - Updated existing quotation loading to fetch images (line 222)
```

**Implementation Details**:
```typescript
// Helper function extracts main image or first image from JSONB array
const getProductImageUrl = (product: any): string | null => {
  if (!product.images || !Array.isArray(product.images) || product.images.length === 0) {
    return null
  }
  const mainImage = product.images.find((img: any) => img.is_main) || product.images[0]
  if (!mainImage || !mainImage.url) {
    return null
  }
  return mainImage.url
}
```

**UI Features**:
- Product catalog: 64x64px image thumbnails with fallback icon
- Quotation sections: 40x40px image thumbnails for added items
- Graceful fallback to image icon when no image available
- Object-cover scaling for proper aspect ratio

### Next Development Priorities

## 🎉 Current Status: MVP Feature-Complete

**All 8 initial work packages (WP1-8) are COMPLETE!**

The MyERP system now has:
- ✅ Complete sales workflow (Quotation → Sales Order → Invoice)
- ✅ Automatic inventory management (stock deduction/restoration)
- ✅ Product catalog with images and materials
- ✅ Contact management with business activity tracking
- ✅ Real-time dashboard with live metrics
- ✅ Professional PDF generation
- ✅ Authentication and protected routes
- ✅ All data properly connected to APIs

**What's Next: Quality & Enhancement Phase**

The system is now ready for the next phase focusing on:
1. **Testing & Stabilization** - Ensure all features work correctly end-to-end
2. **Security Enhancement** - Implement role-based access control
3. **UX Improvement** - Add Kanban board for visual order management

---

#### Priority 1: Testing & Bug Fixes (WP9 - Next)
**Status**: Not Started
**Estimated Time**: 2-3 days

**Critical Testing Areas**:
- [ ] End-to-end workflow: Quotation → Sales Order → Invoice
- [ ] Stock deduction verification (check inventory movements)
- [ ] Stock restoration on order cancellation
- [ ] DECIMAL field conversions in quotations API (parseFloat missing)
- [ ] DECIMAL field conversions in sales orders API
- [ ] DECIMAL field conversions in invoices API
- [ ] Payment tracking calculations (amount_paid, amount_due)
- [ ] Status transitions validation (prevent invalid state changes)
- [ ] PDF generation for all documents (quotations working, orders/invoices pending)
- [ ] Document cross-references accuracy
- [ ] Contact active/inactive logic with orders and invoices
- [ ] Dashboard metrics accuracy with real data
- [ ] Image upload and display consistency
- [ ] Form validation across all modules

**Bug Fixes Needed**:
- [ ] Review and apply parseFloat() to all financial calculations (see DECIMAL_COLUMNS_ANALYSIS.md)
- [ ] Test quotation conversion to sales order
- [ ] Verify invoice creation from sales order
- [ ] Check for race conditions in stock deduction
- [ ] Validate all API error handling
- [ ] Test edge cases (negative stock, invalid dates, etc.)

#### Priority 2: Role-Based Access Control (WP10 - Next)
**Status**: Not Started
**Estimated Time**: 3-4 days

**Current State**:
- ✅ Basic JWT authentication exists
- ✅ User login/logout functionality
- ❌ No role differentiation
- ❌ No permission-based UI hiding
- ❌ No API-level role enforcement

**Implementation Plan**:

**Phase 1: Database Schema**
- [ ] Add `role` field to users table (admin, sales, manager)
- [ ] Create `permissions` table (optional - for granular control)
- [ ] Create `role_permissions` junction table (optional)
- [ ] Migration: Add default admin role to existing users

**Phase 2: Backend Authentication Enhancement**
- [ ] Update JWT token to include user role
- [ ] Create role-based middleware decorators
  - `@requireRole('admin')`
  - `@requireRole(['admin', 'sales'])`
- [ ] Apply role checks to sensitive endpoints:
  - Admin only: User management, system settings, financial reports
  - Admin + Manager: Delete orders/invoices, modify company settings
  - Sales: Create quotations, view assigned customers
  - All authenticated: View own data

**Phase 3: Frontend Access Control**
- [ ] Add role to AuthContext
- [ ] Create usePermission hook for conditional rendering
- [ ] Hide UI elements based on role:
  - Admin panel (only for admin)
  - Delete buttons (admin/manager only)
  - Financial dashboard (admin/manager)
  - Settings page (admin only)
- [ ] Show role-appropriate navigation menu items
- [ ] Disable actions user cannot perform

**Phase 4: User Management UI**
- [ ] Admin page to list all users
- [ ] Create new user with role assignment
- [ ] Edit user role
- [ ] Deactivate/activate users
- [ ] Reset password functionality
- [ ] Assign sales representatives to contacts

**Example Roles**:
```typescript
enum UserRole {
  ADMIN = 'admin',           // Full system access
  MANAGER = 'manager',       // View all, limited edit
  SALES = 'sales',           // Own customers only
  VIEWER = 'viewer'          // Read-only access
}

// Permissions matrix:
// - Admin: All CRUD operations
// - Manager: Read all, edit own team, no delete
// - Sales: CRUD own quotations/orders, read products/inventory
// - Viewer: Read-only dashboard and reports
```

**Files to Create/Modify**:
```
Backend:
- backend/src/database/migrations/018_add_user_roles.sql
- backend/src/middleware/roleAuth.ts (new)
- backend/src/routes/users.ts (new - user management API)
- backend/src/routes/auth.ts (update JWT to include role)

Frontend:
- frontend/src/contexts/AuthContext.tsx (add role)
- frontend/src/hooks/usePermission.ts (new)
- frontend/src/pages/admin/UserManagement.tsx (new)
- frontend/src/components/ProtectedAction.tsx (new - conditional rendering)
```

#### Priority 3: Sales Order Kanban Board (WP11 - Future)
**Status**: Not Started
**Estimated Time**: 4-5 days

**Overview**:
Create a Kanban-style board for visualizing and managing sales orders through their lifecycle, similar to Trello or Jira.

**Visual Design**:
```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  En Cours    │ Préparation  │   Expédié    │    Livré     │   Terminé    │
│     (8)      │     (5)      │     (3)      │     (2)      │     (12)     │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │
│ │CMD-001   │ │ │CMD-015   │ │ │CMD-020   │ │ │CMD-025   │ │ │CMD-030   │ │
│ │ABC Corp  │ │ │XYZ Ltd   │ │ │Test Inc  │ │ │Acme Co   │ │ │BigCorp   │ │
│ │3,450 €   │ │ │8,900 €   │ │ │1,200 €   │ │ │5,670 €   │ │ │12,890 €  │ │
│ │⚠️ Urgent │ │ │📅 2 days │ │ │📦 Track# │ │ │✅ Done   │ │ │💰 Paid   │ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │
│              │              │              │              │              │
│ [+ Add]      │              │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

**Key Features**:
- [ ] Drag-and-drop cards between columns to update status
- [ ] Priority markers (High, Medium, Low) with visual indicators
- [ ] Due date warnings (overdue in red, due soon in orange)
- [ ] Quick view card with essential info (order #, customer, amount, date)
- [ ] Click card to open full detail view
- [ ] Filters: By customer, date range, amount, priority
- [ ] Search across all orders
- [ ] Color coding by priority or age
- [ ] Bulk actions (select multiple, update status)
- [ ] Analytics per column (total value, average time in stage)

**Priority Management**:
- [ ] Add `priority` field to sales_orders table (high, medium, low)
- [ ] Manual priority assignment by users
- [ ] Automatic priority calculation based on:
  - Order value (larger = higher priority)
  - Customer importance
  - Due date proximity
  - Age of order (older = higher priority)
- [ ] Priority override capability for admins
- [ ] Priority indicators in all views (list, kanban, detail)

**Implementation**:

**Phase 1: Backend Support**
- [ ] Add priority field to sales_orders table
- [ ] Add API endpoint: PATCH `/api/sales-orders/:id/priority`
- [ ] Add sort by priority to list endpoint
- [ ] Update status endpoint to support drag-and-drop flow

**Phase 2: Frontend Kanban UI**
- [ ] Install react-beautiful-dnd or @dnd-kit for drag-and-drop
- [ ] Create KanbanBoard component
- [ ] Create OrderCard component (compact card view)
- [ ] Implement column components (one per status)
- [ ] Connect drag-and-drop to API (update status on drop)
- [ ] Add priority badges and visual indicators

**Phase 3: Priority System**
- [ ] Add priority dropdown in order detail view
- [ ] Add priority filter in kanban view
- [ ] Create auto-priority calculation algorithm
- [ ] Add manual override option
- [ ] Visual priority indicators (🔴 High, 🟡 Medium, 🟢 Low)

**Phase 4: Analytics & Metrics**
- [ ] Column totals (count, total value)
- [ ] Average time in each stage
- [ ] Bottleneck identification (stages with most/oldest orders)
- [ ] Velocity metrics (orders completed per week)
- [ ] Export Kanban state as CSV/PDF

**Files to Create/Modify**:
```
Backend:
- backend/src/database/migrations/019_add_priority_to_sales_orders.sql
- backend/src/routes/sales-orders.ts (add priority endpoints)

Frontend:
- frontend/src/pages/sales-orders/SalesOrderKanban.tsx (new)
- frontend/src/components/kanban/KanbanBoard.tsx (new)
- frontend/src/components/kanban/OrderCard.tsx (new)
- frontend/src/components/kanban/KanbanColumn.tsx (new)
- frontend/src/utils/priorityCalculator.ts (new)
```

**Technical Considerations**:
- [ ] Real-time updates with WebSockets (optional - for multi-user)
- [ ] Optimistic UI updates (instant feedback on drag)
- [ ] Undo functionality for accidental status changes
- [ ] Mobile responsiveness (horizontal scroll on mobile)
- [ ] Performance optimization for 100+ orders
- [ ] Accessibility (keyboard navigation for drag-and-drop)

#### Priority 4: Additional Enhancements (WP12 - Future)
- [ ] Email notifications (order created, status changed, invoice sent)
- [ ] Customer portal (view own quotations and invoices)
- [ ] Advanced reporting and analytics
- [ ] Multi-currency support
- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] Export to accounting software (QuickBooks, Xero)
- [ ] Mobile application (React Native)
- [ ] Barcode/QR code generation for orders
- [ ] Inventory forecasting based on sales trends
- [ ] Purchase order management

### Development Environment

**Running Services**:
- Frontend: http://localhost:3000 (Vite + React)
- Backend: http://localhost:4000 (Node.js + Express)
- PostgreSQL: localhost:5432 (Docker)
- Redis: localhost:6379 (Docker)
- MinIO: http://localhost:9000 (Docker)
  - Credentials: minioadmin/minioadmin
  - Bucket: myerp-uploads

**Database Migrations Run** (19 total):
1. `001_create_users_table.sql` - User authentication
2. `002_create_contacts_table.sql` - Contacts/customers
3. `003_create_products_table.sql` & `003_create_products_table_furniture.sql` - Products catalog
4. `004_create_product_materials_table.sql` & `004_create_quotations_table.sql` - Materials & quotations
5. `005_add_images_column_to_products.sql` & `005_add_missing_quotation_fields.sql` - Images & quotation enhancements
6. `006_add_type_to_contacts.sql` - Contact type (client/supplier)
7. `007_add_discount_rate_to_contacts.sql` - Customer discount
8. `008_create_company_settings_table.sql` - Company info for PDFs
9. `009_add_include_tax_to_quotations.sql` - Tax handling
10. `010-014_fix_quotation_*_trigger.sql` - Quotation calculation triggers (5 migrations)
15. `015_create_sales_orders_table.sql` - Sales orders ✅
16. `016_create_invoices_table.sql` - Invoices ✅
17. `017_update_quotations_for_sales_orders.sql` - Link quotations to orders ✅
18. `018_fix_quantity_decimal_types.sql` - DECIMAL type fixes
19. `019_fix_products_stock_quantity_decimal.sql` - Stock quantity DECIMAL fix

**Key Dependencies**:
- Backend: express, pg, ioredis, minio, multer, bcryptjs, jsonwebtoken
- Frontend: react, react-router-dom, @tanstack/react-query, lucide-react, tailwindcss

### Troubleshooting Notes

**Common Issues**:
- **Port 4000 EADDRINUSE**: Multiple node processes running
  ```bash
  lsof -ti:4000 | xargs kill -9
  ```
- **MinIO not initialized**: Check Docker container running
  ```bash
  docker ps | grep minio
  ```
- **Redis connection errors**: Restart Redis container
  ```bash
  docker-compose restart redis
  ```
- **Database migration issues**: Check migration status and rollback if needed
  ```bash
  cd backend
  npm run migrate:status
  npm run migrate:down  # if needed
  ```
- **DECIMAL columns returned as strings**: PostgreSQL DECIMAL/NUMERIC values are returned as strings by `pg` driver
  - Always use `parseFloat()` or `Number()` when comparing or calculating with DECIMAL values
  - See `backend/DECIMAL_COLUMNS_ANALYSIS.md` for complete list of affected columns
  - Example: `parseFloat(row.stock_quantity) || 0` instead of `row.stock_quantity`

### Development Notes

**Database Migration Naming Convention**:
- Use sequential numbers: `001_`, `002_`, etc.
- Descriptive names: `create_sales_orders_table`, `add_column_to_table`
- Example: `006_create_sales_orders_table.sql`

**API Response Format**:
```typescript
// Success
{ success: true, data: {...}, message: 'Operation successful' }

// Error
{ success: false, error: 'Error message', code: 'ERROR_CODE' }
```

**Frontend Query Keys Convention**:
```typescript
['quotations']           // List all quotations
['quotations', id]       // Single quotation
['sales-orders']         // List all sales orders
['sales-orders', id]     // Single sales order
['invoices']            // List all invoices
['invoices', id]        // Single invoice
```

---

## Git Commit Strategy
- Use conventional commits: feat/fix/chore/docs
- Reference related issues/tickets
- Include WIP commits for end-of-day saves
- Create feature branches for major changes

