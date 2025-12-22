from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import traceback
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import zipfile
import io
import tempfile
import shutil
import base64
import csv
from pymongo import MongoClient
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging FIRST - before any functions that use it
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Phone normalization function
def normalize_phone(phone: str) -> str:
    """Normalize phone number by removing spaces, dashes, and standardizing format"""
    if not phone:
        return ""
    
    # Remove spaces, dashes, parentheses, dots
    normalized = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace(".", "")
    
    # Standardize Romanian numbers to 0-prefix format
    if normalized.startswith("+40"):
        normalized = "0" + normalized[3:]
    elif normalized.startswith("0040"):
        normalized = "0" + normalized[4:]
    elif normalized.startswith("40") and len(normalized) == 11:  # 40 + 9 digits
        # Number like 40759019895 -> 0759019895
        normalized = "0" + normalized[2:]
    
    return normalized

def sanitize_filename(name: str) -> str:
    """Sanitize strings for filesystem use"""
    if not name:
        return "unknown"
    # Replace unsafe characters
    safe = name.replace('/', '_').replace('\\', '_').replace(' ', '_').replace(':', '')
    # Keep only alphanumeric, underscores, and hyphens
    safe = "".join(c for c in safe if c.isalnum() or c in ('_', '-'))
    return safe if safe else "unknown"

