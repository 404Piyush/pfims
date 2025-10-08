# PFIMS VPS Deployment Guide

## Security Audit Summary

### ✅ Backend Security Assessment
- **Authentication**: JWT-based with proper token validation
- **Password Security**: bcrypt with configurable rounds (default: 12)
- **Rate Limiting**: Implemented with express-rate-limit
- **Input Validation**: express-validator used throughout
- **CORS**: Properly configured with environment-based origins
- **Helmet**: Security headers implemented
- **Database**: MongoDB with proper connection handling
- **Error Handling**: Secure error responses (no stack traces in production)

### ✅ Frontend Security Assessment
- **API Communication**: Axios with proper interceptors
- **Token Storage**: localStorage (consider httpOnly cookies for enhanced security)
- **Environment Variables**: Properly configured with fallbacks
- **No Dangerous Functions**: No eval(), innerHTML, or similar vulnerabilities
- **Console Logs**: Present but only for debugging (should be removed in production)

## Pre-Deployment Checklist

### 1. Environment Configuration

#### Backend (.env)
```bash
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/pfims_prod

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_here_min_32_chars
JWT_EXPIRE=30d

# Email Configuration
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your_email@domain.com
EMAIL_PASS=your_app_password

# Client URL
CLIENT_URL=https://your-domain.com

# Security
BCRYPT_ROUNDS=12
```

#### Frontend (.env)
```bash
REACT_APP_API_URL=https://your-api-domain.com/api
GENERATE_SOURCEMAP=false
```

### 2. Security Hardening

#### Backend Security
1. **Generate Strong JWT Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Database Security**:
   - Enable MongoDB authentication
   - Use connection string with credentials
   - Enable SSL/TLS for database connections

3. **Server Security**:
   - Use HTTPS (SSL/TLS certificates)
   - Configure firewall (only allow necessary ports)
   - Regular security updates

#### Frontend Security
1. **Remove Console Logs**:
   - Remove all console.log statements from production build
   - Consider using a build-time log removal tool

2. **Content Security Policy**:
   Add to `public/index.html`:
   ```html
   <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;">
   ```

### 3. Production Optimizations

#### Backend
1. **Process Management**: Use PM2 or similar
2. **Logging**: Implement proper logging (Winston, Morgan)
3. **Monitoring**: Set up health checks and monitoring
4. **Backup**: Automated database backups

#### Frontend
1. **Build Optimization**: `npm run build`
2. **Static File Serving**: Use nginx or similar
3. **Caching**: Implement proper caching headers
4. **Compression**: Enable gzip compression

### 4. VPS Setup Steps

#### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install nginx
sudo apt install nginx -y

# Install PM2
sudo npm install -g pm2
```

#### 2. Application Deployment
```bash
# Clone repository
git clone <your-repo-url>
cd pfims

# Backend setup
cd backend
npm install --production
cp .env.example .env
# Edit .env with production values

# Frontend setup
cd ../frontend
npm install
npm run build

# Start backend with PM2
cd ../backend
pm2 start server.js --name "pfims-backend"
pm2 save
pm2 startup
```

#### 3. Nginx Configuration
Create `/etc/nginx/sites-available/pfims`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/pfims/frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/pfims /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### 5. Monitoring and Maintenance

#### Health Checks
- Backend: `GET /api/health`
- Database connectivity
- Disk space monitoring
- Memory usage monitoring

#### Backup Strategy
```bash
# MongoDB backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db pfims_prod --out /backups/mongodb_$DATE
```

#### Log Management
```bash
# PM2 logs
pm2 logs pfims-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 6. Security Recommendations

1. **Firewall Configuration**:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

2. **Regular Updates**:
   - Keep system packages updated
   - Update Node.js dependencies regularly
   - Monitor security advisories

3. **Access Control**:
   - Use SSH keys instead of passwords
   - Implement fail2ban for brute force protection
   - Regular security audits

4. **Database Security**:
   - Enable MongoDB authentication
   - Use strong passwords
   - Regular backups
   - Network isolation

### 7. Performance Optimization

1. **Frontend**:
   - Enable gzip compression
   - Set proper cache headers
   - Use CDN for static assets

2. **Backend**:
   - Database indexing
   - Connection pooling
   - Response caching where appropriate

3. **Server**:
   - Optimize server resources
   - Monitor performance metrics
   - Scale horizontally if needed

## Troubleshooting

### Common Issues
1. **CORS Errors**: Check CLIENT_URL in backend .env
2. **Database Connection**: Verify MongoDB is running and accessible
3. **JWT Errors**: Ensure JWT_SECRET is set and consistent
4. **File Permissions**: Check file ownership and permissions

### Logs to Check
- PM2 logs: `pm2 logs`
- Nginx logs: `/var/log/nginx/`
- MongoDB logs: `/var/log/mongodb/`
- System logs: `journalctl -u nginx`

## Post-Deployment Verification

1. **Frontend**: Access your domain and verify UI loads
2. **Backend**: Test API endpoints via `/api/health`
3. **Authentication**: Test login/register functionality
4. **Database**: Verify data persistence
5. **SSL**: Check certificate validity
6. **Performance**: Run performance tests

## Maintenance Schedule

- **Daily**: Monitor logs and system resources
- **Weekly**: Check for security updates
- **Monthly**: Database backup verification
- **Quarterly**: Security audit and dependency updates