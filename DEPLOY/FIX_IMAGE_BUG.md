# Fix for Double /api/api Image Path Bug

## Problem
Contact photos and suspect profile images show 404 errors with URLs like:
```
GET /api/api/images/xxx.jpg HTTP/1.1" 404 Not Found
```

The URL has a double `/api/api` prefix instead of single `/api`.

## Root Cause
The backend was returning image paths with `/api/images/xxx.jpg`, but the frontend already prepends `BACKEND_URL` (which is `/api`), resulting in `/api` + `/api/images/xxx.jpg` = `/api/api/images/xxx.jpg`.

## Fix Applied
Backend `server.py` has been updated to return image paths without the `/api` prefix:
- Line 911: Changed from `f"/api/images/{img_filename}"` to `f"/images/{img_filename}"`
- Line 1061: Changed from `f"/api/suspect-image/..."` to `f"/suspect-image/..."`

The frontend correctly adds `BACKEND_URL` (`/api`) when displaying images.

## How to Apply the Fix on Your Server

### Option 1: Use Git (If you have git access)
```bash
cd /app
git pull origin ubuntu-deploy
cd /app/DEPLOY
docker-compose build --no-cache backend
docker-compose restart backend
```

### Option 2: Manual Fix (If you cannot use git)
```bash
# SSH into your Ubuntu server
ssh user@192.168.1.138  # Or your server IP

# Edit the backend server file
cd /app/backend
nano server.py

# Find line 911 (around line 911):
# Change: contact_dict['photo_path'] = f"/api/images/{img_filename}"
# To:     contact_dict['photo_path'] = f"/images/{img_filename}"

# Find line 1061 (around line 1061):
# Change: me_jpg_path = f"/api/suspect-image/{case_number.replace('/', '_')}/{dest_filename}"
# To:     me_jpg_path = f"/suspect-image/{case_number.replace('/', '_')}/{dest_filename}"

# Save and exit (Ctrl+X, Y, Enter in nano)

# Rebuild and restart backend
cd /app/DEPLOY
docker-compose build --no-cache backend
docker-compose up -d backend

# Check logs to verify
docker-compose logs -f backend
```

### Option 3: Use the Automated Fix Script
```bash
cd /app/DEPLOY
chmod +x apply-image-fix.sh
./apply-image-fix.sh
```

## Verification
After applying the fix:

1. **Clear browser cache** or use Incognito mode
2. Upload a new forensic dump with contact photos
3. Check that images display correctly
4. Check backend logs for correct URLs:
   ```bash
   docker-compose logs backend | grep "GET /api/images"
   ```
   You should see:
   ```
   GET /api/images/xxx.jpg HTTP/1.1" 200 OK
   ```
   NOT:
   ```
   GET /api/api/images/xxx.jpg HTTP/1.1" 404 Not Found
   ```

## If Images Still Don't Show

1. **Clear old database data** (contains old image paths with double /api):
   ```bash
   # In the app UI, click "Clear Database" button in Dashboard tab
   # OR via API:
   curl -X DELETE http://localhost/api/clear-database
   ```

2. **Re-upload your forensic dumps** to get corrected image paths

3. **Hard refresh browser**: Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)

## Technical Details

### Backend API Routes
- `/api/images/{filename}` - Serves contact photos
- `/api/suspect-image/{case_number}/{filename}` - Serves suspect profile images

### Frontend Image Display
```javascript
// In App.js
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL; // = "/api"

// When displaying images:
<img src={`${BACKEND_URL}${contact.photo_path}`} />
// If photo_path = "/images/xxx.jpg"
// Result: src="/api/images/xxx.jpg" ✓ CORRECT
```

### Why This Bug Happened
During the dynamic IP fix, we switched from absolute URLs to relative paths:
- Old: `REACT_APP_BACKEND_URL=http://192.168.1.138:8001`
- New: `REACT_APP_BACKEND_URL=/api`

The backend code still had the old pattern of including the full API path in returned URLs, which worked fine with absolute URLs but caused double prefixes with relative paths.

## Related Files Changed
- `/app/backend/server.py` - Lines 911 and 1061
- This documentation file

## Deployment Branch
These fixes are in the `ubuntu-deploy` branch, ready for deployment.
