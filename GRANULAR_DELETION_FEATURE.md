# Granular Upload Deletion Feature

**Date**: December 22, 2024  
**Feature**: Delete specific uploads when multiple uploads exist for same case/suspect/device combination

---

## 🎯 Problem Solved

Previously, if you uploaded the same suspect's data multiple times (e.g., uploading a new phone dump for "Mogos Denis" with "Samsung SM-A536B" multiple times), the admin panel could only delete **ALL** uploads together. You couldn't delete just one specific upload.

**Now**: You can delete individual uploads precisely, even when they share the same case number, suspect name, and device.

---

## 🔧 Technical Implementation

### 1. Added `upload_session_id` Field

Every upload now gets a unique identifier that's added to all records:

**Models Updated**:
- `Contact` - Added `upload_session_id: Optional[str]`
- `Password` - Added `upload_session_id: Optional[str]`
- `UserAccount` - Added `upload_session_id: Optional[str]`
- `SuspectProfile` - Added `upload_session_id: Optional[str]`

### 2. Upload Process Enhanced

When you upload a ZIP file:
```python
# Generate unique session ID
upload_session_id = str(uuid.uuid4())

# Example: "a3f2e1d4-5c6b-7a8e-9f0a-1b2c3d4e5f6g"
```

This ID is automatically added to:
- All contacts extracted from the ZIP
- All passwords extracted from the ZIP  
- All user accounts extracted from the ZIP
- The suspect profile created

### 3. Precise Deletion

**Backend Endpoint**: `/api/admin/sessions/by-profile/{profile_id}`

**Deletion Logic**:
```python
# If upload has session ID (new uploads)
DELETE FROM contacts WHERE upload_session_id = "abc-123"
DELETE FROM passwords WHERE upload_session_id = "abc-123"
DELETE FROM user_accounts WHERE upload_session_id = "abc-123"

# If no session ID (old uploads before this feature)
DELETE FROM contacts WHERE case = X AND person = Y AND device = Z
# (Fallback - deletes all uploads for this combination)
```

### 4. Smart Image Folder Management

When deleting an upload:
- Check if other uploads still exist for same case/person/device
- If YES: Keep the images folder (other uploads need it)
- If NO: Delete the images folder

---

## 📊 Admin Panel Changes

The admin panel UI remains the same - no changes needed! It already:
- Shows individual upload sessions
- Displays upload timestamp
- Has delete button for each session

**What Changed Internally**:
- Now counts records using `upload_session_id` (precise)
- Deletion removes only specific upload, not all uploads

---

## 🔄 Backward Compatibility

**Old Uploads** (before this feature):
- Don't have `upload_session_id` field
- Deletion still works but uses old behavior
- Deletes ALL uploads for that case/person/device combination

**New Uploads** (after this feature):
- Have unique `upload_session_id`
- Deletion is precise - only removes specific upload
- Safe to upload same person/device multiple times

---

## 📝 Usage Example

### Scenario:
You upload "Mogos Denis" phone data 3 times:
1. December 1, 2024 - Initial investigation
2. December 10, 2024 - Updated phone dump
3. December 20, 2024 - Final investigation

### Admin Panel View:
```
Case: 2025/19/P/2025
├─ Mogos Denis • Samsung SM-A536B • Dec 1, 2024 10:00 AM
│  └─ 500 contacts, 200 passwords, 30 accounts [Delete]
│
├─ Mogos Denis • Samsung SM-A536B • Dec 10, 2024 2:30 PM  
│  └─ 550 contacts, 250 passwords, 35 accounts [Delete]
│
└─ Mogos Denis • Samsung SM-A536B • Dec 20, 2024 9:00 AM
   └─ 600 contacts, 300 passwords, 40 accounts [Delete]
```

### What Happens When You Delete December 10 Upload:
✅ **DELETED**:
- 550 contacts from Dec 10 upload
- 250 passwords from Dec 10 upload  
- 35 user accounts from Dec 10 upload
- Suspect profile for Dec 10 upload

✅ **PRESERVED**:
- Dec 1 upload data (500 contacts, 200 passwords, 30 accounts)
- Dec 20 upload data (600 contacts, 300 passwords, 40 accounts)
- Images folder (still used by other uploads)

---

## 🧪 Testing

### Test the Feature:
1. Upload the same suspect's data twice
2. Open Admin Panel (click DCCO logo)
3. Expand the case - you should see 2 separate sessions
4. Delete one session
5. Verify only that session's data was removed
6. Refresh main app - other session's data still visible

### Verify Precise Deletion:
```bash
# Before deletion
curl http://localhost:8001/api/admin/cases | jq '.[] | .sessions | length'
# Should show 2 sessions

# Delete one session via UI

# After deletion  
curl http://localhost:8001/api/admin/cases | jq '.[] | .sessions | length'
# Should show 1 session
```

---

## 🔍 Database Fields

### Example Contact Record (New Upload):
```json
{
  "id": "abc-123",
  "case_number": "2025/19/P/2025",
  "person_name": "Mogos Denis",
  "device_info": "Samsung SM-A536B",
  "upload_session_id": "a3f2e1d4-5c6b-7a8e-9f0a-1b2c3d4e5f6g",  // ← NEW
  "name": "John Doe",
  "phone": "+40123456789",
  "created_at": "2024-12-22T10:00:00Z"
}
```

### Example Contact Record (Old Upload):
```json
{
  "id": "xyz-789",
  "case_number": "794/19/P/2025",
  "person_name": "Martinis Dragos",  
  "device_info": "Nothing A063",
  "upload_session_id": null,  // ← No session ID (old upload)
  "name": "Jane Smith",
  "phone": "+40987654321",
  "created_at": "2024-12-20T15:00:00Z"
}
```

---

## ⚠️ Important Notes

1. **Existing Data**: Old uploads don't have `upload_session_id` and will continue to work with old deletion behavior

2. **New Uploads**: All new uploads from now on will have precise deletion capability

3. **Migration**: No migration needed - system handles both old and new data automatically

4. **Performance**: No performance impact - session ID indexed for fast lookups

5. **Admin Panel**: No UI changes needed - already shows sessions separately

---

## 🚀 Next Steps

### Recommended Actions:

1. **Test with Real Data**:
   - Upload a ZIP file twice (same suspect, same device)
   - Verify admin panel shows 2 separate sessions
   - Delete one session
   - Confirm only that session was removed

2. **Monitor Logs**:
   ```bash
   # Watch deletion logs
   tail -f /var/log/supervisor/backend.err.log | grep "Deleting session"
   
   # Should see: "Deleting session ... (session: <uuid>)"
   ```

3. **Verify Counts**:
   - After deletion, check main app
   - Verify total counts decreased by deleted amount
   - Confirm other sessions' data still intact

---

## 📞 Support

If you encounter any issues:

1. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
2. Verify API response: `curl http://localhost:8001/api/admin/cases | jq`
3. Check database: `mongosh test_database --eval "db.contacts.findOne()"`

---

**Status**: ✅ Feature Complete and Ready for Testing

**Updated By**: AI Agent  
**Date**: December 22, 2024

---
