# MyERP - Sales Order Management System

A modern, scalable ERP system for managing sales operations, built with Node.js, React, PostgreSQL, and Docker.

## Features

- **Contact Management**: Comprehensive CRM functionality for managing customers
- **Inventory Control**: Real-time stock tracking with low stock alerts
- **Quotation System**: Professional quotation creation with PDF generation
- **Sales Orders**: Complete order lifecycle management
- **Dashboard & Analytics**: Real-time business intelligence and KPIs
- **Multi-user Support**: Role-based access control (Admin/Sales)
- **File Management**: Integrated file storage with MinIO
- **Email Integration**: Automated notifications and communications
- **Backup & Recovery**: Automated backup with retention policies

## Quick Start

### Prerequisites

- Docker & Docker Compose (v2.0+)
- Node.js 18+ (for local development)
- Git
- Make (optional, for using Makefile commands)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd myerp_app
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the application:
```bash
# Using Make
make up

# Or using Docker Compose directly
docker-compose up -d
```

4. Initialize the database:
```bash
# Run migrations
make migrate

# Seed sample data (optional)
make seed
```

5. Access the application:
- Frontend: http://localhost:3000
- API: http://localhost:4000
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
- Grafana: http://localhost:3001 (admin/admin)
- Mailhog: http://localhost:8025

## Project Structure

```
myerp_app/
├── backend/               # Node.js backend API
│   ├── src/
│   │   ├── controllers/   # Request handlers
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Helper functions
│   └── tests/             # Test suites
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── contexts/      # React contexts
│   └── public/            # Static assets
├── database/              # Database scripts
│   ├── migrations/        # Schema migrations
│   ├── seeds/             # Seed data
│   └── functions/         # SQL functions
├── docker/                # Docker configurations
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

## Development

### Local Development

1. Install dependencies:
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

2. Start development servers:
```bash
# Backend (with hot reload)
cd backend && npm run dev

# Frontend (with hot reload)
cd frontend && npm start
```

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

### Database Management

```bash
# Create new migration
make migration name=add_new_column

# Run migrations
make migrate

# Rollback migration
make migrate-down

# Reset database
make db-reset
```

### Using Make Commands

```bash
make help          # Show all available commands
make up            # Start all services
make down          # Stop all services
make logs          # View logs
make shell-backend # Access backend container
make db-backup     # Create database backup
make clean         # Clean up containers and volumes
```

## API Documentation

API documentation is available at http://localhost:4000/api-docs when running in development mode.

### Authentication

All API endpoints except login require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

- `POST /api/auth/login` - User login
- `GET /api/contacts` - List contacts
- `GET /api/products` - List products
- `POST /api/quotations` - Create quotation
- `GET /api/dashboard/summary` - Dashboard data

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `MINIO_ACCESS_KEY` - MinIO access credentials
- `SMTP_*` - Email configuration

### Docker Services

The application uses the following Docker services:

- **postgres**: PostgreSQL database
- **redis**: Caching and session storage
- **minio**: File storage
- **backend**: Node.js API server
- **frontend**: React application
- **nginx**: Reverse proxy
- **prometheus**: Metrics collection
- **grafana**: Metrics visualization
- **mailhog**: Email testing (development)

## Deployment

### Production Deployment

1. Update production environment variables
2. Build production images:
```bash
docker-compose -f docker-compose.prod.yml build
```

3. Deploy:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Scaling

```bash
# Scale backend API
docker-compose up -d --scale backend=3

# Using Docker Swarm
docker stack deploy -c docker-compose.prod.yml myerp
```

## Monitoring

### Health Checks

- API Health: http://localhost:4000/health
- Database: `make db-health`
- All services: `make health-check`

### Metrics

Access Grafana at http://localhost:3001 for:
- System metrics
- Application performance
- Business KPIs
- Custom dashboards

## Backup & Recovery

### Automated Backups

Backups run daily at 2 AM by default. Configure in `.env`:

```env
BACKUP_SCHEDULE="0 2 * * *"
BACKUP_RETENTION_DAYS=30
```

### Manual Backup

```bash
# Database backup
make db-backup

# Full system backup
make backup-all

# Restore from backup
make restore file=backup-20240101.sql
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 4000, 5432, 6379, 9000 are available
2. **Database connection**: Check DATABASE_URL in .env
3. **File uploads**: Verify MinIO is running and configured
4. **Email delivery**: Check SMTP settings or use Mailhog for testing

### Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend -f

# Check error logs
make logs-error
```

### Reset Environment

```bash
# Complete reset (WARNING: Deletes all data)
make clean
make up
make migrate
make seed
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Code Style

- Backend: ESLint + Prettier
- Frontend: ESLint + Prettier
- Git hooks: Husky for pre-commit checks

## Security

### Reporting Security Issues

Please report security vulnerabilities to security@myerp.com

### Security Features

- JWT authentication
- Role-based access control
- Input validation
- SQL injection prevention
- XSS protection
- Rate limiting
- Audit logging

## License

Proprietary - All rights reserved

## Support

- Documentation: See `/docs` folder
- Issues: GitHub Issues
- Email: support@myerp.com

## Roadmap

- [ ] Multi-language support
- [ ] Mobile application
- [ ] Advanced reporting
- [ ] Customer portal
- [ ] AI-powered insights
- [ ] Accounting module
- [ ] Multi-company support

## Credits

Built with modern technologies including:
- Node.js & Express
- React & TypeScript
- PostgreSQL
- Docker
- MinIO
- Redis

---

For detailed documentation, see [claude.md](./claude.md)