#!/bin/bash

# SSL Certificate Setup Script
# Uses Let's Encrypt with Certbot

set -e

echo "🔒 SSL Certificate Setup"
echo "======================="

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup-ssl.sh yourdomain.com"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-"admin@$DOMAIN"}

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Create dummy certificate for nginx to start
echo "Creating dummy certificate..."
mkdir -p nginx/ssl
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout nginx/ssl/privkey.pem \
    -out nginx/ssl/fullchain.pem \
    -subj "/CN=$DOMAIN"

echo ""
echo "Starting nginx..."
docker-compose -f docker-compose.production.yml up -d nginx

echo ""
echo "Waiting for nginx to be ready..."
sleep 5

echo ""
echo "Requesting Let's Encrypt certificate..."
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Certificate obtained successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update nginx/nginx.conf to use the SSL configuration"
    echo "2. Replace 'yourdomain.com' with '$DOMAIN' in the HTTPS server block"
    echo "3. Uncomment the HTTPS server block"
    echo "4. Comment out or modify the HTTP server block to redirect to HTTPS"
    echo "5. Restart nginx: docker-compose -f docker-compose.production.yml restart nginx"
else
    echo "❌ Failed to obtain certificate"
    echo "Please check your domain DNS settings and try again"
    exit 1
fi

