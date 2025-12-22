# Admin Panel Access

## How to Access

1. Go to the landing page (homepage at `/`)
2. Click on the **DCCO logo** in the **bottom right corner**
3. Login with the credentials below

## Default Credentials

**Username:** `admin`  
**Password:** `dcco2024`

## Changing Credentials

To change the admin username or password, edit `/app/backend/.env`:

```bash
ADMIN_USERNAME=your_new_username
ADMIN_PASSWORD=your_new_password
```

After changing, restart the backend:
```bash
sudo supervisorctl restart backend
```

## Features

The admin panel allows you to:

- **View all uploaded cases** with their data counts
- **Delete specific cases** (contacts, passwords, accounts, images)
- **See suspect names and devices** for each case
- **View data statistics** (total records per case)

## Security Notes

- Credentials are stored in `.env` file (not version controlled)
- Simple authentication for internal tool use
- No session management - login required each time
- Deletion requires confirmation dialog
- All deletions are permanent and cannot be undone

## What Gets Deleted

When you delete a case, the following are permanently removed:
- All contacts for that case
- All passwords for that case
- All user accounts for that case
- All suspect profiles for that case
- All images in `/app/uploads/[CaseNumber]/` folder
- All WhatsApp groups associated with that case

## Database Location

Database: MongoDB at `localhost:27017`  
Database name: `test_database`  
Collections: `contacts`, `passwords`, `user_accounts`, `suspect_profiles`
