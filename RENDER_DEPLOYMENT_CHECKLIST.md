# 🚀 Render Deployment Checklist

## Issues Found & Fixed

### 1. ✅ Email Service Configuration
- **Problem**: Email service was failing because ZeptoMail credentials might be missing
- **Fix**: Added validation and graceful error handling in `emailService.js`
- **Status**: Fixed ✅

### 2. ⚠️ API Not Accessible on Render
- **Possible Causes**:
  - Missing environment variables
  - Database connection issues
  - Port configuration

---

## 📋 Required Environment Variables for Render

Add these in your Render Dashboard → Your Service → Environment:

### **Database Configuration**
```
DATABASE_URL=your_postgres_connection_string
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_HOST=your_database_host
DB_PORT=5432
```

### **Library Database (if separate)**
```
DATABASE_N=library_database_name
DATABASE_U=library_database_user
DATABASE_P=library_database_password
DATABASE_H=library_database_host
```

### **JWT & Security**
```
JWT_SECRET=your_jwt_secret_key_here
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
```

### **Email Configuration (ZeptoMail)**
```
ZEPTOMAIL_API_URL=https://api.zeptomail.com/v1.1
ZEPTOMAIL_TOKEN=your_zeptomail_api_token
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Pinnacle University
EMAIL_ENABLED=true
FRONTEND_URL=https://pinnacleuniversity.co
```

### **Redis Configuration**
- ✅ Already configured via `render.yaml` (REDIS_URL is auto-set)

### **Optional (if using)**
```
STREAM_API_KEY=your_stream_api_key
STREAM_SECRET=your_stream_secret
STREAM_DEFAULT_REGION=auto
SUPABASE_URL=your_supabase_url
SUPABASEKEY=your_supabase_key
```

---

## 🔍 Troubleshooting Steps

### **1. Check if API is Running**
```bash
# Test health endpoint
curl https://your-render-url.onrender.com/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-21T..."
}
```

### **2. Check Render Logs**
1. Go to Render Dashboard
2. Click on your service
3. Go to "Logs" tab
4. Look for:
   - ✅ `🚀 Server running on port XXXX`
   - ✅ `📊 Connected to both LMS and Library databases`
   - ❌ Any error messages

### **3. Verify Environment Variables**
1. Render Dashboard → Your Service → Environment
2. Ensure ALL required variables are set
3. Check for typos in variable names

### **4. Test Email Configuration**
After setting ZeptoMail credentials, test with:
```bash
POST https://your-render-url.onrender.com/api/auth/password/reset
Body: {
  "email": "test@example.com",
  "userType": "student"
}
```

Check email_logs table:
```sql
SELECT * FROM email_logs 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 5;
```

### **5. Database Connection Issues**
If database connection fails:
- Verify `DATABASE_URL` is correct
- Check if database allows connections from Render IPs
- Ensure SSL is enabled (already configured in code)

---

## 🧪 Testing Your Deployed API

### **Update Postman Base URL**
In your Postman environment, set:
```
base_url = https://your-render-service.onrender.com
```

### **Test Endpoints**
1. **Health Check**
   ```
   GET {{base_url}}/health
   ```

2. **Student Login**
   ```
   POST {{base_url}}/api/auth/login
   Body: {
     "email": "student@example.com",
     "password": "password123"
   }
   ```

3. **Password Reset**
   ```
   POST {{base_url}}/api/auth/password/reset-request
   Body: {
     "email": "student@example.com",
     "userType": "student"
   }
   ```

---

## 📝 Common Issues & Solutions

### **Issue: "Cannot connect to database"**
**Solution**: 
- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/dbname`
- Check database firewall settings
- Ensure SSL is enabled

### **Issue: "Email sending failed"**
**Solution**:
- Verify `ZEPTOMAIL_API_URL` and `ZEPTOMAIL_TOKEN` are set
- Check ZeptoMail dashboard for API token validity
- Verify `EMAIL_FROM_ADDRESS` is verified in ZeptoMail

### **Issue: "CORS error"**
**Solution**:
- Already configured in `app.js` with `cors()`
- If still issues, check frontend URL in CORS config

### **Issue: "Port already in use"**
**Solution**:
- Render automatically sets `PORT` environment variable
- Don't hardcode port in code (already using `process.env.PORT`)

---

## ✅ Verification Checklist

Before testing, ensure:
- [ ] All environment variables are set in Render
- [ ] Database is accessible from Render
- [ ] Redis service is running (if using)
- [ ] ZeptoMail credentials are valid
- [ ] Health endpoint returns success
- [ ] Logs show no critical errors

---

## 🔗 Useful Links

- Render Dashboard: https://dashboard.render.com
- Render Docs: https://render.com/docs
- ZeptoMail Docs: https://www.zeptomail.com/docs

---

## 📞 Need Help?

If issues persist:
1. Check Render service logs
2. Verify all environment variables
3. Test database connection separately
4. Check email_logs table for detailed error messages

