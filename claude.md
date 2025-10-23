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

### Version 1.0.0 (Current)
- Initial release
- Core modules: Contacts, Inventory, Quotations, Orders
- Basic dashboard and reporting
- Docker deployment support

### Roadmap
- v1.1: Purchase order management
- v1.2: Advanced reporting and analytics
- v1.3: Mobile application
- v1.4: Multi-language support
- v1.5: Accounting module integration
---

## Current Development Status (2025-10-24)

### Recent Changes & Implementation

#### 1. Product Image Upload System (WIP - In Progress)
**Status**: Partially working - Backend complete, Frontend issues remain

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

**Known Issues** (To Fix Tomorrow):
1. ❌ Images not persisting after save - UI doesn't update properly
2. ❌ Images don't reload when reopening product form
3. ❌ Toast notifications not appearing consistently
4. ❌ Gallery not refreshing after upload completes

**Files Modified**:
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

#### 2. Product Materials System
**Status**: Complete

- Product-Material-Finish relationship implemented
- Accordion UI for material entries
- Dynamic add/remove materials
- Supplier field persistence fixed

#### 3. Authentication & Routes Restructure
**Status**: Complete

- Simplified route structure
- JWT authentication middleware
- Auth routes: login, register, logout
- Protected API endpoints

### Work In Progress (WIP) for Tomorrow

#### Priority 1: Fix Image Upload UI Issues
**Problem**: Images upload to MinIO and save to DB, but UI doesn't reflect changes properly

**Debug Steps**:
1. Check React state updates in ProductForm
2. Verify query invalidation after image upload
3. Test image loading on form reopen
4. Check toast notification rendering
5. Verify gallery re-render triggers

**Potential Issues**:
- State not triggering re-renders
- Query cache not invalidating
- useEffect dependency array issues
- Component not receiving updated props

#### Priority 2: Product Management Improvements
- [ ] Test complete product creation workflow with images
- [ ] Verify image persistence across sessions
- [ ] Test image deletion
- [ ] Test main image selection
- [ ] Add image preview in product list view

#### Priority 3: Database & API Optimization
- [ ] Add proper error handling for MinIO operations
- [ ] Implement image size optimization before upload
- [ ] Add image CDN configuration for production
- [ ] Create database backup scripts

### Development Environment

**Running Services**:
- Frontend: http://localhost:3000 (Vite + React)
- Backend: http://localhost:4000 (Node.js + Express)
- PostgreSQL: localhost:5432 (Docker)
- Redis: localhost:6379 (Docker)
- MinIO: http://localhost:9000 (Docker)
  - Credentials: minioadmin/minioadmin
  - Bucket: myerp-uploads

**Database Migrations Run**:
1. `001_create_users_table.sql`
2. `002_create_categories_table.sql`
3. `003_create_products_table.sql`
4. `004_create_product_materials_table.sql`
5. `005_add_images_column_to_products.sql` ✅

**Key Dependencies**:
- Backend: express, pg, ioredis, minio, multer, bcryptjs, jsonwebtoken
- Frontend: react, react-router-dom, @tanstack/react-query, lucide-react, tailwindcss

### Troubleshooting Notes

**Image Upload Debug Log Pattern**:
```
handleFiles called with X files, productId: [uuid]
Adding X new images. Current images: Y
Starting uploads for X images
Uploading image: [imageId] productId: [uuid]
uploadToServer called for imageId: [imageId]
Upload complete, status: 200
Upload successful, image: {url: '...', filename: '...'}
Updated images: [{...}]
```

**Common Issues**:
- Port 4000 EADDRINUSE: Multiple node processes running - kill with `lsof -ti:4000 | xargs kill -9`
- MinIO not initialized: Check Docker container running with `docker ps | grep minio`
- Redis connection errors: Restart Redis container

### Next Session TODO
1. Debug why images array updates aren't triggering UI re-renders
2. Fix ProductForm state synchronization 
3. Test complete image upload workflow end-to-end
4. Add error boundaries for better error handling
5. Clean up console.log statements added for debugging
6. Add loading states during image operations
7. Implement optimistic UI updates for better UX

---

## Git Commit Strategy
- Use conventional commits: feat/fix/chore/docs
- Reference related issues/tickets
- Include WIP commits for end-of-day saves
- Create feature branches for major changes