# Filter function for important user accounts (to avoid clutter in suspect profile)
def is_important_account(account_dict: Dict[str, Any], all_emails: set) -> bool:
    """
    Filter user accounts to show only important services.
    Excludes Google/Gmail accounts (already shown in emails) and other low-value entries.
    """
    source = (account_dict.get('source', '') or '').lower()
    service_identifier = (account_dict.get('service_identifier', '') or '').lower()
    email = (account_dict.get('email', '') or '').lower()
    username = (account_dict.get('username', '') or '').lower()
    category = account_dict.get('category', '')
    
    # Skip if no useful identifier
    if not source and not service_identifier and not email and not username:
        return False
    
    # Skip Google services since they're already shown in "Emails Used"
    google_keywords = ['google', 'gmail', 'gms', 'android', 'com.google']
    if any(keyword in source for keyword in google_keywords):
        return False
    if any(keyword in service_identifier for keyword in google_keywords):
        return False
    
    # Skip generic/system services
    skip_services = ['system', 'settings', 'device', 'backup', 'sync', 'framework']
    if any(keyword in source for keyword in skip_services):
        return False
    if any(keyword in service_identifier for keyword in skip_services):
        return False
    
    # Keep important categories
    important_categories = ['Social Media', 'Messaging', 'Banking', 'Email', 'Shopping', 'Streaming']
    if category in important_categories:
        return True
    
    # Keep known important services
    important_services = [
        'facebook', 'instagram', 'whatsapp', 'twitter', 'tiktok', 'snapchat',
        'telegram', 'viber', 'signal', 'linkedin', 'reddit',
        'paypal', 'revolut', 'stripe', 'banking',
        'amazon', 'ebay', 'aliexpress',
        'netflix', 'spotify', 'youtube',
        'uber', 'bolt', 'airbnb'
    ]
    
    combined_text = f"{source} {service_identifier} {email} {username}".lower()
    if any(service in combined_text for service in important_services):
        return True
    
    # If it has an email that's NOT in the emails list, it might be interesting
    if email and '@' in email and email not in all_emails:
        return True
    
    # Default: skip it
    return False

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
sync_client = MongoClient(mongo_url)
sync_db = sync_client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix (Kubernetes ingress forwards /api/* to backend)
api_router = APIRouter(prefix="/api")

# Define Models
class Contact(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_number: Optional[str] = None
    person_name: Optional[str] = None
    device_info: Optional[str] = None
    upload_session_id: Optional[str] = None  # Unique ID for this upload session
    source: Optional[str] = None
    account: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    user_id: Optional[str] = None
    category: Optional[str] = None
    deleted_state: Optional[str] = None
    extraction_id: Optional[str] = None
    photo_path: Optional[str] = None
    suspect_phone: Optional[str] = None  # Device owner's phone number
    whatsapp_groups: Optional[List[str]] = None  # List of WhatsApp group IDs with names
    raw_data: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Password(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_number: Optional[str] = None
    person_name: Optional[str] = None
    device_info: Optional[str] = None
    upload_session_id: Optional[str] = None  # Unique ID for this upload session
    application: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None  # Social, Email, Messaging, Banking, etc.
    email_domain: Optional[str] = None  # Extracted from username if it's an email
    raw_data: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserAccount(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_number: Optional[str] = None
    person_name: Optional[str] = None
    device_info: Optional[str] = None
    source: Optional[str] = None
    username: Optional[str] = None
    user_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    service_identifier: Optional[str] = None
    service_type: Optional[str] = None
    category: Optional[str] = None  # Social, Email, Messaging, Banking, etc.
    email_domain: Optional[str] = None  # Extracted from email field
    notes: Optional[str] = None  # Additional info like occupation, bio, etc.
    time_created: Optional[str] = None  # Account creation timestamp
    metadata: Optional[Dict[str, Any]] = None  # Rich data: bio, DOB, profile URLs, IDs
    raw_data: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SuspectProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_number: str
    person_name: str
    device_info: Optional[str] = None
    profile_image_path: Optional[str] = None  # Path to me.jpg
    suspect_phone: Optional[str] = None  # Suspect's phone number
    emails: List[str] = []  # All emails used by the suspect
    user_accounts: List[Dict[str, Any]] = []  # All user accounts from UserAccounts.xml
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UploadStats(BaseModel):
    contacts: int
    passwords: int
    user_accounts: int
    upload_time: datetime

class SearchQuery(BaseModel):
    query: str
    data_type: Optional[str] = None  # contacts, passwords, user_accounts, or None for all

# Email Domain Extraction
def extract_email_domain(text: str) -> Optional[str]:
    """Extract domain from email address"""
    if not text or '@' not in text:
        return None
    try:
        domain = text.split('@')[1].strip().lower()
        return domain if domain else None
    except:
        return None

# Categorization Function
def categorize_credential(application: str = '', source: str = '', username: str = '', email: str = '', password: str = '') -> str:
    """Categorize credentials by type"""
    # PRIORITY 1: Check if username, email, or PASSWORD contains @ (email address)
    # Common email domains to detect
    email_domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 
                     'protonmail.com', 'aol.com', 'mail.com', 'zoho.com', 'yandex.com',
                     'live.com', 'msn.com', 'gmx.com']
    
    username_check = (username or '').lower()
    email_check = (email or '').lower()
    password_check = (password or '').lower()
    
    # If username, email, or PASSWORD contains @, check if it's an email address
    if '@' in username_check or '@' in email_check or '@' in password_check:
        # Check which field has the @
        check_text = ''
        if '@' in password_check:
            check_text = password_check
        elif '@' in username_check:
            check_text = username_check
        else:
            check_text = email_check
            
        # Check if it matches common email domains
        if any(domain in check_text for domain in email_domains):
            return 'Email'
        # If it has @ but not a recognized domain, still might be email
        if '@' in check_text and len(check_text.split('@')) == 2:
            domain_part = check_text.split('@')[1]
            if '.' in domain_part:
                return 'Email'
    
    # PRIORITY 2: Check application/source keywords
    app_lower = (application or source or '').lower()
    
    # Social Media
    social_keywords = ['facebook', 'instagram', 'twitter', 'tiktok', 'snapchat', 'linkedin', 
                       'reddit', 'pinterest', 'telegram', 'discord', 'badoo', 'tinder', 'onlyfans']
    if any(keyword in app_lower for keyword in social_keywords):
        return 'Social Media'
    
    # Messaging
    messaging_keywords = ['whatsapp', 'messenger', 'signal', 'viber', 'skype', 'duo']
    if any(keyword in app_lower for keyword in messaging_keywords):
        return 'Messaging'
    
    # Email (from application name)
    email_keywords = ['gmail', 'yahoo', 'outlook', 'mail', 'email']
    if any(keyword in app_lower for keyword in email_keywords):
        return 'Email'
    
    # Banking/Finance
    banking_keywords = ['bank', 'paypal', 'stripe', 'revolut', 'wise', 'crypto', 'wallet']
    if any(keyword in app_lower for keyword in banking_keywords):
        return 'Banking'
    
    # Shopping
    shopping_keywords = ['amazon', 'ebay', 'shop', 'store', 'cart']
    if any(keyword in app_lower for keyword in shopping_keywords):
        return 'Shopping'
    
    # Streaming
    streaming_keywords = ['netflix', 'spotify', 'youtube', 'hulu', 'disney', 'prime']
    if any(keyword in app_lower for keyword in streaming_keywords):
        return 'Streaming'
    
    # Google Services (but not if already identified as email)
    if 'google' in app_lower or 'android' in app_lower or 'chrome' in app_lower:
        return 'Google Services'
    
    return 'Other'

# XML Parsing Functions
def extract_device_from_xml(xml_content: str) -> str:
    """Extract device name from XML metadata"""
    try:
        root = ET.fromstring(xml_content)
        
        # Try to find manufacturer and device model
        manufacturer = ''
        device_name = ''
        
        for item in root.findall('.//{http://pa.cellebrite.com/report/2.0}item'):
            item_name = item.get('name')
            if item_name == 'DeviceInfoSelectedManufacturer' and item.text:
                manufacturer = item.text.strip()
            elif item_name == 'DeviceInfoSelectedDeviceName' and item.text:
                device_name = item.text.strip()
        
        # Combine manufacturer and device name (e.g., "Samsung SM-G991B")
        if manufacturer and device_name:
            return f"{manufacturer.capitalize()} {device_name}"
        elif device_name:
            return device_name
        elif manufacturer:
            return manufacturer.capitalize()
        
        # Fallback to project name
        project_name = root.get('name', '')
        if project_name:
            return project_name
            
    except Exception as e:
        logger.error(f"Error extracting device info: {str(e)}")
    return ''

def extract_device_owner_phone(temp_path: Path) -> Optional[str]:
    """Extract device owner's phone number from folder structure"""
    try:
        # Look for WhatsApp folder with owner's number
        # Pattern: WhatsApp_40752530087@s.whatsapp.net_Native
        contacts_dirs = list(temp_path.rglob('contacts'))
        for contacts_dir in contacts_dirs:
            if contacts_dir.is_dir():
                for subdir in contacts_dir.iterdir():
                    if subdir.is_dir() and 'WhatsApp_' in subdir.name:
                        # Extract phone number from folder name
                        import re
                        match = re.search(r'WhatsApp_(\d+)@s\.whatsapp\.net', subdir.name)
                        if match:
                            phone = match.group(1)
                            # Format as +40... if it starts with 407
                            if phone.startswith('407'):
                                return f"+{phone}"
                            elif phone.startswith('40'):
                                return f"+{phone}"
                            else:
                                return phone
    except Exception as e:
        logger.error(f"Error extracting device owner phone: {str(e)}")
    return None

def parse_contacts_xml(xml_content: str) -> List[Dict[str, Any]]:
    """Parse Contacts.xml from Cellebrite dump"""
    contacts = []
    try:
        root = ET.fromstring(xml_content)
        ns = {'ns': 'http://pa.cellebrite.com/report/2.0'}
        
        for contact_model in root.findall('.//ns:model[@type="Contact"]', ns):
            contact_data = {
                'extraction_id': contact_model.get('extractionId'),
                'deleted_state': contact_model.get('deleted_state'),
            }
            
            # Store ALL XML fields in raw_data for complete view
            raw_fields = {}
            for field in contact_model.findall('.//ns:field', ns):
                field_name = field.get('name')
                field_value = field.find('ns:value', ns)
                if field_value is not None and field_value.text:
                    raw_fields[field_name] = field_value.text
            
            # Store all sub-models (PhoneNumber, Email, UserID, etc.)
            raw_models = {}
            for sub_model in contact_model.findall('.//ns:model', ns):
                model_type = sub_model.get('type')
                if model_type and model_type != 'Contact':
                    if model_type not in raw_models:
                        raw_models[model_type] = []
                    model_data = {}
                    for field in sub_model.findall('.//ns:field', ns):
                        field_name = field.get('name')
                        field_value = field.find('ns:value', ns)
                        if field_value is not None and field_value.text:
                            model_data[field_name] = field_value.text
                    if model_data:
                        raw_models[model_type].append(model_data)
            
            # Get source
            source_field = contact_model.find('.//ns:field[@name="Source"]', ns)
            if source_field is not None:
                source_value = source_field.find('ns:value', ns)
                if source_value is not None:
                    contact_data['source'] = source_value.text
            
            # Get account
            account_field = contact_model.find('.//ns:field[@name="Account"]', ns)
            if account_field is not None:
                account_value = account_field.find('ns:value', ns)
                if account_value is not None:
                    contact_data['account'] = account_value.text
            
            # Get name
            name_field = contact_model.find('.//ns:field[@name="Name"]', ns)
            if name_field is not None:
                name_value = name_field.find('ns:value', ns)
                if name_value is not None:
                    contact_data['name'] = name_value.text
            
            # Get phone numbers
            # For WhatsApp contacts, prioritize extracting phone from user_id
            # because user_id contains the actual WhatsApp phone number
            phone_from_phonenumber_model = None
            phone_models = contact_model.findall('.//ns:model[@type="PhoneNumber"]', ns)
            if phone_models:
                phone_value_elem = phone_models[0].find('.//ns:field[@name="Value"]/ns:value', ns)
                if phone_value_elem is not None:
                    phone_from_phonenumber_model = phone_value_elem.text
            
            # Get email
            email_models = contact_model.findall('.//ns:model[@type="Email"]', ns)
            if email_models:
                email_value_elem = email_models[0].find('.//ns:field[@name="Value"]/ns:value', ns)
                if email_value_elem is not None:
                    contact_data['email'] = email_value_elem.text
            
            # Get user IDs (Facebook ID, Instagram ID, WhatsApp ID, etc.)
            userid_models = contact_model.findall('.//ns:model[@type="UserID"]', ns)
            extracted_user_id = None
            if userid_models:
                userid_value_elem = userid_models[0].find('.//ns:field[@name="Value"]/ns:value', ns)
                category_elem = userid_models[0].find('.//ns:field[@name="Category"]/ns:value', ns)
                if userid_value_elem is not None:
                    extracted_user_id = userid_value_elem.text
                    contact_data['user_id'] = userid_value_elem.text
                if category_elem is not None:
                    contact_data['category'] = category_elem.text
            
            # Determine which phone number to use
            # For WhatsApp contacts: Extract phone from user_id (e.g., 40751601949@s.whatsapp.net -> +40751601949)
            # For other contacts: Use PhoneNumber model
            source = contact_data.get('source', '')
            if source == 'WhatsApp' and extracted_user_id and '@s.whatsapp.net' in extracted_user_id:
                # Extract phone number from WhatsApp user_id
                phone_digits = extracted_user_id.split('@')[0]
                if phone_digits.isdigit():
                    contact_data['phone'] = '+' + phone_digits
            elif phone_from_phonenumber_model:
                # Use phone from PhoneNumber model for non-WhatsApp contacts
                contact_data['phone'] = phone_from_phonenumber_model
            
            # Extract WhatsApp group memberships from AdditionalInfo
            whatsapp_groups = []
            additional_info_models = contact_model.findall('.//ns:multiModelField[@name="AdditionalInfo"]/ns:model[@type="KeyValueModel"]', ns)
            for kv_model in additional_info_models:
                key_elem = kv_model.find('.//ns:field[@name="Key"]/ns:value', ns)
                value_elem = kv_model.find('.//ns:field[@name="Value"]/ns:value', ns)
                if key_elem is not None and value_elem is not None:
                    if key_elem.text == "Group in common" and value_elem.text:
                        # Value format: "40765261003-1601966684@g.us Group Name"
                        whatsapp_groups.append(value_elem.text)
            
            if whatsapp_groups:
                contact_data['whatsapp_groups'] = whatsapp_groups
            
            contact_data['raw_data'] = {
                'xml_id': contact_model.get('id'),
                'fields': raw_fields,
                'models': raw_models
            }
            
            # Only add contact if it has a phone number AND it's not a WhatsApp group
            # Check both phone and user_id for group identifiers
            phone = contact_data.get('phone', '')
            user_id = contact_data.get('user_id', '')
            
            # Skip if it's a WhatsApp group (identified by @g.us in user_id or phone)
            # or broadcast list (@broadcast)
            if phone and '@g.us' not in phone and '@broadcast' not in phone and '@g.us' not in user_id and '@broadcast' not in user_id:
                contacts.append(contact_data)
    
    except Exception as e:
        logger.error(f"Error parsing contacts XML: {str(e)}")
    
    return contacts

def parse_passwords_xml(xml_content: str) -> List[Dict[str, Any]]:
    """Parse Passwords.xml from Cellebrite dump"""
    passwords = []
    try:
        root = ET.fromstring(xml_content)
        ns = {'ns': 'http://pa.cellebrite.com/report/2.0'}
        
        for password_model in root.findall('.//ns:model[@type="Password"]', ns):
            password_data = {}
            
            # Store ALL XML fields in raw_data
            raw_fields = {}
            for field in password_model.findall('.//ns:field', ns):
                field_name = field.get('name')
                field_value = field.find('ns:value', ns)
                if field_value is not None and field_value.text:
                    raw_fields[field_name] = field_value.text[:500] if len(field_value.text) > 500 else field_value.text
            
            # Get application/source
            app_field = password_model.find('.//ns:field[@name="Application"]', ns)
            if app_field is None:
                app_field = password_model.find('.//ns:field[@name="Source"]', ns)
            if app_field is not None:
                app_value = app_field.find('ns:value', ns)
                if app_value is not None:
                    password_data['application'] = app_value.text
            
            # Get username
            username_field = password_model.find('.//ns:field[@name="UserName"]', ns)
            if username_field is not None:
                username_value = username_field.find('ns:value', ns)
                if username_value is not None:
                    password_data['username'] = username_value.text
            
            # Get password or data field (base64 encoded)
            password_field = password_model.find('.//ns:field[@name="Password"]', ns)
            if password_field is not None:
                password_value = password_field.find('ns:value', ns)
                if password_value is not None:
                    password_data['password'] = password_value.text
            
            # Get Data field (often base64 encoded tokens/keys)
            data_field = password_model.find('.//ns:field[@name="Data"]', ns)
            if data_field is not None:
                data_value = data_field.find('ns:value', ns)
                if data_value is not None and data_value.text:
                    try:
                        # Decode base64 if present
                        decoded = base64.b64decode(data_value.text).decode('utf-8', errors='ignore')
                        # Only store if it's reasonable length (< 100 chars for clear text passwords)
                        if len(decoded) < 100:
                            if not password_data.get('password'):
                                password_data['password'] = decoded
                            else:
                                password_data['description'] = decoded
                        else:
                            # Store as token/key in description
                            if not password_data.get('description'):
                                password_data['description'] = decoded[:200] + '...'
                    except Exception:
                        # If decode fails, skip it
                        pass
            
            # Get Label field
            label_field = password_model.find('.//ns:field[@name="Label"]', ns)
            if label_field is not None:
                label_value = label_field.find('ns:value', ns)
                if label_value is not None and label_value.text:
                    if not password_data.get('description'):
                        password_data['description'] = label_value.text
            
            # Get URL (try Url, Service, or ServiceIdentifier fields)
            url_field = password_model.find('.//ns:field[@name="Url"]', ns)
            if url_field is None:
                url_field = password_model.find('.//ns:field[@name="Service"]', ns)
            if url_field is None:
                url_field = password_model.find('.//ns:field[@name="ServiceIdentifier"]', ns)
            
            if url_field is not None:
                url_value = url_field.find('ns:value', ns)
                if url_value is not None and url_value.text:
                    password_data['url'] = url_value.text
                    
                    # Extract username from URL if it looks like an email domain
                    url_text = url_value.text.lower()
                    if not password_data.get('username'):
                        # Check if URL contains email-like patterns
                        if 'gmail' in url_text or 'yahoo' in url_text or 'hotmail' in url_text or 'outlook' in url_text:
                            # Create a representative username from the URL
                            if 'instagram' in url_text:
                                password_data['username'] = 'instagram_account'
                            elif 'facebook' in url_text:
                                password_data['username'] = 'facebook_account'
            
            password_data['raw_data'] = {
                'xml_id': password_model.get('id'),
                'fields': raw_fields
            }
            passwords.append(password_data)
    
    except Exception as e:
        logger.error(f"Error parsing passwords XML: {str(e)}")
    
    return passwords

def parse_useraccounts_xml(xml_content: str) -> List[Dict[str, Any]]:
    """Parse UserAccounts.xml - Extracts ALL available data including metadata"""
    accounts = []
    try:
        root = ET.fromstring(xml_content)
        ns_url = 'http://pa.cellebrite.com/report/2.0'
        ns = {'ns': ns_url}
        
        for account_model in root.findall('.//ns:model[@type="UserAccount"]', ns):
            account_data = {}
            metadata = {}  # Store rich metadata (bio, DOB, profile URLs, etc.)
            
            # --- Extract Basic Fields ---
            for field in account_model.findall('.//ns:field', ns):
                name = field.get('name')
                value = field.find('ns:value', ns)
                domain = field.get('domain')  # Context for the value
                
                if value is not None and value.text:
                    if name == 'Source': 
                        account_data['source'] = value.text
                    elif name == 'Username': 
                        account_data['username'] = value.text
                    elif name == 'UserId': 
                        account_data['user_id'] = value.text
                    elif name == 'ServiceIdentifier': 
                        account_data['service_identifier'] = value.text
                    elif name == 'ServiceType': 
                        account_data['service_type'] = value.text
                    elif name == 'Name': 
                        # Skip if it's a URL (common parsing error)
                        if value.text and not value.text.startswith('http') and 'cdninstagram' not in value.text.lower():
                            account_data['name'] = value.text
                    elif name == 'Email': 
                        account_data['email'] = value.text
                    elif name == 'TimeCreated':
                        account_data['time_created'] = value.text
                    elif name == 'Category':
                        # Category is a label for the next Value field
                        category_label = value.text
                    elif name == 'Value' and domain:
                        # Store categorized values (User ID, Email, Profile Picture, etc.)
                        if domain not in metadata:
                            metadata[domain] = []
                        metadata[domain].append(value.text)
                    elif name == 'Key':
                        # Key-value pairs (About, Date of Birth, etc.)
                        metadata_key = value.text
                    elif name == 'Value' and 'metadata_key' in locals():
                        # Store key-value metadata
                        if metadata_key not in metadata:
                            metadata[metadata_key] = value.text
                        del metadata_key
            
            # --- Extract multiField data (Notes, URLs) ---
            for multi_field in account_model.findall('.//ns:multiField', ns):
                field_name = multi_field.get('name')
                values = []
                for value in multi_field.findall('.//ns:value', ns):
                    if value.text:
                        values.append(value.text.strip())
                
                if values:
                    if field_name == 'Notes':
                        account_data['notes'] = ' | '.join(values)
                    elif field_name == 'Url':
                        metadata['URLs'] = values

            # --- Extract Profile Picture Path ---
            photo_path_node = account_model.find('.//ns:model[@type="ContactPhoto"]//ns:field[@name="contactphoto_extracted_path"]/ns:value', ns)
            if photo_path_node is not None and photo_path_node.text:
                clean_path = photo_path_node.text.replace('\\', '/')
                account_data['profile_pic_path'] = clean_path

            # --- Extract User ID from Entries (if not found above) ---
            if 'user_id' not in account_data:
                for entry in account_model.findall('.//ns:multiModelField[@name="Entries"]/ns:model[@type="UserID"]', ns):
                    val = entry.find('.//ns:field[@name="Value"]/ns:value', ns)
                    if val is not None and val.text:
                        account_data['user_id'] = val.text
                        break

            # Store metadata and raw data
            if metadata:
                account_data['metadata'] = metadata
            account_data['raw_data'] = {'xml_id': account_model.get('id')}
            
            accounts.append(account_data)
            
    except Exception as e:
        logger.error(f"Error parsing user accounts XML: {str(e)}")
        import traceback
        traceback.print_exc()
    
    return accounts

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Intelligence Database API"}

from fastapi import Form

@api_router.post("/upload", response_model=UploadStats)
def upload_cellebrite_dump(
    file: UploadFile = File(...),
    case_number: str = Form(...),
    person_name: str = Form(...)
):
    """
    Robust Upload Handler with Regex-based XML detection and detailed logging.
    """
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")
    
    stats = {'contacts': 0, 'passwords': 0, 'user_accounts': 0, 'upload_time': datetime.now(timezone.utc)}
    
    # Setup Directories
    uploads_dir = Path('/app/uploads')
    safe_case = "".join(c for c in case_number if c.isalnum() or c in ('_', '-'))
    safe_person = "".join(c for c in person_name if c.isalnum() or c in ('_', '-'))
    
    # Extract device info early from filename
    device_info = sanitize_filename(file.filename.replace('.zip', ''))
    safe_device = device_info if device_info else 'Unknown_Device'
    
    # Create directory structure: uploads/CaseNumber/SuspectName/Device
    case_suspect_device_dir = uploads_dir / safe_case / safe_person / safe_device
    case_suspect_device_dir.mkdir(parents=True, exist_ok=True) 
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_zip_path = Path(temp_dir) / "upload.zip"
            
            # Stream file to disk
            with open(temp_zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            with zipfile.ZipFile(temp_zip_path) as zip_ref:
                zip_ref.extractall(temp_dir)
            
            temp_path = Path(temp_dir)
            
            # --- IMPROVED FILE DETECTION (REGEX) ---
            xml_files = list(temp_path.rglob('*.xml'))
            contacts_file = None
            passwords_file = None
            accounts_file = None
            
            logger.info(f"Scanning {len(xml_files)} XML files...")
            
            for xml_path in xml_files:
                try:
                    # Read first 50KB to identify file type (optimization)
                    with open(xml_path, 'r', encoding='utf-8', errors='ignore') as f:
                        start_content = f.read(50000)
                    
                    # Use Regex to match tags regardless of attribute order
                    # Matches: <model ... type="UserAccount" ... >
                    if re.search(r'<model\s+[^>]*type=["\']Contact["\']', start_content, re.IGNORECASE):
                        contacts_file = xml_path
                        logger.info(f"Found CONTACTS file: {xml_path.name}")
                    
                    if re.search(r'<model\s+[^>]*type=["\']Password["\']', start_content, re.IGNORECASE):
                        passwords_file = xml_path
                        logger.info(f"Found PASSWORDS file: {xml_path.name}")
                        
                    if re.search(r'<model\s+[^>]*type=["\']UserAccount["\']', start_content, re.IGNORECASE):
                        accounts_file = xml_path
                        logger.info(f"Found ACCOUNTS file: {xml_path.name}")
                        
                except Exception as e:
                    logger.warning(f"Skipping file {xml_path.name}: {e}")

            # Extract device info from XML metadata (manufacturer + model)
            if accounts_file:
                xml_content = accounts_file.read_text(encoding='utf-8')
                extracted_device = extract_device_from_xml(xml_content)
                if extracted_device:
                    device_info = extracted_device
                    safe_device = sanitize_filename(device_info)
                    # Update directory path with proper device name
                    case_suspect_device_dir = uploads_dir / safe_case / safe_person / safe_device
                    case_suspect_device_dir.mkdir(parents=True, exist_ok=True)
                    logger.info(f"Device extracted from XML: {device_info}")
            
            # Extract suspect phone
            suspect_phone = extract_device_owner_phone(temp_path)
            
            # --- PROCESS CONTACTS ---
            if contacts_file:
                logger.info("Processing Contacts...")
                xml_content = contacts_file.read_text(encoding='utf-8')
                contacts_data = parse_contacts_xml(xml_content)
                
                # Image Indexing
                image_files = {}
                for img_path in temp_path.rglob('*.j*'):
                    if img_path.is_file() and not img_path.name.endswith('.xml'):
                        fname = img_path.stem
                        norm = ''.join(c for c in fname if c.isdigit())
                        if norm: image_files[norm] = img_path

                batch_contacts = []
                for contact_dict in contacts_data:
                    contact_dict.update({
                        'case_number': case_number, 'person_name': person_name,
                        'device_info': device_info, 'suspect_phone': suspect_phone
                    })
                    
                    # Photo Match Logic
                    phone = contact_dict.get('phone', '')
                    if phone:
                        norm_phone = ''.join(c for c in phone if c.isdigit())
                        if len(norm_phone) >= 6:
                            matched_img = image_files.get(norm_phone)
                            if not matched_img:
                                for code in ['40', '1', '44', '33']:
                                    if (code + norm_phone) in image_files:
                                        matched_img = image_files[code + norm_phone]
                                        break
                            if matched_img:
                                try:
                                    img_name = f"{contact_dict.get('id', uuid.uuid4())}.jpg"
                                    shutil.copy(matched_img, case_suspect_device_dir / img_name)
                                    contact_dict['photo_path'] = f"/images/{safe_case}/{safe_person}/{safe_device}/{img_name}"
                                except: pass

                    contact = Contact(**contact_dict)
                    doc = contact.model_dump()
                    if doc.get('created_at'): doc['created_at'] = doc['created_at'].replace(tzinfo=timezone.utc)
                    batch_contacts.append(doc)
                
                if batch_contacts:
                    sync_db.contacts.insert_many(batch_contacts)
                    stats['contacts'] = len(batch_contacts)

            # --- PROCESS PASSWORDS ---
            if passwords_file:
                logger.info("Processing Passwords...")
                pass_content = passwords_file.read_text(encoding='utf-8')
                pass_data = parse_passwords_xml(pass_content)
                batch_passwords = []
                
                for pwd_dict in pass_data:
                    if not any([pwd_dict.get('username'), pwd_dict.get('password'), pwd_dict.get('url')]): continue
                    
                    pwd_dict.update({
                        'case_number': case_number, 'person_name': person_name, 'device_info': device_info,
                        'email_domain': extract_email_domain(pwd_dict.get('username', '')),
                        'category': categorize_credential(pwd_dict.get('application', ''), pwd_dict.get('username', ''), '', pwd_dict.get('password', ''))
                    })
                    
                    pwd = Password(**pwd_dict)
                    doc = pwd.model_dump()
                    if doc.get('created_at'): doc['created_at'] = doc['created_at'].replace(tzinfo=timezone.utc)
                    batch_passwords.append(doc)
                
                if batch_passwords:
                    sync_db.passwords.insert_many(batch_passwords)
                    stats['passwords'] = len(batch_passwords)

            # --- PROCESS ACCOUNTS & SUSPECT PROFILE ---
            if accounts_file:
                logger.info(f"Processing Accounts from {accounts_file.name}")
                acc_content = accounts_file.read_text(encoding='utf-8')
                
                # --- Debugging: Check for UserAccount tag manually ---
                if 'UserAccount' not in acc_content:
                    logger.error("CRITICAL: 'UserAccount' string not found in file content!")
                
                acc_data = parse_useraccounts_xml(acc_content)
                logger.info(f"Parsed {len(acc_data)} accounts.")
                
                batch_accounts = []
                all_emails = set()
                suspect_image_source_path = None
                
                for acc_dict in acc_data:
                    if any([acc_dict.get('username'), acc_dict.get('email'), acc_dict.get('user_id')]):
                        acc_dict.update({
                            'case_number': case_number, 'person_name': person_name, 'device_info': device_info,
                            'email_domain': extract_email_domain(acc_dict.get('email', '')),
                            'category': categorize_credential(acc_dict.get('source', ''), acc_dict.get('username', ''), acc_dict.get('email', ''))
                        })
                        
                        # Collect emails from both email and username fields
                        if acc_dict.get('email'): 
                            all_emails.add(acc_dict['email'])
                        # Also check if username looks like an email
                        username = acc_dict.get('username', '')
                        if username and '@' in username and '.' in username:
                            all_emails.add(username)
                        
                        # Suspect Image Logic
                        src = (acc_dict.get('source') or '').lower()
                        path = acc_dict.get('profile_pic_path')
                        if path:
                            # Fix path slashes
                            clean_path = path.replace('\\', '/')
                            full_path = temp_path / clean_path
                            if full_path.exists():
                                if 'whatsapp' in src: suspect_image_source_path = full_path
                                elif 'instagram' in src and not suspect_image_source_path: suspect_image_source_path = full_path
                                elif not suspect_image_source_path: suspect_image_source_path = full_path

                        acc = UserAccount(**acc_dict)
                        doc = acc.model_dump()
                        if doc.get('created_at'): doc['created_at'] = doc['created_at'].replace(tzinfo=timezone.utc)
                        batch_accounts.append(doc)
                
                if batch_accounts:
                    sync_db.user_accounts.insert_many(batch_accounts)
                    stats['user_accounts'] = len(batch_accounts)
                
                # --- CREATE SUSPECT PROFILE ---
                final_profile_path = None
                
                # First, try to find me.jpg in UserAccounts folder OR anywhere in the ZIP
                if not suspect_image_source_path:
                    logger.info("Looking for me.jpg in extracted files...")
                    
                    # Strategy 1: Search in UserAccounts folder first
                    for user_accounts_dir in temp_path.rglob('UserAccounts'):
                        if user_accounts_dir.is_dir():
                            me_jpg_path = user_accounts_dir / 'me.jpg'
                            if me_jpg_path.exists():
                                suspect_image_source_path = me_jpg_path
                                logger.info(f"Found me.jpg in UserAccounts at: {me_jpg_path}")
                                break
                    
                    # Strategy 2: If not found, search for ANY me.jpg file in the entire extraction
                    if not suspect_image_source_path:
                        me_files = list(temp_path.rglob('me.jpg'))
                        if me_files:
                            suspect_image_source_path = me_files[0]
                            logger.info(f"Found me.jpg at: {suspect_image_source_path}")
                    
                    # Strategy 3: If still not found, look for any file with 'profile' or 'me' in name in useraccounts
                    if not suspect_image_source_path:
                        for user_accounts_dir in temp_path.rglob('UserAccounts'):
                            if user_accounts_dir.is_dir():
                                for img_file in user_accounts_dir.glob('*.jpg'):
                                    if 'me' in img_file.name.lower() or 'profile' in img_file.name.lower():
                                        suspect_image_source_path = img_file
                                        logger.info(f"Found potential profile image: {suspect_image_source_path}")
                                        break
                                if suspect_image_source_path:
                                    break
                
                # Copy suspect image if found
                if suspect_image_source_path and suspect_image_source_path.exists():
                    try:
                        ext = suspect_image_source_path.suffix or '.jpg'
                        new_name = f"profile_{uuid.uuid4().hex[:8]}{ext}"
                        shutil.copy(suspect_image_source_path, case_suspect_device_dir / new_name)
                        final_profile_path = f"/images/{safe_case}/{safe_person}/{safe_device}/{new_name}"
                        logger.info(f"Suspect image saved: {final_profile_path}")
                    except Exception as e:
                        logger.error(f"Failed copy suspect image: {e}")

                # Prepare user accounts for suspect profile (include all rich data)
                user_accounts_for_profile = [
                    {
                        'username': acc.get('username'),
                        'email': acc.get('email'),
                        'name': acc.get('name'),
                        'user_id': acc.get('user_id'),
                        'source': acc.get('source'),
                        'service_type': acc.get('service_type'),
                        'service_identifier': acc.get('service_identifier'),
                        'notes': acc.get('notes'),
                        'time_created': acc.get('time_created'),
                        'metadata': acc.get('metadata')
                    } 
                    for acc in batch_accounts
                ]
                
                profile = SuspectProfile(
                    case_number=case_number, person_name=person_name, device_info=device_info,
                    profile_image_path=final_profile_path, suspect_phone=suspect_phone, 
                    emails=list(all_emails), user_accounts=user_accounts_for_profile
                )
                
                doc = profile.model_dump()
                if doc.get('created_at'): doc['created_at'] = doc['created_at'].replace(tzinfo=timezone.utc)
                if doc.get('updated_at'): doc['updated_at'] = doc['updated_at'].replace(tzinfo=timezone.utc)

                # Check if this exact profile already exists (case + person + device + similar timestamp)
                # This allows multiple uploads of same person/device by checking timestamp
                existing = sync_db.suspect_profiles.find_one({
                    'case_number': case_number,
                    'person_name': person_name,
                    'device_info': device_info
                })
                
                # If existing profile found, check if it's from a different upload session (>5 minutes apart)
                if existing:
                    existing_time = existing.get('created_at')
                    new_time = doc.get('created_at')
                    
                    # If more than 5 minutes apart, treat as new upload session
                    if existing_time and new_time:
                        from datetime import timedelta
                        
                        # Ensure both datetimes are timezone-aware for comparison
                        if existing_time.tzinfo is None:
                            existing_time = existing_time.replace(tzinfo=timezone.utc)
                        if new_time.tzinfo is None:
                            new_time = new_time.replace(tzinfo=timezone.utc)
                        
                        time_diff = abs((new_time - existing_time).total_seconds())
                        if time_diff > 300:  # 5 minutes
                            # New upload session - insert as new profile
                            sync_db.suspect_profiles.insert_one(doc)
                        else:
                            # Same upload session - update existing
                            sync_db.suspect_profiles.update_one({
                                'case_number': case_number,
                                'person_name': person_name,
                                'device_info': device_info
                            }, {'$set': doc})
                    else:
                        # Can't determine time difference, update existing
                        sync_db.suspect_profiles.update_one({
                            'case_number': case_number,
                            'person_name': person_name,
                            'device_info': device_info
                        }, {'$set': doc})
                else:
                    # No existing profile - insert new one
                    sync_db.suspect_profiles.insert_one(doc)

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")
    except Exception as e:
        logger.error(f"Error processing upload: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
    
    return UploadStats(**stats)

@api_router.get("/contacts", response_model=List[Contact])
async def get_contacts():
    """Get all contacts"""
    contacts = await db.contacts.find({}, {"_id": 0}).to_list(10000)
    for contact in contacts:
        if isinstance(contact.get('created_at'), str):
            contact['created_at'] = datetime.fromisoformat(contact['created_at'])
    return contacts

@api_router.get("/passwords", response_model=List[Password])
async def get_passwords():
    """Get all passwords"""
    passwords = await db.passwords.find({}, {"_id": 0}).to_list(10000)
    for password in passwords:
        if isinstance(password.get('created_at'), str):
            password['created_at'] = datetime.fromisoformat(password['created_at'])
    return passwords

@api_router.get("/user-accounts", response_model=List[UserAccount])
async def get_user_accounts():
    """Get all user accounts"""
    accounts = await db.user_accounts.find({}, {"_id": 0}).to_list(10000)
    for account in accounts:
        if isinstance(account.get('created_at'), str):
            account['created_at'] = datetime.fromisoformat(account['created_at'])
    return accounts

@api_router.post("/search")
async def search_data(search: SearchQuery):
    """Search across all data types"""
    query = search.query.lower()
    results = {
        'contacts': [],
        'passwords': [],
        'user_accounts': []
    }
    
    if not search.data_type or search.data_type == 'contacts':
        # Search contacts
        contacts = await db.contacts.find({}, {"_id": 0}).to_list(10000)
        matched_contacts = []
        
        # Build phone-to-photo mapping for suspect lookup
        phone_to_photo = {}
        for contact in contacts:
            if contact.get('photo_path') and contact.get('phone'):
                normalized = normalize_phone(contact.get('phone'))
                if normalized and normalized not in phone_to_photo:
                    phone_to_photo[normalized] = contact.get('photo_path')
        
        for contact in contacts:
            # Search in all fields including normalized phone
            phone = contact.get('phone', '')
            normalized_phone = normalize_phone(phone)
            normalized_query = normalize_phone(query)
            
            searchable_text = ' '.join([
                str(contact.get('name', '')),
                str(contact.get('source', '')),
                str(phone),
                str(normalized_phone),
                str(contact.get('email', '')),
                str(contact.get('user_id', '')),
                str(contact.get('account', '')),
                str(contact.get('category', ''))
            ]).lower()
            
            if query in searchable_text or normalized_query in normalized_phone:
                if isinstance(contact.get('created_at'), str):
                    contact['created_at'] = datetime.fromisoformat(contact['created_at'])
                matched_contacts.append(contact)
        
        # Merge duplicates by normalized phone (prioritize name and photo)
        grouped = {}
        for contact in matched_contacts:
            phone = contact.get('phone', '')
            
            if not phone:
                continue
            
            normalized_phone = normalize_phone(phone)
            
            if normalized_phone not in grouped:
                grouped[normalized_phone] = []
            
            grouped[normalized_phone].append(contact)
        
        # For each group, merge best information from all contacts
        final_contacts = []
        for normalized_phone, contacts in grouped.items():
            # Start with first contact as base
            merged_contact = contacts[0]
            
            # Collect all phone variants and sources
            all_phones = []
            sources = []
            
            # Merge information from all duplicates, prioritizing filled fields
            for c in contacts:
                # Prioritize name if current is empty/None/"-"
                current_name = merged_contact.get('name', '')
                new_name = c.get('name', '')
                if new_name and new_name != '-' and new_name.strip():
                    if not current_name or current_name == '-' or not current_name.strip():
                        merged_contact['name'] = new_name
                
                # Prioritize photo if current is empty
                if not merged_contact.get('photo_path') and c.get('photo_path'):
                    merged_contact['photo_path'] = c.get('photo_path')
                
                # Prioritize email if current is empty
                if not merged_contact.get('email') and c.get('email'):
                    merged_contact['email'] = c.get('email')
                
                # Collect phones and sources
                p = c.get('phone', '')
                if p and p not in all_phones:
                    all_phones.append(p)
                s = c.get('source')
                # Replace None/null with "Agenda Telefon"
                if not s:
                    s = 'Agenda Telefon'
                if s not in sources:
                    sources.append(s)
            
            # Replace None source with "Agenda Telefon"
            if not merged_contact.get('source'):
                merged_contact['source'] = 'Agenda Telefon'
            
            merged_contact['duplicate_count'] = len(contacts)
            merged_contact['all_phones'] = all_phones
            merged_contact['sources'] = sources
            
            # Add suspect photo if suspect_phone exists
            suspect_phone = merged_contact.get('suspect_phone')
            if suspect_phone:
                normalized_suspect = normalize_phone(suspect_phone)
                if normalized_suspect in phone_to_photo:
                    merged_contact['suspect_photo_path'] = phone_to_photo[normalized_suspect]
            
            final_contacts.append(merged_contact)
        
        results['contacts'] = final_contacts
        # Sort by name
        results['contacts'].sort(key=lambda x: (x.get('name') or '').lower())
    
    if not search.data_type or search.data_type == 'passwords':
        # Search passwords
        passwords = await db.passwords.find({}, {"_id": 0}).to_list(10000)
        for password in passwords:
            searchable_text = ' '.join([
                str(password.get('application', '')),
                str(password.get('username', '')),
                str(password.get('url', '')),
                str(password.get('description', ''))
            ]).lower()
            
            if query in searchable_text:
                if isinstance(password.get('created_at'), str):
                    password['created_at'] = datetime.fromisoformat(password['created_at'])
                results['passwords'].append(password)
    
    if not search.data_type or search.data_type == 'user_accounts':
        # Search user accounts
        accounts = await db.user_accounts.find({}, {"_id": 0}).to_list(10000)
        for account in accounts:
            searchable_text = ' '.join([
                str(account.get('source', '')),
                str(account.get('username', '')),
                str(account.get('user_id', '')),
                str(account.get('email', '')),
                str(account.get('name', ''))
            ]).lower()
            
            if query in searchable_text:
                if isinstance(account.get('created_at'), str):
                    account['created_at'] = datetime.fromisoformat(account['created_at'])
                results['user_accounts'].append(account)
    
    return results

@api_router.delete("/clear-all")
async def clear_all_data():
    """Clear all data from database - DEPRECATED: Use secure endpoint"""
    raise HTTPException(status_code=410, detail="Endpoint deprecated. Use secure wipe endpoint.")

@api_router.post("/admin/nuclear-wipe-database-confirm")
async def nuclear_wipe_database(secret_key: str = None):
    """
    🔥 NUCLEAR OPTION: Complete database wipe
    
    Security: Requires secret key
    Access: Hidden endpoint - not documented in public API
    
    To use this endpoint, you must provide the SECRET_WIPE_KEY
    Set in backend/.env: SECRET_WIPE_KEY=your_secret_key_here
    
    Example:
    curl -X POST "http://localhost:8001/api/admin/nuclear-wipe-database-confirm?secret_key=YOUR_SECRET_KEY"
    """
    # Get secret key from environment
    required_key = os.environ.get('SECRET_WIPE_KEY', '')
    
    # Security check 1: Secret key must be set in environment
    if not required_key:
        logger.warning("⚠️ Nuclear wipe attempted but SECRET_WIPE_KEY not configured")
        raise HTTPException(
            status_code=503, 
            detail="Database wipe feature not configured. Contact administrator."
        )
    
    # Security check 2: Secret key must be provided
    if not secret_key:
        logger.warning("⚠️ Nuclear wipe attempted without secret key")
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized: Secret key required"
        )
    
    # Security check 3: Secret key must match
    if secret_key != required_key:
        logger.warning(f"⚠️ Nuclear wipe attempted with invalid key")
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Invalid secret key"
        )
    
    # Log the action
    logger.critical("🔥 NUCLEAR WIPE INITIATED - All database data will be deleted")
    
    try:
        # Wipe all collections
        result = {
            'contacts_deleted': 0,
            'passwords_deleted': 0,
            'user_accounts_deleted': 0,
            'suspect_profiles_deleted': 0,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Delete all data
        contacts_result = await db.contacts.delete_many({})
        result['contacts_deleted'] = contacts_result.deleted_count
        
        passwords_result = await db.passwords.delete_many({})
        result['passwords_deleted'] = passwords_result.deleted_count
        
        accounts_result = await db.user_accounts.delete_many({})
        result['user_accounts_deleted'] = accounts_result.deleted_count
        
        profiles_result = await db.suspect_profiles.delete_many({})
        result['suspect_profiles_deleted'] = profiles_result.deleted_count
        
        total_deleted = sum([
            result['contacts_deleted'],
            result['passwords_deleted'],
            result['user_accounts_deleted'],
            result['suspect_profiles_deleted']
        ])
        
        logger.critical(f"🔥 NUCLEAR WIPE COMPLETE - {total_deleted} total records deleted")
        
        result['total_deleted'] = total_deleted
        result['status'] = 'success'
        result['message'] = f'Database wiped successfully. {total_deleted} total records deleted.'
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Nuclear wipe failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database wipe failed: {str(e)}"
        )

@api_router.get("/stats")
async def get_stats():
    """Get database statistics"""
    contacts_count = await db.contacts.count_documents({})
    passwords_count = await db.passwords.count_documents({})
    accounts_count = await db.user_accounts.count_documents({})
    
    return {
        'contacts': contacts_count,
        'passwords': passwords_count,
        'user_accounts': accounts_count,
        'total': contacts_count + passwords_count + accounts_count
    }

@api_router.get("/images/{file_path:path}")
async def get_image(file_path: str):
    """Serve images from nested directories"""
    from fastapi.responses import FileResponse
    
    # Securely join paths
    image_path = Path('/app/uploads') / file_path
    
    # Security check to prevent directory traversal
    try:
        image_path = image_path.resolve()
        root_path = Path('/app/uploads').resolve()
        if root_path not in image_path.parents:
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=404, detail="Image not found")
        
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(image_path)

@api_router.get("/contacts/deduplicated")
async def get_deduplicated_contacts():
    """Get contacts grouped by normalized phone number (deduplicated)"""
    # Get all contacts
    all_contacts = await db.contacts.find().to_list(10000)
    
    # Build a phone-to-photo mapping for suspect lookup
    phone_to_photo = {}
    for contact in all_contacts:
        if contact.get('photo_path') and contact.get('phone'):
            normalized = normalize_phone(contact.get('phone'))
            if normalized and normalized not in phone_to_photo:
                phone_to_photo[normalized] = contact.get('photo_path')
    
    # Group by normalized phone only
    grouped = {}
    for contact in all_contacts:
        phone = contact.get('phone', '')
        
        if not phone:
            continue
        
        normalized_phone = normalize_phone(phone)
        
        if normalized_phone not in grouped:
            grouped[normalized_phone] = []
        
        grouped[normalized_phone].append(contact)
    
    # For each group, merge best information from all contacts
    results = []
    for normalized_phone, contacts in grouped.items():
        # Start with the first contact as base
        merged_contact = dict(contacts[0])
        if '_id' in merged_contact:
            del merged_contact['_id']
        
        # Collect all phone variants, sources, and unique names
        all_phones = []
        sources = []
        all_names = []  # Track all unique names
        
        # Merge information from all duplicates, prioritizing filled fields
        # PRIORITY: Best name wins (longest meaningful name, not phone numbers or service names)
        best_name = merged_contact.get('name', '')
        best_name_score = 0  # Score based on length and meaningfulness
        
        for c in contacts:
            # Collect all unique names
            current_name = c.get('name', '')
            if current_name and current_name != '-' and current_name.strip():
                # Skip if name looks like a phone number (all digits/dashes/spaces)
                if current_name.replace('-', '').replace(' ', '').replace('+', '').isdigit():
                    continue
                
                # Skip service names like "WhatsApp", "facebook", etc
                service_keywords = ['whatsapp', 'facebook', 'instagram', 'telegram', 'viber']
                if any(keyword in current_name.lower() for keyword in service_keywords):
                    # Only skip if it's JUST the service name or very short
                    if len(current_name.strip()) < 6:
                        continue
                
                # Add to unique names list
                if current_name not in all_names:
                    all_names.append(current_name)
                
                # Also track best name for primary display
                name_score = len(current_name.strip())
                if any(char.isalpha() for char in current_name):
                    name_score += 50  # Bonus for having letters
                
                if name_score > best_name_score:
                    best_name = current_name
                    best_name_score = name_score
                    merged_contact['name'] = current_name
            
            # Prioritize photo if current is empty
            if not merged_contact.get('photo_path') and c.get('photo_path'):
                merged_contact['photo_path'] = c.get('photo_path')
            
            # Prioritize email if current is empty
            if not merged_contact.get('email') and c.get('email'):
                merged_contact['email'] = c.get('email')
            
            # Collect phones and sources
            p = c.get('phone', '')
            if p and p not in all_phones:
                all_phones.append(p)
            s = c.get('source')
            # Replace None/null with "Agenda Telefon"
            if not s:
                s = 'Agenda Telefon'
            if s not in sources:
                sources.append(s)
        
        # Replace None source with "Agenda Telefon"
        if not merged_contact.get('source'):
            merged_contact['source'] = 'Agenda Telefon'
        
        merged_contact['duplicate_count'] = len(contacts)
        merged_contact['all_phones'] = all_phones
        merged_contact['all_names'] = all_names  # All unique names
        merged_contact['sources'] = sources
        
        # Ensure 'phone' field is populated with primary phone (first in list)
        if all_phones:
            merged_contact['phone'] = all_phones[0]
        
        # Add suspect photo if suspect_phone exists
        suspect_phone = merged_contact.get('suspect_phone')
        if suspect_phone:
            normalized_suspect = normalize_phone(suspect_phone)
            if normalized_suspect in phone_to_photo:
                merged_contact['suspect_photo_path'] = phone_to_photo[normalized_suspect]
        
        results.append(merged_contact)
    
    # Sort by name
    results.sort(key=lambda x: (x.get('name') or '').lower())
    
    return results

@api_router.get("/passwords/deduplicated")
async def get_deduplicated_passwords():
    """Get passwords grouped by username+application (deduplicated)"""
    pipeline = [
        {
            "$sort": {"created_at": -1}
        },
        {
            "$group": {
                "_id": {
                    "username": {"$ifNull": ["$username", "$password"]},
                    "application": "$application"
                },
                "password": {"$first": "$$ROOT"},
                "count": {"$sum": 1}
            }
        },
        {
            "$replaceRoot": {
                "newRoot": {
                    "$mergeObjects": [
                        "$password",
                        {"duplicate_count": "$count"}
                    ]
                }
            }
        },
        {
            "$project": {"_id": 0}
        }
    ]
    
    results = await db.passwords.aggregate(pipeline).to_list(10000)
    for result in results:
        if isinstance(result.get('created_at'), str):
            result['created_at'] = datetime.fromisoformat(result['created_at'])
    return results

@api_router.get("/user-accounts/deduplicated")
async def get_deduplicated_accounts():
    """Get user accounts grouped by username+source (deduplicated)"""
    pipeline = [
        {
            "$sort": {"created_at": -1}
        },
        {
            "$group": {
                "_id": {
                    "username": {"$ifNull": ["$username", "$email"]},
                    "source": "$source"
                },
                "account": {"$first": "$$ROOT"},
                "count": {"$sum": 1}
            }
        },
        {
            "$replaceRoot": {
                "newRoot": {
                    "$mergeObjects": [
                        "$account",
                        {"duplicate_count": "$count"}
                    ]
                }
            }
        },
        {
            "$project": {"_id": 0}
        }
    ]
    
    results = await db.user_accounts.aggregate(pipeline).to_list(10000)
    for result in results:
        if isinstance(result.get('created_at'), str):
            result['created_at'] = datetime.fromisoformat(result['created_at'])
    return results

@api_router.get("/credentials/deduplicated")
async def get_deduplicated_credentials():
    """Get credentials grouped by username+application (deduplicated) - Only shows Type: Default"""
    # Get both passwords and accounts
    passwords = await db.passwords.find({}, {"_id": 0}).to_list(10000)
    accounts = await db.user_accounts.find({}, {"_id": 0}).to_list(10000)
    
    # Combine and deduplicate
    all_creds = []
    seen = {}
    
    for pwd in passwords:
        username = pwd.get('username') or pwd.get('password') or ''
        app = pwd.get('application', '')
        key = f"{username}_{app}".lower()
        
        if key not in seen and username:
            pwd['duplicate_count'] = 1
            seen[key] = len(all_creds)
            all_creds.append(pwd)
        elif key in seen:
            all_creds[seen[key]]['duplicate_count'] = all_creds[seen[key]].get('duplicate_count', 1) + 1
    
    for acc in accounts:
        # Filter: Only include Type: Default (skip Key, Secret, Token)
        service_type = acc.get('service_type', '') or ''
        service_type = service_type.lower()
        if service_type and service_type in ['key', 'secret', 'token']:
            continue
        
        username = acc.get('username') or acc.get('email') or ''
        app = acc.get('source', '')
        key = f"{username}_{app}".lower()
        
        if key not in seen and username:
            acc['duplicate_count'] = 1
            seen[key] = len(all_creds)
            all_creds.append(acc)
        elif key in seen:
            all_creds[seen[key]]['duplicate_count'] = all_creds[seen[key]].get('duplicate_count', 1) + 1
    
    for cred in all_creds:
        if isinstance(cred.get('created_at'), str):
            cred['created_at'] = datetime.fromisoformat(cred['created_at'])
    
    return all_creds

@api_router.get("/credentials/{credential_id}/details")
async def get_credential_details(credential_id: str):
    """Get all records for a specific credential (including duplicates)"""
    # Try to find in passwords first
    credential = await db.passwords.find_one({"id": credential_id}, {"_id": 0})
    is_password = True
    
    # If not found, try user_accounts
    if not credential:
        credential = await db.user_accounts.find_one({"id": credential_id}, {"_id": 0})
        is_password = False
    
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Get all credentials with same username+application
    username = credential.get('username') or credential.get('email') or credential.get('password') or ''
    application = credential.get('application') or credential.get('source') or ''
    
    all_credentials = []
    
    if username and application:
        # Search in both passwords and accounts
        if is_password:
            query = {
                "$or": [
                    {"username": username, "application": application},
                    {"password": username, "application": application}
                ]
            }
            all_creds = await db.passwords.find(query, {"_id": 0}).to_list(1000)
        else:
            query = {
                "$or": [
                    {"username": username, "source": application},
                    {"email": username, "source": application}
                ]
            }
            all_creds = await db.user_accounts.find(query, {"_id": 0}).to_list(1000)
        
        for c in all_creds:
            if isinstance(c.get('created_at'), str):
                c['created_at'] = datetime.fromisoformat(c['created_at'])
        
        all_credentials = all_creds
    
    return {
        "main_credential": credential,
        "all_records": all_credentials if all_credentials else [credential],
        "total_duplicates": len(all_credentials) if all_credentials else 1,
        "is_password": is_password
    }

@api_router.get("/credentials/password-analysis")
async def get_password_analysis():
    """Analyze password reuse across services - Shows how many times each password is used and where"""
    # Get all passwords and accounts
    passwords = await db.passwords.find({}, {"_id": 0}).to_list(10000)
    accounts = await db.user_accounts.find({}, {"_id": 0}).to_list(10000)
    
    # Build password usage map
    password_usage = {}  # password -> list of {service, username, case, device}
    
    for pwd in passwords:
        password_value = (pwd.get('password', '') or '').strip()
        username = pwd.get('username', '') or '-'
        # Prioritize URL for service identification, fall back to application
        # This ensures different URLs are treated as different services
        url = pwd.get('url', '').strip() if pwd.get('url') else ''
        application = pwd.get('application', '').strip() if pwd.get('application') else ''
        
        # Use URL if available and meaningful, otherwise use application
        if url and url not in ['', '-', 'None', 'Multiple Accounts']:
            service = url
        elif application:
            service = application
        else:
            service = pwd.get('raw_data', {}).get('fields', {}).get('ServiceIdentifier', '') or '-'
            
        case_number = pwd.get('case_number', '-')
        device = pwd.get('device_info', '-')
        suspect = pwd.get('person_name', '-')
        record_id = pwd.get('id', '')
        category = pwd.get('category', 'Other')
        raw_data = pwd.get('raw_data', {})
        
        # Skip empty passwords or very short ones (likely not real passwords)
        if not password_value or len(password_value) < 2:
            continue
            
        # Skip if password looks like a username/email
        if '@' in password_value and '.' in password_value:
            continue
        
        if password_value not in password_usage:
            password_usage[password_value] = []
        
        password_usage[password_value].append({
            'id': record_id,
            'service': service,
            'username': username,
            'case_number': case_number,
            'device': device,
            'suspect': suspect,
            'url': url,
            'category': category,
            'raw_data': raw_data,
            'type': 'password'
        })
    
    for acc in accounts:
        # Check if account has a password-like field
        user_id = (acc.get('user_id', '') or '').strip()
        
        # Skip if empty or looks like a numeric ID
        if not user_id or len(user_id) < 4 or user_id.isdigit():
            continue
        
        # Only include if it looks like it could be a password (has mixed characters)
        # Skip pure emails or usernames
        if '@' in user_id or len(user_id) < 6:
            continue
        
        username = acc.get('username') or acc.get('email', '') or '-'
        service = acc.get('source') or acc.get('service_identifier', '') or '-'
        case_number = acc.get('case_number', '-')
        device = acc.get('device_info', '-')
        suspect = acc.get('person_name', '-')
        record_id = acc.get('id', '')
        category = acc.get('category', 'Other')
        raw_data = acc.get('raw_data', {})
        
        if user_id not in password_usage:
            password_usage[user_id] = []
        
        password_usage[user_id].append({
            'id': record_id,
            'service': service,
            'username': username,
            'case_number': case_number,
            'device': device,
            'suspect': suspect,
            'url': service,  # For accounts, URL is same as service
            'category': category,
            'raw_data': raw_data,
            'type': 'account'
        })
    
    # Build result: only passwords used more than once OR interesting single uses
    results = []
    for password, usages in password_usage.items():
        usage_count = len(usages)
        
        # Group by service + username + case to avoid showing exact duplicates
        # But keep different services separate even if username is the same
        unique_services = {}
        for usage in usages:
            # Create a unique key that includes service, username, case, and device
            # This prevents duplicate rows but keeps different services separate
            service_key = f"{usage['service']}_{usage['username']}_{usage['case_number']}_{usage['device']}"
            if service_key not in unique_services:
                unique_services[service_key] = usage
        
        unique_usages = list(unique_services.values())
        unique_count = len(unique_usages)
        
        results.append({
            'password': password,
            'usage_count': unique_count,
            'usages': unique_usages,
            'is_reused': unique_count > 1
        })
    
    # Sort by usage count (most reused first)
    results.sort(key=lambda x: x['usage_count'], reverse=True)
    
    return results

@api_router.put("/credentials/{credential_id}/category")
async def update_credential_category(credential_id: str, request: dict):
    """Update the category of a credential"""
    try:
        new_category = request.get('category')
        if not new_category:
            raise HTTPException(status_code=400, detail="Category is required")
        
        # Update in both passwords and user_accounts collections
        # Try passwords first
        pwd_result = await db.passwords.update_one(
            {"id": credential_id},
            {"$set": {"category": new_category}}
        )
        
        # Try user_accounts
        acc_result = await db.user_accounts.update_one(
            {"id": credential_id},
            {"$set": {"category": new_category}}
        )
        
        if pwd_result.modified_count == 0 and acc_result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Credential not found")
        
        return {"success": True, "message": "Category updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating credential category: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update category: {str(e)}")


@api_router.get("/contacts/{contact_id}/details")
async def get_contact_details(contact_id: str):
    """Get all records for a specific contact (by phone or ID) including WhatsApp groups"""
    # First try to find by ID
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Get all contacts with same normalized phone
    phone = contact.get('phone')
    all_contacts = []
    whatsapp_groups = []
    
    if phone:
        # Normalize the phone to match against all variants
        normalized = normalize_phone(phone)
        
        # Find all contacts with this phone or any variant
        all_raw_contacts = await db.contacts.find({}, {"_id": 0}).to_list(10000)
        
        for c in all_raw_contacts:
            c_phone = c.get('phone')
            if c_phone and normalize_phone(c_phone) == normalized:
                all_contacts.append(c)
                if isinstance(c.get('created_at'), str):
                    c['created_at'] = datetime.fromisoformat(c['created_at'])
                
                # Collect WhatsApp groups this contact is member of
                if c.get('whatsapp_groups'):
                    for group_str in c['whatsapp_groups']:
                        if '@g.us' in group_str and group_str not in whatsapp_groups:
                            whatsapp_groups.append(group_str)
    
    # Parse WhatsApp groups into readable format
    parsed_groups = []
    for group_str in whatsapp_groups:
        if '@g.us' in group_str:
            parts = group_str.split(' ', 1)
            group_id = parts[0]
            group_name = parts[1] if len(parts) > 1 else group_id
            parsed_groups.append({
                'group_id': group_id,
                'group_name': group_name
            })
    
    return {
        "main_contact": contact,
        "all_records": all_contacts,
        "total_duplicates": len(all_contacts),
        "whatsapp_groups": parsed_groups
    }

@api_router.get("/filters/{data_type}")
async def get_filters(data_type: str):
    """Get available filter values for a data type"""
    if data_type == "contacts":
        sources = await db.contacts.distinct("source")
        categories = await db.contacts.distinct("category")
        devices = await db.contacts.distinct("device_info")
        cases = await db.contacts.distinct("case_number")
        suspects = await db.contacts.distinct("person_name")
        return {
            "sources": [s for s in sources if s],
            "categories": [c for c in categories if c],
            "devices": [d for d in devices if d],
            "cases": [c for c in cases if c],
            "suspects": [s for s in suspects if s]
        }
    elif data_type == "passwords":
        applications = await db.passwords.distinct("application")
        categories = await db.passwords.distinct("category")
        email_domains = await db.passwords.distinct("email_domain")
        devices = await db.passwords.distinct("device_info")
        cases = await db.passwords.distinct("case_number")
        suspects = await db.passwords.distinct("person_name")
        return {
            "applications": [a for a in applications if a],
            "categories": [c for c in categories if c],
            "email_domains": [e for e in email_domains if e],
            "devices": [d for d in devices if d],
            "cases": [c for c in cases if c],
            "suspects": [s for s in suspects if s]
        }
    elif data_type == "user_accounts":
        sources = await db.user_accounts.distinct("source")
        categories = await db.user_accounts.distinct("category")
        email_domains = await db.user_accounts.distinct("email_domain")
        devices = await db.user_accounts.distinct("device_info")
        cases = await db.user_accounts.distinct("case_number")
        suspects = await db.user_accounts.distinct("person_name")
        return {
            "sources": [s for s in sources if s],
            "categories": [c for c in categories if c],
            "email_domains": [e for e in email_domains if e],
            "devices": [d for d in devices if d],
            "cases": [c for c in cases if c],
            "suspects": [s for s in suspects if s]
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid data type")

@api_router.get("/whatsapp-groups")
async def get_whatsapp_groups():
    """Get all WhatsApp groups with member counts and details"""
    try:
        # Get all contacts that have WhatsApp groups
        contacts = await db.contacts.find(
            {"whatsapp_groups": {"$exists": True, "$ne": None, "$ne": []}},
            {"_id": 0, "id": 1, "name": 1, "phone": 1, "user_id": 1, "photo_path": 1, 
             "whatsapp_groups": 1, "case_number": 1, "person_name": 1, "device_info": 1}
        ).to_list(10000)
        
        # Build a map of groups to members
        groups_map = {}
        
        for contact in contacts:
            contact_info = {
                'id': contact.get('id'),
                'name': contact.get('name'),
                'phone': contact.get('phone'),
                'user_id': contact.get('user_id'),
                'photo_path': contact.get('photo_path'),
                'case_number': contact.get('case_number'),
                'person_name': contact.get('person_name'),
                'device_info': contact.get('device_info')
            }
            
            whatsapp_groups = contact.get('whatsapp_groups') or []
            for group_str in whatsapp_groups:
                if not group_str:
                    continue
                    
                # Parse group string: "40765261003-1601966684@g.us Group Name"
                if '@g.us' in group_str:
                    parts = group_str.split(' ', 1)
                    group_id = parts[0]
                    group_name = parts[1] if len(parts) > 1 else group_id
                    
                    if group_id not in groups_map:
                        groups_map[group_id] = {
                            'group_id': group_id,
                            'group_name': group_name,
                            'members': [],
                            'member_users_map': {},  # Map user_id to list of contact records
                            'member_count': 0,
                            'cases': set(),
                            'devices': set()
                        }
                    
                    # Smart deduplication: Track all sources per unique WhatsApp user_id
                    # This is better than phone because multiple people can share a phone
                    user_id = contact.get('user_id')
                    if user_id:
                        if user_id not in groups_map[group_id]['member_users_map']:
                            groups_map[group_id]['member_users_map'][user_id] = []
                        groups_map[group_id]['member_users_map'][user_id].append(contact_info)
                    else:
                        # No user_id - use phone as fallback
                        phone = contact.get('phone')
                        if phone:
                            normalized_phone = normalize_phone(phone)
                            unique_key = f"phone_{normalized_phone}"
                        else:
                            # No phone either - use name + device as identifier
                            unique_key = f"no_id_{contact.get('name')}_{contact.get('device_info')}"
                        
                        if unique_key not in groups_map[group_id]['member_users_map']:
                            groups_map[group_id]['member_users_map'][unique_key] = []
                        groups_map[group_id]['member_users_map'][unique_key].append(contact_info)
                    
                    if contact.get('case_number'):
                        groups_map[group_id]['cases'].add(contact.get('case_number'))
                    if contact.get('device_info'):
                        groups_map[group_id]['devices'].add(contact.get('device_info'))
        
        # Convert to list and calculate member counts
        groups_list = []
        for group_id, group_data in groups_map.items():
            # Convert member_users_map to members list with source info
            members_with_sources = []
            for user_id_or_key, contact_list in group_data['member_users_map'].items():
                # Use the first contact as primary, but include source count and all sources
                primary_contact = contact_list[0]
                member_entry = {
                    'id': primary_contact['id'],
                    'name': primary_contact['name'],
                    'phone': primary_contact['phone'],
                    'user_id': primary_contact['user_id'],
                    'photo_path': primary_contact['photo_path'],
                    'case_number': primary_contact['case_number'],
                    'person_name': primary_contact['person_name'],
                    'device_info': primary_contact['device_info'],
                    'source_count': len(contact_list),
                    'all_sources': contact_list  # Include all source records
                }
                members_with_sources.append(member_entry)
            
            group_data['members'] = members_with_sources
            group_data['member_count'] = len(members_with_sources)  # Unique member count
            group_data['cases'] = list(group_data['cases'])
            group_data['devices'] = list(group_data['devices'])
            # Remove the temporary map
            group_data.pop('member_users_map', None)
            groups_list.append(group_data)
        
        # Sort by member count (descending)
        groups_list.sort(key=lambda x: x['member_count'], reverse=True)
        
        return groups_list
        
    except Exception as e:
        import traceback
        logger.error(f"Error getting WhatsApp groups: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/whatsapp-groups/{group_id}/members")
async def get_group_members(group_id: str):
    """Get all members of a specific WhatsApp group"""
    try:
        # Find all contacts that belong to this group
        contacts = await db.contacts.find(
            {"whatsapp_groups": {"$regex": f"^{group_id}"}},
            {"_id": 0}
        ).to_list(10000)
        
        # Convert datetime strings
        for contact in contacts:
            if isinstance(contact.get('created_at'), str):
                contact['created_at'] = datetime.fromisoformat(contact['created_at'])
        
        return contacts
        
    except Exception as e:
        logger.error(f"Error getting group members: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/discord-accounts")
async def get_discord_accounts():
    """Get all Discord accounts"""
    try:
        accounts = await db.user_accounts.find(
            {"source": "Discord"},
            {"_id": 0}
        ).to_list(10000)
        return accounts
    except Exception as e:
        logger.error(f"Error getting Discord accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Export Models and Endpoints
class ExportRequest(BaseModel):
    export_type: str = "full"  # "full" or "wordlist"
    case_number: Optional[str] = None
    category: Optional[str] = None
    application: Optional[str] = None
    email_domain: Optional[str] = None
    device: Optional[str] = None
    person_name: Optional[str] = None

@api_router.post("/passwords/export")
async def export_passwords(request: ExportRequest):
    """
    Unified Export with Fix for 'Type' Filter (e.g., 'Default')
    """
    try:
        # 1. Build Base Query
        base_query = {}
        
        if request.case_number and request.case_number != "all":
            base_query["case_number"] = request.case_number
            
        if request.device and request.device != "all":
            base_query["device_info"] = request.device
            
        if request.person_name and request.person_name != "all":
            base_query["person_name"] = request.person_name

        # 2. Handle 'Category/Type' Filter (The Fix)
        # We must check calculated 'category', 'service_type', AND raw XML 'Type'
        if request.category and request.category != "all":
            base_query["$or"] = [
                {"category": request.category},
                {"service_type": request.category},
                {"raw_data.fields.Type": request.category}
            ]

        # 3. Fetch Passwords
        pwd_query = base_query.copy()
        if request.application and request.application != "all":
            pwd_query["application"] = request.application
            
        passwords = await db.passwords.find(pwd_query, {"_id": 0}).to_list(10000)
        
        # 4. Fetch User Accounts
        # (Map 'application' filter to 'source' or 'service_identifier' for accounts)
        acc_query = base_query.copy()
        if request.application and request.application != "all":
            # For accounts, the "Service" filter might match source OR service_identifier
            if "$or" in acc_query:
                # If we already have an $or from category, we need to use $and
                existing_or = acc_query.pop("$or")
                acc_query["$and"] = [
                    {"$or": existing_or},
                    {"$or": [
                        {"source": request.application},
                        {"service_identifier": request.application}
                    ]}
                ]
            else:
                acc_query["$or"] = [
                    {"source": request.application},
                    {"service_identifier": request.application}
                ]
            
        accounts = await db.user_accounts.find(acc_query, {"_id": 0}).to_list(10000)

        # 5. Generate Output
        output = io.StringIO()
        
        if request.export_type == "wordlist":
            # Wordlist Mode
            unique_items = set()
            for p in passwords:
                if p.get('password') and len(p['password'].strip()) > 0: 
                    unique_items.add(p['password'].strip())
            
            for item in sorted(unique_items):
                output.write(f"{item}\n")
            
            filename = "wordlist.txt"
            media_type = "text/plain"
            
        else:
            # Full CSV Mode
            writer = csv.writer(output)
            headers = [
                'Type', 'Case Number', 'Suspect', 'Device', 
                'Source/App', 'Username/Email', 'Password/Data', 
                'Category', 'Service Type', 'Description/Notes', 'URL', 'Created At'
            ]
            writer.writerow(headers)
            
            # Write Passwords
            for p in passwords:
                writer.writerow([
                    'Password',
                    p.get('case_number', ''),
                    p.get('person_name', ''),
                    p.get('device_info', ''),
                    p.get('application', ''),
                    p.get('username', ''),
                    p.get('password', ''),
                    p.get('category', ''),
                    '-', # No service type for passwords
                    p.get('description', ''),
                    p.get('url', ''),
                    p.get('created_at', '')
                ])
                
            # Write Accounts
            for a in accounts:
                user_email = a.get('username', '')
                if a.get('email') and a.get('email') != user_email:
                    user_email = f"{user_email} ({a.get('email')})" if user_email else a.get('email')
                
                # Get the "Type" from raw fields if service_type is missing
                svc_type = a.get('service_type') or a.get('raw_data', {}).get('fields', {}).get('Type', '')
                
                writer.writerow([
                    'Account',
                    a.get('case_number', ''),
                    a.get('person_name', ''),
                    a.get('device_info', ''),
                    a.get('source', ''),
                    user_email,
                    a.get('user_id', ''),
                    a.get('category', ''),
                    svc_type,
                    a.get('notes', ''),
                    a.get('service_identifier', ''),
                    a.get('created_at', '')
                ])
                
            filename = f"credentials_export_{datetime.now().strftime('%Y%m%d')}.csv"
            media_type = "text/csv"

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return StreamingResponse(
            io.BytesIO(f"Error exporting data: {str(e)}".encode('utf-8')),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=error_log.txt"}
        )

@api_router.get("/suspect-info")
async def get_suspect_info():
    """Get suspect information for all cases"""
    try:
        # Get all unique cases with their suspect phones
        contacts = await db.contacts.find({}, {"_id": 0, "case_number": 1, "person_name": 1, "suspect_phone": 1, "phone": 1, "photo_path": 1, "device_info": 1}).to_list(10000)
        
        # Build a map of case -> suspect info
        case_suspects = {}
        
        for contact in contacts:
            case_number = contact.get('case_number')
            suspect_phone = contact.get('suspect_phone')
            
            if not case_number or not suspect_phone:
                continue
            
            # Initialize case entry if not exists
            if case_number not in case_suspects:
                case_suspects[case_number] = {
                    'case_number': case_number,
                    'person_name': contact.get('person_name'),
                    'device_info': contact.get('device_info'),
                    'suspect_phone': suspect_phone,
                    'suspect_photo_path': None
                }
            
            # Check if this contact IS the suspect (phone matches suspect_phone)
            contact_phone = contact.get('phone', '')
            if contact_phone and contact.get('photo_path'):
                # Normalize both phones for comparison
                normalized_contact = normalize_phone(contact_phone)
                normalized_suspect = normalize_phone(suspect_phone)
                
                # If phones match, this is the suspect's photo
                if normalized_contact == normalized_suspect or \
                   (len(normalized_contact) >= 9 and len(normalized_suspect) >= 9 and \
                    normalized_contact[-9:] == normalized_suspect[-9:]):
                    case_suspects[case_number]['suspect_photo_path'] = contact.get('photo_path')
        
        return list(case_suspects.values())
        
    except Exception as e:
        logger.error(f"Error getting suspect info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/contacts-by-photo")
async def get_contacts_by_photo(case_number: str):
    """Get all contacts grouped by photo for a specific case to help identify suspects in photos"""
    try:
        # Get all contacts for this case with photos
        contacts = await db.contacts.find(
            {"case_number": case_number, "photo_path": {"$ne": None}},
            {"_id": 0}
        ).to_list(10000)
        
        # Group contacts by photo
        photo_groups = {}
        suspect_phone = None
        
        for contact in contacts:
            photo = contact.get('photo_path')
            if not photo:
                continue
                
            # Track suspect phone
            if not suspect_phone and contact.get('suspect_phone'):
                suspect_phone = contact.get('suspect_phone')
            
            if photo not in photo_groups:
                photo_groups[photo] = {
                    'photo_path': photo,
                    'contacts': [],
                    'suspect_phone': suspect_phone,
                    'contains_suspect_number': False
                }
            
            # Check if this contact has the suspect's phone number
            if suspect_phone and contact.get('phone'):
                normalized_contact = normalize_phone(contact.get('phone'))
                normalized_suspect = normalize_phone(suspect_phone)
                if (len(normalized_contact) >= 9 and len(normalized_suspect) >= 9 and 
                    normalized_contact[-9:] == normalized_suspect[-9:]):
                    photo_groups[photo]['contains_suspect_number'] = True
            
            photo_groups[photo]['contacts'].append({
                'id': contact.get('id'),
                'name': contact.get('name'),
                'phone': contact.get('phone'),
                'source': contact.get('source'),
                'user_id': contact.get('user_id')
            })
        
        # Convert to list and sort by number of contacts (most shared photos first)
        result = sorted(photo_groups.values(), key=lambda x: len(x['contacts']), reverse=True)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting contacts by photo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/cleanup-photos")
async def cleanup_incorrect_photos():
    """Remove photos from contacts that incorrectly have the suspect's photo"""
    try:
        # Get all contacts
        contacts = await db.contacts.find({}, {"_id": 0}).to_list(10000)
        
        cleaned_count = 0
        total_with_photos = 0
        
        # Group contacts by case to get suspect phone for each case
        case_suspect_phones = {}
        for contact in contacts:
            case_number = contact.get('case_number')
            suspect_phone = contact.get('suspect_phone')
            if case_number and suspect_phone and case_number not in case_suspect_phones:
                case_suspect_phones[case_number] = suspect_phone
        
        # Process each contact
        for contact in contacts:
            photo_path = contact.get('photo_path')
            if not photo_path:
                continue
            
            total_with_photos += 1
            contact_phone = contact.get('phone', '')
            case_number = contact.get('case_number')
            suspect_phone = case_suspect_phones.get(case_number)
            
            if not contact_phone or not suspect_phone:
                continue
            
            # Normalize phones for comparison
            normalized_contact = normalize_phone(contact_phone)
            normalized_suspect = normalize_phone(suspect_phone)
            
            # Check if this contact IS the suspect
            is_suspect = False
            if len(normalized_contact) >= 9 and len(normalized_suspect) >= 9:
                # Compare last 9 digits (to handle different country code formats)
                if normalized_contact[-9:] == normalized_suspect[-9:]:
                    is_suspect = True
            
            # If this contact is NOT the suspect but has a photo, it might be wrong
            # We'll be conservative: only remove photos from contacts that are definitely not the suspect
            # and don't have their own identifying information
            if not is_suspect:
                # Check if the contact name suggests it's not a person (like "Camel", "DIGI", etc.)
                # or if it's a service/company name
                contact_name = (contact.get('name') or '').strip().upper()
                
                # List of known Romanian telecom/service providers and generic names
                service_names = ['CAMEL', 'DIGI', 'ORANGE', 'VODAFONE', 'TELEKOM', 'RCS', 'RDS', 
                                'UPC', 'COSMOTE', 'YOXO', 'PRIVAT', 'UNKNOWN', 'NECUNOSCUT']
                
                # If the contact name is a service or the contact is suspicious, remove the photo
                should_remove = False
                
                # Remove if it's a known service name
                if any(service in contact_name for service in service_names):
                    should_remove = True
                
                # Also remove if contact name is very short (1-2 chars) or all digits
                if len(contact_name) <= 2 or contact_name.isdigit():
                    should_remove = True
                
                if should_remove:
                    # Remove the photo_path from this contact
                    await db.contacts.update_one(
                        {'id': contact.get('id')},
                        {'$unset': {'photo_path': ''}}
                    )
                    cleaned_count += 1
                    logger.info(f"Removed photo from contact: {contact.get('name')} ({contact.get('phone')})")
        
        return {
            'success': True,
            'total_contacts_with_photos': total_with_photos,
            'photos_removed': cleaned_count,
            'message': f'Successfully cleaned {cleaned_count} incorrect photos from {total_with_photos} contacts with photos'
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up photos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/suspect-profile")
async def get_suspect_profile(case_number: Optional[str] = None):
    """Get suspect profile by case number"""
    try:
        if case_number:
            profile = await db.suspect_profiles.find_one({'case_number': case_number}, {"_id": 0})
            if not profile:
                raise HTTPException(status_code=404, detail=f"No suspect profile found for case {case_number}")
            
            # Convert datetime fields
            if isinstance(profile.get('created_at'), str):
                profile['created_at'] = datetime.fromisoformat(profile['created_at'])
            if isinstance(profile.get('updated_at'), str):
                profile['updated_at'] = datetime.fromisoformat(profile['updated_at'])
            
            return profile
        else:
            # Return all profiles
            profiles = await db.suspect_profiles.find({}, {"_id": 0}).to_list(1000)
            for profile in profiles:
                if isinstance(profile.get('created_at'), str):
                    profile['created_at'] = datetime.fromisoformat(profile['created_at'])
                if isinstance(profile.get('updated_at'), str):
                    profile['updated_at'] = datetime.fromisoformat(profile['updated_at'])
            return profiles
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching suspect profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/suspect-image/{case_number}/{filename}")
async def get_suspect_image(case_number: str, filename: str):
    """Serve suspect profile image (unique per person)"""
    try:
        # Sanitize case number and filename for filesystem
        safe_case = case_number.replace('/', '_')
        safe_filename = filename.replace('/', '_').replace('\\', '_')
        
        # Support both old (me.jpg) and new (PersonName_me.jpg) filenames
        image_path = Path('/app/uploads') / safe_case / safe_filename
        
        if not image_path.exists():
            # Try fallback to old naming convention
            fallback_path = Path('/app/uploads') / safe_case / 'me.jpg'
            if fallback_path.exists():
                image_path = fallback_path
            else:
                raise HTTPException(status_code=404, detail=f"No profile image found for case {case_number}/{filename}")
        
        # Return image as streaming response
        def iterfile():
            with open(image_path, mode="rb") as file_like:
                yield from file_like
        
        return StreamingResponse(iterfile(), media_type="image/jpeg")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving suspect image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/clear-database")
async def clear_entire_database():
    """Delete all data from the database (contacts, passwords, user_accounts, suspect_profiles) and uploaded images"""
    try:
        # Delete all collections
        contacts_result = await db.contacts.delete_many({})
        passwords_result = await db.passwords.delete_many({})
        accounts_result = await db.user_accounts.delete_many({})
        profiles_result = await db.suspect_profiles.delete_many({})
        
        # Delete all uploaded images
        uploads_dir = Path('/app/uploads')
        deleted_images = 0
        if uploads_dir.exists():
            for img_file in uploads_dir.glob('*.jpg'):
                try:
                    img_file.unlink()
                    deleted_images += 1
                except Exception as e:
                    logger.error(f"Error deleting image {img_file}: {str(e)}")
            
            # Also delete case directories
            for case_dir in uploads_dir.iterdir():
                if case_dir.is_dir():
                    try:
                        shutil.rmtree(case_dir)
                    except Exception as e:
                        logger.error(f"Error deleting case directory {case_dir}: {str(e)}")
        
        logger.info(f"Database cleared: {contacts_result.deleted_count} contacts, {passwords_result.deleted_count} passwords, {accounts_result.deleted_count} user accounts, {profiles_result.deleted_count} suspect profiles, {deleted_images} images")
        
        return {
            'success': True,
            'contacts_deleted': contacts_result.deleted_count,
            'passwords_deleted': passwords_result.deleted_count,
            'user_accounts_deleted': accounts_result.deleted_count,
            'suspect_profiles_deleted': profiles_result.deleted_count,
            'images_deleted': deleted_images,
            'message': f'Successfully cleared entire database: {contacts_result.deleted_count} contacts, {passwords_result.deleted_count} passwords, {accounts_result.deleted_count} user accounts, {profiles_result.deleted_count} suspect profiles, and {deleted_images} images deleted'
        }
        
    except Exception as e:
        logger.error(f"Error clearing database: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# ADMIN ENDPOINTS
# ============================================

@api_router.post("/admin/login")
async def admin_login(credentials: dict):
    """Authenticate admin user"""
    username = credentials.get('username')
    password = credentials.get('password')
    
    admin_username = os.environ.get('ADMIN_USERNAME', 'admin')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'dcco2024')
    
    if username == admin_username and password == admin_password:
        return {'success': True, 'message': 'Authentication successful'}
    else:
        raise HTTPException(status_code=401, detail='Invalid credentials')

@api_router.get("/admin/cases")
async def get_all_cases():
    """Get all cases with their upload sessions (grouped by person + device)"""
    try:
        # Get all suspect profiles which represent upload sessions
        suspects = await db.suspect_profiles.find({}, {"_id": 0}).to_list(1000)
        
        # Group by case number
        cases_map = {}
        
        for suspect in suspects:
            case = suspect.get('case_number')
            if not case:
                continue
            
            if case not in cases_map:
                cases_map[case] = {
                    'case_number': case,
                    'sessions': []
                }
            
            # Use person_name (which is actually used in contacts/passwords/accounts)
            person_name = suspect.get('person_name') or suspect.get('suspect_name')
            device = suspect.get('device_info')
            
            contacts_count = await db.contacts.count_documents({
                "case_number": case,
                "person_name": person_name,
                "device_info": device
            })
            
            passwords_count = await db.passwords.count_documents({
                "case_number": case,
                "person_name": person_name,
                "device_info": device
            })
            
            accounts_count = await db.user_accounts.count_documents({
                "case_number": case,
                "person_name": person_name,
                "device_info": device
            })
            
            # Create session object with timestamp to handle multiple uploads of same person+device
            session = {
                'session_id': f"{case}_{person_name}_{device}_{suspect.get('created_at', '')}",
                'person_name': person_name,
                'device_info': device,
                'contacts': contacts_count,
                'passwords': passwords_count,
                'user_accounts': accounts_count,
                'total': contacts_count + passwords_count + accounts_count,
                'uploaded_at': suspect.get('created_at', 'Unknown'),
                'profile_id': suspect.get('id', '')
            }
            
            cases_map[case]['sessions'].append(session)
        
        # Convert to list and calculate totals per case
        cases_list = []
        for case_number, case_data in sorted(cases_map.items()):
            total_contacts = sum(s['contacts'] for s in case_data['sessions'])
            total_passwords = sum(s['passwords'] for s in case_data['sessions'])
            total_accounts = sum(s['user_accounts'] for s in case_data['sessions'])
            
            cases_list.append({
                'case_number': case_number,
                'sessions': case_data['sessions'],
                'totals': {
                    'contacts': total_contacts,
                    'passwords': total_passwords,
                    'user_accounts': total_accounts,
                    'total': total_contacts + total_passwords + total_accounts
                }
            })
        
        return cases_list
        
    except Exception as e:
        logger.error(f"Error getting cases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/sessions/{case_number}/{person_name}/{device_info}")
async def delete_session(case_number: str, person_name: str, device_info: str):
    """Delete a specific upload session (person + device) and all its related data - DEPRECATED, use delete_session_by_profile"""
    try:
        logger.info(f"Deleting session: {case_number}/{person_name}/{device_info}")
        
        # Delete from all collections for this specific session
        contacts_result = await db.contacts.delete_many({
            "case_number": case_number,
            "person_name": person_name,
            "device_info": device_info
        })
        
        passwords_result = await db.passwords.delete_many({
            "case_number": case_number,
            "person_name": person_name,
            "device_info": device_info
        })
        
        accounts_result = await db.user_accounts.delete_many({
            "case_number": case_number,
            "person_name": person_name,
            "device_info": device_info
        })
        
        profiles_result = await db.suspect_profiles.delete_many({
            "case_number": case_number,
            "person_name": person_name,
            "device_info": device_info
        })
        
        # Delete images for this specific session
        deleted_images = 0
        session_dir = uploads_dir / sanitize_filename(case_number) / sanitize_filename(person_name) / sanitize_filename(device_info)
        if session_dir.exists():
            import shutil
            shutil.rmtree(session_dir)
            deleted_images = contacts_result.deleted_count
        
        logger.info(f"Session deleted: {contacts_result.deleted_count} contacts, {passwords_result.deleted_count} passwords, {accounts_result.deleted_count} user accounts")
        
        return {
            'success': True,
            'session_id': f"{case_number}/{person_name}/{device_info}",
            'contacts_deleted': contacts_result.deleted_count,
            'passwords_deleted': passwords_result.deleted_count,
            'user_accounts_deleted': accounts_result.deleted_count,
            'suspect_profiles_deleted': profiles_result.deleted_count,
            'images_deleted': deleted_images,
            'message': f'Successfully deleted session {case_number}/{person_name}/{device_info}'
        }
        
    except Exception as e:
        logger.error(f"Error deleting session {case_number}/{person_name}/{device_info}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/sessions/by-profile/{profile_id}")
async def delete_session_by_profile(profile_id: str):
    """Delete a specific upload session by profile ID"""
    try:
        # Get the suspect profile first
        profile = await db.suspect_profiles.find_one({"id": profile_id}, {"_id": 0})
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        case_number = profile.get('case_number')
        person_name = profile.get('person_name')
        device_info = profile.get('device_info')
        
        logger.info(f"Deleting session by profile_id {profile_id}: {case_number}/{person_name}/{device_info}")
        
        # Delete from all collections for this specific profile's upload
        # Note: We can't use upload_timestamp because contacts/passwords/accounts don't have that field
        # So we delete by case_number + person_name + device_info
        # This means if there are multiple uploads of same person/device, we delete ALL of them
        # TODO: Add upload_timestamp to contacts/passwords/accounts during upload to enable precise deletion
        contacts_result = await db.contacts.delete_many({
            "case_number": case_number,
            "person_name": person_name,
            "device_info": device_info
        })
        
        passwords_result = await db.passwords.delete_many({
            "case_number": case_number,
            "person_name": person_name,
            "device_info": device_info
        })
        
        accounts_result = await db.user_accounts.delete_many({
            "case_number": case_number,
            "person_name": person_name,
            "device_info": device_info
        })
        
        # Delete the profile itself
        profiles_result = await db.suspect_profiles.delete_one({"id": profile_id})
        
        # Delete images - need to find the specific subfolder
        # Since we might have multiple sessions, we can't delete the whole directory
        # For now, we'll skip image deletion or implement a more sophisticated approach
        
        logger.info(f"Session deleted: {contacts_result.deleted_count} contacts, {passwords_result.deleted_count} passwords, {accounts_result.deleted_count} user accounts")
        
        return {
            'success': True,
            'profile_id': profile_id,
            'contacts_deleted': contacts_result.deleted_count,
            'passwords_deleted': passwords_result.deleted_count,
            'user_accounts_deleted': accounts_result.deleted_count,
            'suspect_profiles_deleted': profiles_result.deleted_count,
            'message': f'Successfully deleted session for {person_name} ({device_info})'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session by profile {profile_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/cleanup-groups")
async def cleanup_groups_from_contacts():
    """Remove WhatsApp groups that were incorrectly added to contacts"""
    try:
        # Find and delete contacts where user_id contains @g.us or @broadcast
        result = await db.contacts.delete_many({
            "$or": [
                {"user_id": {"$regex": "@g.us"}},
                {"user_id": {"$regex": "@broadcast"}},
                {"phone": {"$regex": "@g.us"}},
                {"phone": {"$regex": "@broadcast"}}
            ]
        })
        
        logger.info(f"Cleaned up {result.deleted_count} group records from contacts")
        
        return {
            'success': True,
            'deleted_count': result.deleted_count,
            'message': f'Removed {result.deleted_count} WhatsApp groups from contacts'
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up groups: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/admin/cases/{case_number}")
async def delete_case(case_number: str):
    """Delete a specific case and all its related data"""
    try:
        logger.info(f"Deleting case: {case_number}")
        
        # Delete from all collections
        contacts_result = await db.contacts.delete_many({"case_number": case_number})
        passwords_result = await db.passwords.delete_many({"case_number": case_number})
        accounts_result = await db.user_accounts.delete_many({"case_number": case_number})
        profiles_result = await db.suspect_profiles.delete_many({"case_number": case_number})
        
        # Delete images for this case
        deleted_images = 0
        case_dir = uploads_dir / sanitize_filename(case_number)
        if case_dir.exists():
            import shutil
            shutil.rmtree(case_dir)
            # Count files deleted (approximate)
            deleted_images = contacts_result.deleted_count  # Rough estimate
        
        logger.info(f"Case {case_number} deleted: {contacts_result.deleted_count} contacts, {passwords_result.deleted_count} passwords, {accounts_result.deleted_count} user accounts, {profiles_result.deleted_count} suspect profiles")
        
        return {
            'success': True,
            'case_number': case_number,
            'contacts_deleted': contacts_result.deleted_count,
            'passwords_deleted': passwords_result.deleted_count,
            'user_accounts_deleted': accounts_result.deleted_count,
            'suspect_profiles_deleted': profiles_result.deleted_count,
            'images_deleted': deleted_images,
            'message': f'Successfully deleted case {case_number}'
        }
        
    except Exception as e:
        logger.error(f"Error deleting case {case_number}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()