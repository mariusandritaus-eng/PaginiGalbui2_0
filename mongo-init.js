// MongoDB Initialization Script
// This script is run when MongoDB container starts for the first time

db = db.getSiblingDB('test_database');

// Create collections
db.createCollection('contacts');
db.createCollection('passwords');
db.createCollection('user_accounts');
db.createCollection('suspect_profiles');

// Create indexes for better performance
db.contacts.createIndex({ "phone_number": 1 });
db.contacts.createIndex({ "normalized_phone": 1 });
db.contacts.createIndex({ "case_number": 1 });
db.contacts.createIndex({ "person_name": 1 });

db.passwords.createIndex({ "account": 1 });
db.passwords.createIndex({ "case_number": 1 });
db.passwords.createIndex({ "category": 1 });

db.user_accounts.createIndex({ "email": 1 });
db.user_accounts.createIndex({ "username": 1 });
db.user_accounts.createIndex({ "case_number": 1 });

db.suspect_profiles.createIndex({ "case_number": 1 }, { unique: true });

print('Database initialized successfully!');
