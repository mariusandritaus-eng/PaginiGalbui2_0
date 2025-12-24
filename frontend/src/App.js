import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "@/App.css";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Search, Database, Users, Key, Shield, Filter, X, ChevronDown, ChevronRight, MessageCircle, Download, Instagram, Facebook, Twitter, Send, Music, Share2, Mail, Eye, Home } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = BACKEND_URL;

function App() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [passwordAnalysis, setPasswordAnalysis] = useState([]); // New: password reuse analysis
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  const [suspectInfo, setSuspectInfo] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ contacts: 0, passwords: 0, user_accounts: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("contacts");
  const [selectedCase, setSelectedCase] = useState(""); // For top-level case filter
  const [availableCases, setAvailableCases] = useState([]);

  // Normalize ServiceIdentifier for beautiful display
  const normalizeServiceIdentifier = (serviceId) => {
    if (!serviceId) return '-';
    
    let normalized = serviceId;
    
    // Remove https:// and http://
    normalized = normalized.replace(/^https?:\/\//, '');
    
    // Remove www.
    normalized = normalized.replace(/^www\./, '');
    
    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');
    
    // Remove // anywhere
    normalized = normalized.replace(/\/\//g, '/');
    
    return normalized;
  };
  
  // Upload form state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [caseNumber, setCaseNumber] = useState("");
  const [personName, setPersonName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Contact detail modal
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactDetails, setContactDetails] = useState(null);
  
  // Credential detail modal
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [credentialDetails, setCredentialDetails] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedEntries, setExpandedEntries] = useState({}); // Track Level 2 expansion
  const [editingCategory, setEditingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  
  // WhatsApp group detail modal
  const [selectedWhatsappGroup, setSelectedWhatsappGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  
  // Suspect detail modal
  const [selectedSuspect, setSelectedSuspect] = useState(null);
  
  // Export dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState("wordlist");
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    contacts: { source: "all", category: "all", device: "all", case: "all", suspect: "all", hasName: "all", hasPhoto: "all" },
    credentials: { application: "all", email_domain: "all", device: "all", case: "all", suspect: "all", account: "all", service: "all", type: "all" },
    whatsapp_groups: { device: "all", suspect: "all", case: "all" }
  });
  const [availableFilters, setAvailableFilters] = useState({
    contacts: {},
    credentials: {}
  });

  useEffect(() => {
    loadData();
    loadStats();
    loadFilters();
    loadWhatsappGroups();
    loadSuspectInfo();
    loadPasswordAnalysis(); // Load password analysis
  }, []);

  // Handle URL query parameters from landing page
  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    const caseFromUrl = searchParams.get('case');
    
    if (searchFromUrl) {
      setSearchQuery(searchFromUrl);
    }
    if (caseFromUrl) {
      setSelectedCase(caseFromUrl);
    }
  }, [searchParams]);

  const loadData = async (useDedup = true) => {
    try {
      const contactsEndpoint = useDedup ? `${API}/contacts/deduplicated` : `${API}/contacts`;
      const credentialsEndpoint = useDedup ? `${API}/credentials/deduplicated` : `${API}/passwords`;
      
      const [contactsRes, credentialsRes] = await Promise.all([
        axios.get(contactsEndpoint),
        axios.get(credentialsEndpoint)
      ]);
      
      setContacts(contactsRes.data);
      setCredentials(credentialsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const loadWhatsappGroups = async () => {
    try {
      const response = await axios.get(`${API}/whatsapp-groups`);
      setWhatsappGroups(response.data);
    } catch (error) {
      console.error("Error loading WhatsApp groups:", error);
      // Don't show error toast as this is a new feature and may not have data
    }
  };

  const loadSuspectInfo = async () => {
    try {
      const response = await axios.get(`${API}/suspect-profile`);
      setSuspectInfo(response.data);
    } catch (error) {
      console.error("Error loading suspect info:", error);
    }
  };

  const loadPasswordAnalysis = async () => {
    try {
      const response = await axios.get(`${API}/credentials/password-analysis`);
      setPasswordAnalysis(response.data);
    } catch (error) {
      console.error("Error loading password analysis:", error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadFilters = async () => {
    try {
      const [contactFilters, passwordFilters, accountFilters] = await Promise.all([
        axios.get(`${API}/filters/contacts`),
        axios.get(`${API}/filters/passwords`),
        axios.get(`${API}/filters/user_accounts`)
      ]);
      
      // Get all unique case numbers for top-level filter
      const allCases = [...new Set([
        ...(contactFilters.data.cases || []),
        ...(passwordFilters.data.cases || []),
        ...(accountFilters.data.cases || [])
      ])].filter(c => c).sort();
      setAvailableCases(allCases);
      
      // Merge password and account filters for credentials
      const credentialCategories = [...new Set([
        ...(passwordFilters.data.categories || []),
        ...(accountFilters.data.categories || [])
      ])];
      
      const credentialApplications = [...new Set([
        ...(passwordFilters.data.applications || [])
      ])];
      
      const credentialSources = [...new Set([
        ...(accountFilters.data.sources || [])
      ])];
      
      const credentialEmailDomains = [...new Set([
        ...(passwordFilters.data.email_domains || []),
        ...(accountFilters.data.email_domains || [])
      ])];
      
      const credentialDevices = [...new Set([
        ...(passwordFilters.data.devices || []),
        ...(accountFilters.data.devices || [])
      ])];
      
      const credentialCases = [...new Set([
        ...(passwordFilters.data.cases || []),
        ...(accountFilters.data.cases || [])
      ])];
      
      const credentialSuspects = [...new Set([
        ...(passwordFilters.data.suspects || []),
        ...(accountFilters.data.suspects || [])
      ])];
      
      // Get unique accounts and services from credentials
      setAvailableFilters({
        contacts: contactFilters.data,
        credentials: {
          categories: credentialCategories,
          applications: credentialApplications,
          sources: credentialSources,
          email_domains: credentialEmailDomains,
          devices: credentialDevices,
          cases: credentialCases,
          suspects: credentialSuspects
        }
      });
    } catch (error) {
      console.error("Error loading filters:", error);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.zip')) {
      setSelectedFile(file);
      setShowUploadDialog(true);
    } else {
      toast.error("Please select a ZIP file");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !caseNumber || !personName) {
      toast.error("Please fill all fields");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('case_number', caseNumber);
    formData.append('person_name', personName);

    try {
      const response = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success(
        `Upload successful! Parsed ${response.data.contacts} contacts, ${response.data.passwords} passwords, ${response.data.user_accounts} accounts`
      );
      
      setShowUploadDialog(false);
      setCaseNumber("");
      setPersonName("");
      setSelectedFile(null);
      
      await loadData();
      await loadStats();
      await loadFilters();
      await loadWhatsappGroups();
      await loadSuspectInfo();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Normalize text for search (remove diacritics/accents)
  const normalizeText = (text) => {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  };

  // Real-time client-side search - no API call needed
  const performSearch = (query, dataset, dataType = null) => {
    if (!query || query.trim() === "") return dataset;
    
    const searchTerm = normalizeText(query.trim());
    const isPhoneSearch = /^\d+$/.test(query.trim()) && query.trim().length >= 3; // Looks like a phone number
    
    return dataset.filter(item => {
      // For contacts: if searching phone numbers, ONLY search in phone field
      if (dataType === 'contacts' && isPhoneSearch) {
        const phoneOnly = normalizeText(item.phone || '');
        return phoneOnly.includes(searchTerm);
      }
      
      // For contacts with all_names array, search in all names
      if (dataType === 'contacts' && item.all_names && item.all_names.length > 0) {
        const allNamesText = item.all_names.map(n => normalizeText(n)).join(' ');
        if (allNamesText.includes(searchTerm)) {
          return true;
        }
      }
      
      // For WhatsApp groups: search in group name AND members
      if (dataType === 'whatsapp') {
        // Search in group name
        const groupName = normalizeText(item.group_name || '');
        if (groupName.includes(searchTerm)) {
          return true;
        }
        
        // Search in members (name, phone)
        if (item.members && Array.isArray(item.members)) {
          const memberMatch = item.members.some(member => {
            const memberName = normalizeText(member.name || '');
            const memberPhone = normalizeText(member.phone || '');
            const memberPersonName = normalizeText(member.person_name || '');
            return memberName.includes(searchTerm) || 
                   memberPhone.includes(searchTerm) || 
                   memberPersonName.includes(searchTerm);
          });
          if (memberMatch) {
            return true;
          }
        }
        
        // Also search in other group fields
        const searchableText = Object.entries(item)
          .filter(([key, val]) => {
            if (key === 'members') return false; // Already handled above
            return typeof val === 'string' || typeof val === 'number';
          })
          .map(([key, val]) => normalizeText(val))
          .join(' ');
        
        return searchableText.includes(searchTerm);
      }
      
      // For other searches, search in all string/number fields
      const searchableText = Object.entries(item)
        .filter(([key, val]) => {
          // Skip raw_data for performance
          if (key === 'raw_data') return false;
          // Skip all_names since we handled it above
          if (key === 'all_names') return false;
          return typeof val === 'string' || typeof val === 'number';
        })
        .map(([key, val]) => normalizeText(val))
        .join(' ');
      
      return searchableText.includes(searchTerm);
    });
  };

  const handleContactClick = async (contact) => {
    try {
      const response = await axios.get(`${API}/contacts/${contact.id}/details`);
      setContactDetails(response.data);
      setSelectedContact(contact);
    } catch (error) {
      console.error("Error loading contact details:", error);
      toast.error("Failed to load contact details");
    }
  };

  const handleCredentialClick = async (credential) => {
    try {
      const response = await axios.get(`${API}/credentials/${credential.id}/details`);
      setCredentialDetails(response.data);
      setSelectedCredential(credential);
    } catch (error) {
      console.error("Error loading credential details:", error);
      toast.error("Failed to load credential details");
    }
  };

  const handleWhatsappGroupClick = async (group) => {
    setSelectedWhatsappGroup(group);
    setGroupMembers(group.members || []);
  };

  const handleUpdateCredentialCategory = async (credentialId, newCategory) => {
    try {
      await axios.put(`${API}/credentials/${credentialId}/category`, {
        category: newCategory
      });
      
      // Update local state
      setSelectedCredential(prev => ({
        ...prev,
        category: newCategory
      }));
      
      // Reload data to reflect changes
      loadData();
      
      toast.success("Category updated successfully!");
      setEditingCategory(false);
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
    }
  };

  const handleExportCredentials = async () => {
    setExporting(true);
    try {
      const exportData = {
        export_type: exportType,
        case_number: filters.credentials.case !== "all" ? filters.credentials.case : null,
        application: filters.credentials.service !== "all" ? filters.credentials.service : null,
        email_domain: null, // Not currently used in filters
        device: filters.credentials.device !== "all" ? filters.credentials.device : null,
        person_name: filters.credentials.suspect !== "all" ? filters.credentials.suspect : null,
        category: filters.credentials.type !== "all" ? filters.credentials.type : null
      };

      const response = await axios.post(`${API}/passwords/export`, exportData, {
        responseType: 'blob'
      });

      // Create download link
      const filename = exportType === "wordlist" 
        ? "passwords_wordlist.txt" 
        : "passwords_full_export.csv";
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${exportType === "wordlist" ? "wordlist" : "full data"} successfully!`);
      setShowExportDialog(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const applyFilters = (data, dataType) => {
    const currentFilters = filters[dataType];
    if (!currentFilters) return data;
    
    return data.filter(item => {
      if (currentFilters.source && currentFilters.source !== "all" && item.source !== currentFilters.source) return false;
      if (currentFilters.category && currentFilters.category !== "all" && item.category !== currentFilters.category) return false;
      if (currentFilters.application && currentFilters.application !== "all") {
        // Check multiple fields for application match
        const itemApp = item.application || item.source || item.raw_data?.fields?.ServiceIdentifier || item.url;
        if (itemApp !== currentFilters.application) return false;
      }
      if (currentFilters.email_domain && currentFilters.email_domain !== "all" && item.email_domain !== currentFilters.email_domain) return false;
      if (currentFilters.device && currentFilters.device !== "all" && item.device_info !== currentFilters.device) return false;
      if (currentFilters.case && currentFilters.case !== "all" && item.case_number !== currentFilters.case) return false;
      if (currentFilters.suspect && currentFilters.suspect !== "all" && item.person_name !== currentFilters.suspect) return false;
      if (currentFilters.account && currentFilters.account !== "all") {
        const itemAccount = item.username || item.email || item.raw_data?.fields?.Account;
        if (itemAccount !== currentFilters.account) return false;
      }
      if (currentFilters.service && currentFilters.service !== "all") {
        const itemService = item.application || item.raw_data?.fields?.Source || item.raw_data?.fields?.ServiceIdentifier;
        if (itemService !== currentFilters.service) return false;
      }
      if (currentFilters.type && currentFilters.type !== "all") {
        const itemType = item.raw_data?.fields?.Type || item.category;
        if (itemType !== currentFilters.type) return false;
      }
      // Filter by hasName (contacts only)
      if (currentFilters.hasName && currentFilters.hasName !== "all") {
        const hasName = item.name && item.name.trim() !== '';
        if (currentFilters.hasName === "yes" && !hasName) return false;
        if (currentFilters.hasName === "no" && hasName) return false;
      }
      // Filter by hasPhoto (contacts only)
      if (currentFilters.hasPhoto && currentFilters.hasPhoto !== "all") {
        const hasPhoto = item.photo_path && item.photo_path.trim() !== '';
        if (currentFilters.hasPhoto === "yes" && !hasPhoto) return false;
        if (currentFilters.hasPhoto === "no" && hasPhoto) return false;
      }
      return true;
    });
  };

  const clearFilters = (dataType) => {
    const defaultFilters = {
      contacts: { source: "all", category: "all", device: "all", case: "all", suspect: "all", hasName: "all", hasPhoto: "all" },
      credentials: { application: "all", email_domain: "all", device: "all", case: "all", suspect: "all", account: "all", service: "all", type: "all" },
      whatsapp_groups: { device: "all", suspect: "all", case: "all" }
    };
    
    setFilters(prev => ({
      ...prev,
      [dataType]: defaultFilters[dataType]
    }));
    
    // Also clear the global case filter
    setSelectedCase("");
  };

  // Click-to-filter handlers
  const handleFilterClick = (dataType, filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [dataType]: {
        ...prev[dataType],
        [filterKey]: value
      }
    }));
  };

  const removeFilter = (dataType, filterKey) => {
    setFilters(prev => ({
      ...prev,
      [dataType]: {
        ...prev[dataType],
        [filterKey]: "all"
      }
    }));
  };

  // Get active filters for display
  const getActiveFilters = (dataType) => {
    const currentFilters = filters[dataType];
    if (!currentFilters) return [];
    
    return Object.entries(currentFilters)
      .filter(([key, value]) => value !== "all")
      .map(([key, value]) => ({
        key,
        value,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }));
  };

  // Get dynamic filter options based on currently filtered data (cascading filters)
  const getDynamicFilterOptions = (dataType, data, currentFilters) => {
    const options = {
      categories: new Set(),
      applications: new Set(),
      sources: new Set(),
      email_domains: new Set(),
      devices: new Set(),
      cases: new Set(),
      suspects: new Set(),
      accounts: new Set(),
      services: new Set(),
      types: new Set()
    };
    
    const counts = {
      categories: {},
      applications: {},
      sources: {},
      email_domains: {},
      devices: {},
      cases: {},
      suspects: {},
      accounts: {},
      services: {},
      types: {}
    };

    // For each filter field, apply all OTHER filters to get cascading options
    const getFilteredDataForField = (excludeField) => {
      return data.filter(item => {
        if (excludeField !== 'source' && currentFilters.source && currentFilters.source !== "all") {
          if (item.source !== currentFilters.source) return false;
        }
        // Category filter only for contacts
        if (excludeField !== 'category' && currentFilters.category && currentFilters.category !== "all") {
          if (item.category !== currentFilters.category) return false;
        }
        if (excludeField !== 'application' && currentFilters.application && currentFilters.application !== "all") {
          const itemApp = item.application || item.source || item.raw_data?.fields?.ServiceIdentifier || item.url;
          if (itemApp !== currentFilters.application) return false;
        }
        if (excludeField !== 'email_domain' && currentFilters.email_domain && currentFilters.email_domain !== "all") {
          if (item.email_domain !== currentFilters.email_domain) return false;
        }
        if (excludeField !== 'device' && currentFilters.device && currentFilters.device !== "all") {
          if (item.device_info !== currentFilters.device) return false;
        }
        if (excludeField !== 'case' && currentFilters.case && currentFilters.case !== "all") {
          if (item.case_number !== currentFilters.case) return false;
        }
        if (excludeField !== 'suspect' && currentFilters.suspect && currentFilters.suspect !== "all") {
          if (item.person_name !== currentFilters.suspect) return false;
        }
        if (excludeField !== 'account' && currentFilters.account && currentFilters.account !== "all") {
          const itemAccount = item.username || item.email || item.raw_data?.fields?.Account;
          if (itemAccount !== currentFilters.account) return false;
        }
        if (excludeField !== 'service' && currentFilters.service && currentFilters.service !== "all") {
          const itemService = item.application || item.raw_data?.fields?.Source || item.raw_data?.fields?.ServiceIdentifier;
          if (itemService !== currentFilters.service) return false;
        }
        if (excludeField !== 'type' && currentFilters.type && currentFilters.type !== "all") {
          const itemType = item.raw_data?.fields?.Type || item.category;
          if (itemType !== currentFilters.type) return false;
        }
        return true;
      });
    };

    // Build options for each field based on data filtered by all other fields
    const buildOptions = (field, getter) => {
      const filteredData = getFilteredDataForField(field);
      filteredData.forEach(item => {
        const values = getter(item);
        values.forEach(val => {
          if (val) {
            options[field].add(val);
            counts[field][val] = (counts[field][val] || 0) + 1;
          }
        });
      });
    };

    buildOptions('categories', (item) => [item.category]);
    buildOptions('sources', (item) => [item.source]);
    buildOptions('applications', (item) => [
      item.application, 
      item.source, 
      item.raw_data?.fields?.ServiceIdentifier, 
      item.url
    ].filter(Boolean));
    buildOptions('email_domains', (item) => [item.email_domain]);
    buildOptions('devices', (item) => [item.device_info]);
    buildOptions('cases', (item) => [item.case_number]);
    buildOptions('suspects', (item) => [item.person_name]);
    buildOptions('accounts', (item) => [
      item.username,
      item.email,
      item.raw_data?.fields?.Account
    ].filter(Boolean));
    buildOptions('services', (item) => [
      item.application,
      item.raw_data?.fields?.Source,
      item.raw_data?.fields?.ServiceIdentifier
    ].filter(Boolean));
    buildOptions('types', (item) => [
      item.raw_data?.fields?.Type,
      item.category
    ].filter(Boolean));

    return {
      categories: Array.from(options.categories).sort(),
      applications: Array.from(options.applications).sort(),
      sources: Array.from(options.sources).sort(),
      email_domains: Array.from(options.email_domains).sort(),
      devices: Array.from(options.devices).sort(),
      cases: Array.from(options.cases).sort(),
      suspects: Array.from(options.suspects).sort(),
      accounts: Array.from(options.accounts).sort(),
      services: Array.from(options.services).sort(),
      types: Array.from(options.types).sort(),
      counts: counts
    };
  };

  // Search active = show results across all cases
  // No search = require case selection for Contacts/Suspects ONLY
  // Credentials & WhatsApp Groups = always show
  const searchActive = searchQuery.trim() !== "";
  const shouldShowContacts = selectedCase !== "" || searchActive;
  const shouldShowWhatsApp = true; // Always show WhatsApp Groups
  const shouldShowSuspects = selectedCase !== "" || searchActive;
  const shouldShowCredentials = true; // Always show credentials

  // First apply SEARCH filter (real-time)
  let searchFilteredContacts = searchActive ? performSearch(searchQuery, contacts, 'contacts') : contacts;
  let searchFilteredCredentials = searchActive ? performSearch(searchQuery, credentials, 'credentials') : credentials;

  // Then apply CASE filter
  let caseFilteredContacts = searchFilteredContacts;
  let caseFilteredCredentials = searchFilteredCredentials;
  
  if (selectedCase) {
    caseFilteredContacts = searchFilteredContacts.filter(c => c.case_number === selectedCase);
    caseFilteredCredentials = searchFilteredCredentials.filter(c => c.case_number === selectedCase);
  }

  // Get dynamic filter options from CASE-FILTERED data (shows only what's available in selected case)
  const dynamicCredentialFilters = getDynamicFilterOptions('credentials', caseFilteredCredentials, filters.credentials);
  const dynamicContactFilters = getDynamicFilterOptions('contacts', caseFilteredContacts, filters.contacts);

  // Now apply TAB-LEVEL filters
  let filteredContacts = applyFilters(caseFilteredContacts, 'contacts');
  let filteredCredentials = applyFilters(caseFilteredCredentials, 'credentials');
  
  // Sort contacts alphabetically by name
  filteredContacts = [...filteredContacts].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Filter password analysis based on credentials filters
  let filteredPasswordAnalysis = passwordAnalysis.map(item => {
    // Filter the usages array based on active filters
    const filteredUsages = item.usages.filter(usage => {
      const credFilters = filters.credentials;
      
      // Filter by account
      if (credFilters.account && credFilters.account !== "all") {
        const usageAccount = usage.raw_data?.fields?.Account || usage.username || usage.email;
        if (usageAccount !== credFilters.account) return false;
      }
      
      // Filter by service
      if (credFilters.service && credFilters.service !== "all") {
        if (usage.service !== credFilters.service) return false;
      }
      
      // Filter by type/category
      if (credFilters.type && credFilters.type !== "all") {
        const usageType = usage.raw_data?.fields?.Type || usage.category;
        if (usageType !== credFilters.type) return false;
      }
      
      // Filter by device
      if (credFilters.device && credFilters.device !== "all") {
        if (usage.device !== credFilters.device) return false;
      }
      
      // Filter by case
      if (credFilters.case && credFilters.case !== "all") {
        if (usage.case_number !== credFilters.case) return false;
      }
      
      // Filter by suspect
      if (credFilters.suspect && credFilters.suspect !== "all") {
        const usageSuspect = usage.suspect || usage.person_name;
        if (usageSuspect !== credFilters.suspect) return false;
      }
      
      return true;
    });
    
    // Return the item with filtered usages and updated count
    return {
      ...item,
      usages: filteredUsages,
      usage_count: filteredUsages.length,
      is_reused: filteredUsages.length > 1
    };
  }).filter(item => item.usages.length > 0); // Only keep passwords that have at least one matching usage

  // Filter WhatsApp groups
  let filteredWhatsappGroups = whatsappGroups;
  
  // Apply search filter
  if (searchActive) {
    filteredWhatsappGroups = performSearch(searchQuery, filteredWhatsappGroups, 'whatsapp');
  }
  
  // Filter by selected case (from top filter)
  if (selectedCase) {
    filteredWhatsappGroups = filteredWhatsappGroups.filter(group => 
      group.cases && group.cases.includes(selectedCase)
    );
  }
  
  // Get unique devices, suspects, cases from groups AFTER case filter (for dropdown options)
  const whatsappDevices = [...new Set(filteredWhatsappGroups.flatMap(g => g.devices || []))].filter(Boolean).sort();
  const whatsappSuspects = [...new Set(filteredWhatsappGroups.flatMap(g => g.members?.map(m => m.person_name) || []))].filter(Boolean).sort();
  const whatsappCases = [...new Set(filteredWhatsappGroups.flatMap(g => g.cases || []))].filter(Boolean).sort();
  
  // Apply tab-level filters
  filteredWhatsappGroups = filteredWhatsappGroups.filter(group => {
    const groupFilters = filters.whatsapp_groups;
    
    // Filter by device
    if (groupFilters.device && groupFilters.device !== "all") {
      if (!group.devices || !group.devices.includes(groupFilters.device)) return false;
    }
    
    // Filter by suspect (person_name)
    if (groupFilters.suspect && groupFilters.suspect !== "all") {
      // Check if any member has this suspect name
      const hasSuspect = group.members?.some(m => m.person_name === groupFilters.suspect);
      if (!hasSuspect) return false;
    }
    
    // Filter by case (tab-level filter)
    if (groupFilters.case && groupFilters.case !== "all") {
      if (!group.cases || !group.cases.includes(groupFilters.case)) return false;
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/')}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors mr-2"
                title="Back to Home"
              >
                <Home className="h-5 w-5 text-neutral-400 hover:text-amber-400" />
              </button>
              <div className="p-2 bg-amber-500 rounded-lg">
                <Database className="h-6 w-6 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Pagini Galbui
                </h1>
                <p className="text-xs text-neutral-400">Intelligence Database</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-6 px-4 py-2 bg-neutral-800/50 rounded-lg border border-neutral-700">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-neutral-400">Contacts:</span>
                  <span className="text-sm font-semibold text-white">{stats.contacts}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-neutral-400">Passwords:</span>
                  <span className="text-sm font-semibold text-white">{stats.passwords}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-neutral-400">Accounts:</span>
                  <span className="text-sm font-semibold text-white">{stats.user_accounts}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Card className="flex-1 bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Cellebrite Dump
                </CardTitle>
                <CardDescription className="text-neutral-400 text-sm">
                  Upload ZIP files with case information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <label htmlFor="file-upload" className="flex-1">
                    <Button
                      className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                      disabled={uploading}
                      onClick={() => document.getElementById('file-upload').click()}
                    >
                      {uploading ? "Uploading..." : "Select ZIP File"}
                    </Button>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".zip"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter & Search
                </CardTitle>
                <CardDescription className="text-neutral-400 text-sm">
                  Filter by case or search across all fields
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label className="text-neutral-400 text-xs mb-1 block">Case Number</Label>
                      <Select
                        value={selectedCase}
                        onValueChange={(value) => setSelectedCase(value === "ALL_HIDDEN" ? "" : value)}
                      >
                        <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                          <SelectValue placeholder="Select a case..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL_HIDDEN">All Cases (Hidden)</SelectItem>
                          {availableCases.map(caseNum => (
                            <SelectItem key={caseNum} value={caseNum}>{caseNum}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-full max-w-2xl">
                      <Input
                        placeholder="Search by phone, email, name, or any field (real-time)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                      />
                      {searchQuery && (
                        <p className="text-xs text-neutral-500 mt-1 text-center">
                          Searching across all data in real-time...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-neutral-900 border border-neutral-800 p-1">
            <TabsTrigger
              value="contacts"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-neutral-400"
            >
              <Users className="h-4 w-4 mr-2" />
              Contacts{selectedCase ? ` (${filteredContacts.length})` : ''}
            </TabsTrigger>
            <TabsTrigger
              value="credentials"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-neutral-400"
            >
              <Key className="h-4 w-4 mr-2" />
              Credentials{selectedCase ? ` (${filteredCredentials.length})` : ''}
            </TabsTrigger>
            <TabsTrigger
              value="whatsapp-groups"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-neutral-400"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp Groups{selectedCase ? ` (${filteredWhatsappGroups.length})` : ''}
            </TabsTrigger>
            <TabsTrigger
              value="suspects"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black text-neutral-400"
            >
              <Shield className="h-4 w-4 mr-2" />
              Suspects{selectedCase ? ` (${suspectInfo.filter(s => s.case_number === selectedCase).length})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            {selectedCase && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 text-sm">Case:</span>
                  <Badge className="bg-amber-500 text-black font-semibold">{selectedCase}</Badge>
                </div>
              </div>
            )}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearFilters('contacts')}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-3">
                  <div>
                    <Label className="text-neutral-400 text-xs">Source</Label>
                    <Select
                      key={`source-${filters.contacts.source}`}
                      value={filters.contacts.source}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        contacts: { ...prev.contacts, source: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicContactFilters.sources.map(s => (
                          <SelectItem key={s} value={s}>{s} ({dynamicContactFilters.counts.sources[s] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Category</Label>
                    <Select
                      key={`category-${filters.contacts.category}`}
                      value={filters.contacts.category}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        contacts: { ...prev.contacts, category: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicContactFilters.categories.map(c => (
                          <SelectItem key={c} value={c}>{c} ({dynamicContactFilters.counts.categories[c] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Device</Label>
                    <Select
                      key={`device-${filters.contacts.device}`}
                      value={filters.contacts.device}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        contacts: { ...prev.contacts, device: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicContactFilters.devices.map(d => (
                          <SelectItem key={d} value={d}>{d} ({dynamicContactFilters.counts.devices[d] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Suspect</Label>
                    <Select
                      key={`suspect-${filters.contacts.suspect}`}
                      value={filters.contacts.suspect}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        contacts: { ...prev.contacts, suspect: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicContactFilters.suspects.map(s => (
                          <SelectItem key={s} value={s}>{s} ({dynamicContactFilters.counts.suspects[s] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Has Name</Label>
                    <Select
                      key={`hasName-${filters.contacts.hasName}`}
                      value={filters.contacts.hasName}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        contacts: { ...prev.contacts, hasName: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">With Name</SelectItem>
                        <SelectItem value="no">No Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Has Photo</Label>
                    <Select
                      key={`hasPhoto-${filters.contacts.hasPhoto}`}
                      value={filters.contacts.hasPhoto}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        contacts: { ...prev.contacts, hasPhoto: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">With Photo</SelectItem>
                        <SelectItem value="no">No Photo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-800 hover:bg-transparent">
                        <TableHead className="text-neutral-400">Photo</TableHead>
                        <TableHead className="text-neutral-400">Name</TableHead>
                        <TableHead className="text-neutral-400">Phone</TableHead>
                        <TableHead className="text-neutral-400">Source</TableHead>
                        <TableHead className="text-neutral-400">Case</TableHead>
                        <TableHead className="text-neutral-400">Suspect</TableHead>
                        <TableHead className="text-neutral-400">Device</TableHead>
                        <TableHead className="text-neutral-400">Duplicates</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!shouldShowContacts ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <Filter className="h-12 w-12 text-neutral-600" />
                              <p className="text-neutral-400 text-lg font-semibold">Select a case to view contacts</p>
                              <p className="text-neutral-500 text-sm">Or use the search bar above</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredContacts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-neutral-500">
                            No contacts found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredContacts.map((contact, idx) => (
                          <TableRow 
                            key={contact.id || idx} 
                            className="border-neutral-800 cursor-pointer hover:bg-neutral-800/50" 
                            onClick={() => handleContactClick(contact)}
                          >
                            <TableCell>
                              <div className="relative">
                                {contact.photo_path ? (
                                  <img 
                                    src={`${BACKEND_URL}${contact.photo_path}`} 
                                    alt={contact.name || 'Contact'} 
                                    className={`w-10 h-10 rounded-full object-cover ${contact.suspect_phone && contact.phone && 
                                      (contact.phone.replace(/\D/g, '').slice(-9) === contact.suspect_phone.replace(/\D/g, '').slice(-9)) 
                                      ? 'ring-2 ring-red-500' : ''}`}
                                    onError={(e) => { e.target.style.display = 'none' }}
                                  />
                                ) : (
                                  <div className={`w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center ${contact.suspect_phone && contact.phone && 
                                    (contact.phone.replace(/\D/g, '').slice(-9) === contact.suspect_phone.replace(/\D/g, '').slice(-9)) 
                                    ? 'ring-2 ring-red-500' : ''}`}>
                                    <Users className="h-5 w-5 text-neutral-600" />
                                  </div>
                                )}
                                {contact.suspect_phone && contact.phone && 
                                  (contact.phone.replace(/\D/g, '').slice(-9) === contact.suspect_phone.replace(/\D/g, '').slice(-9)) && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                    <Shield className="h-3 w-3 text-white" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-white font-medium">
                              <div>
                                {contact.name || '-'}
                                {contact.all_names && contact.all_names.length > 1 && (
                                  <div className="text-xs text-neutral-400 mt-1">
                                    Also known as: {contact.all_names.filter(n => n !== contact.name).join(', ')}
                                  </div>
                                )}
                              </div>
                              {contact.suspect_phone && contact.phone && 
                                (contact.phone.replace(/\D/g, '').slice(-9) === contact.suspect_phone.replace(/\D/g, '').slice(-9)) && (
                                <Badge variant="outline" className="ml-2 bg-red-950 text-red-300 border-red-800 text-xs">
                                  SUSPECT
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-neutral-300">
                              {contact.all_phones && contact.all_phones.length > 1 ? (
                                <div className="space-y-1">
                                  {contact.all_phones.map((phone, pidx) => (
                                    <div key={pidx} className="text-xs">{phone}</div>
                                  ))}
                                </div>
                              ) : (
                                <span className={contact.suspect_phone && contact.phone && 
                                  (contact.phone.replace(/\D/g, '').slice(-9) === contact.suspect_phone.replace(/\D/g, '').slice(-9)) 
                                  ? 'text-red-400 font-semibold' : ''}>
                                  {contact.phone || '-'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {contact.sources && contact.sources.length > 1 ? (
                                <div className="flex flex-wrap gap-1">
                                  {contact.sources.map((source, sidx) => (
                                    <Badge key={sidx} variant="outline" className="bg-blue-950 text-blue-300 border-blue-800 text-xs">
                                      {source || 'Agenda Telefon'}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Badge variant="outline" className="bg-blue-950 text-blue-300 border-blue-800">
                                  {contact.source || contact.sources?.[0] || 'Agenda Telefon'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-neutral-300 text-xs">{contact.case_number || '-'}</TableCell>
                            <TableCell className="text-neutral-300 text-xs">{contact.person_name || '-'}</TableCell>
                            <TableCell className="text-neutral-300 text-xs">{contact.device_info || '-'}</TableCell>
                            <TableCell>
                              {contact.duplicate_count > 1 && (
                                <Badge variant="outline" className="bg-amber-950 text-amber-300 border-amber-800">
                                  {contact.duplicate_count}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentials" className="space-y-4">
            {selectedCase && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 text-sm">Case:</span>
                  <Badge className="bg-amber-500 text-black font-semibold">{selectedCase}</Badge>
                </div>
              </div>
            )}
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-red-950/50 to-neutral-900 border-red-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-400" />
                    Reused Passwords
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-400">
                    {filteredPasswordAnalysis.filter(p => p.is_reused).length}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">Passwords used multiple times</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-950/50 to-neutral-900 border-amber-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Key className="h-4 w-4 text-amber-400" />
                    Total Passwords
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-400">
                    {filteredPasswordAnalysis.length}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">Unique passwords found</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-950/50 to-neutral-900 border-blue-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    Total Services
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-400">
                    {filteredPasswordAnalysis.reduce((acc, p) => acc + p.usage_count, 0)}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">Service authentications</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearFilters('credentials')}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-neutral-400 text-xs">Account</Label>
                    <Select
                      value={filters.credentials.account}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        credentials: { ...prev.credentials, account: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicCredentialFilters.accounts.map(a => (
                          <SelectItem key={a} value={a}>{a} ({dynamicCredentialFilters.counts.accounts[a] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Service</Label>
                    <Select
                      value={filters.credentials.service}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        credentials: { ...prev.credentials, service: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicCredentialFilters.services.map(s => (
                          <SelectItem key={s} value={s}>{s} ({dynamicCredentialFilters.counts.services[s] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Type</Label>
                    <Select
                      value={filters.credentials.type}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        credentials: { ...prev.credentials, type: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicCredentialFilters.types.map(t => (
                          <SelectItem key={t} value={t}>{t} ({dynamicCredentialFilters.counts.types[t] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Device</Label>
                    <Select
                      value={filters.credentials.device}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        credentials: { ...prev.credentials, device: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {dynamicCredentialFilters.devices.map(d => (
                          <SelectItem key={d} value={d}>{d} ({dynamicCredentialFilters.counts.devices[d] || 0})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Password Analysis Table */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Key className="h-5 w-5 text-amber-400" />
                      Password Reuse Analysis
                    </CardTitle>
                    <CardDescription className="text-neutral-400 mt-1">
                      Click on any password to see where it's used. Use filters above to narrow down credentials.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowExportDialog(true)}
                      className="text-green-400 hover:text-green-300 hover:bg-green-950"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-800 hover:bg-transparent">
                        <TableHead className="text-neutral-400 w-12">#</TableHead>
                        <TableHead className="text-neutral-400">Password</TableHead>
                        <TableHead className="text-neutral-400 w-32 text-center">Times Used</TableHead>
                        <TableHead className="text-neutral-400">Services</TableHead>
                        <TableHead className="text-neutral-400 w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {passwordAnalysis.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <Key className="h-12 w-12 text-neutral-600" />
                              <p className="text-neutral-400 text-lg font-semibold">No password data available</p>
                              <p className="text-neutral-500 text-sm">Upload a Cellebrite dump to analyze passwords</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredPasswordAnalysis.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <Filter className="h-12 w-12 text-neutral-600" />
                              <p className="text-neutral-400 text-lg font-semibold">No passwords match the current filters</p>
                              <p className="text-neutral-500 text-sm">Try adjusting your filter criteria</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPasswordAnalysis.map((item, idx) => {
                          const isExpanded = expandedGroups[`pwd-${idx}`];
                          const isReused = item.is_reused;
                          
                          return (
                            <>
                              <TableRow 
                                key={`pwd-${idx}`} 
                                className={`border-neutral-800 cursor-pointer transition-colors ${isReused ? 'hover:bg-red-950/20' : 'hover:bg-neutral-800/50'}`}
                                onClick={() => setExpandedGroups(prev => ({
                                  ...prev,
                                  [`pwd-${idx}`]: !prev[`pwd-${idx}`]
                                }))}
                              >
                                <TableCell className="text-neutral-400 font-mono text-xs">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-amber-400" /> : <ChevronRight className="h-4 w-4 text-neutral-500" />}
                                    <span className={isReused ? 'text-red-400 font-semibold' : 'text-white'}>
                                      {item.password.length > 40 ? item.password.substring(0, 40) + '...' : item.password}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    variant="outline" 
                                    className={isReused ? 'bg-red-950 text-red-300 border-red-800 font-bold' : 'bg-neutral-800 text-neutral-300 border-neutral-700'}
                                  >
                                    {item.usage_count}x
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {item.usages.slice(0, 3).map((usage, uidx) => (
                                      <Badge 
                                        key={uidx} 
                                        variant="outline" 
                                        className="bg-blue-950 text-blue-300 border-blue-800 text-xs"
                                      >
                                        {usage.service}
                                      </Badge>
                                    ))}
                                    {item.usages.length > 3 && (
                                      <Badge variant="outline" className="bg-neutral-800 text-neutral-400 border-neutral-700 text-xs">
                                        +{item.usages.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isReused && (
                                    <Badge variant="outline" className="bg-red-950 text-red-300 border-red-800 text-xs">
                                      <Shield className="h-3 w-3 mr-1" />
                                      REUSED
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                              
                              {/* Level 1 Expansion - Simplified Account/Service Badges */}
                              {isExpanded && (
                                <TableRow className="border-neutral-800 bg-neutral-900/50">
                                  <TableCell colSpan={5} className="p-0">
                                    <div className="p-4 space-y-3">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="h-px flex-1 bg-neutral-700"></div>
                                        <span className="text-xs text-neutral-400 font-semibold">PASSWORD USED IN {item.usage_count} SERVICE{item.usage_count !== 1 ? 'S' : ''}</span>
                                        <div className="h-px flex-1 bg-neutral-700"></div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 gap-2">
                                        {item.usages.map((usage, uidx) => {
                                          const entryKey = `pwd-${idx}-entry-${uidx}`;
                                          const isEntryExpanded = expandedEntries[entryKey];
                                          
                                          return (
                                            <div key={uidx} className="space-y-2">
                                              {/* Level 1: Simplified row with badges */}
                                              <div 
                                                className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 hover:border-amber-700 transition-colors cursor-pointer flex items-center gap-3"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setExpandedEntries(prev => ({
                                                    ...prev,
                                                    [entryKey]: !prev[entryKey]
                                                  }));
                                                }}
                                              >
                                                {/* Chevron indicator */}
                                                <div className="flex-shrink-0">
                                                  {isEntryExpanded ? 
                                                    <ChevronDown className="h-4 w-4 text-amber-400" /> : 
                                                    <ChevronRight className="h-4 w-4 text-neutral-500" />
                                                  }
                                                </div>
                                                
                                                {/* Account Badge (Blue) - Extract account name from username or raw_data */}
                                                <Badge className="bg-blue-950 text-blue-300 border-blue-800 text-xs font-semibold px-3 py-1 flex-shrink-0">
                                                  Account: {
                                                    usage.raw_data?.fields?.Account || 
                                                    usage.username || 
                                                    '-'
                                                  }
                                                </Badge>
                                                
                                                {/* Service Badge (Green) - Shortened service name */}
                                                <Badge className="bg-green-950 text-green-300 border-green-800 text-xs font-semibold px-3 py-1 truncate max-w-xs">
                                                  Service: {usage.service || 'Unknown'}
                                                </Badge>
                                                
                                                {/* Suspect Name Badge (Red) */}
                                                <Badge className="bg-red-950 text-red-300 border-red-800 text-xs font-semibold px-3 py-1 flex-shrink-0">
                                                  Suspect: {usage.suspect || usage.person_name || '-'}
                                                </Badge>
                                                
                                                {/* Case Number Badge (Amber/Orange) - Matching Suspect tab styling */}
                                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs font-semibold px-3 py-1 flex-shrink-0">
                                                  Case: {usage.case_number || '-'}
                                                </Badge>
                                              </div>
                                              
                                              {/* Level 2: Full Details (shown when entry is clicked) */}
                                              {isEntryExpanded && (
                                                <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 ml-8">
                                                  {/* Entry Header */}
                                                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-700">
                                                    <h5 className="text-amber-400 font-semibold text-sm">Entry #{uidx + 1}</h5>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/50"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (usage.id) {
                                                          handleCredentialClick({ id: usage.id });
                                                        }
                                                      }}
                                                    >
                                                      <Eye className="h-4 w-4 mr-1" />
                                                      View Full XML
                                                    </Button>
                                                  </div>

                                                  {/* Two-column layout matching modal */}
                                                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                    <div>
                                                      <span className="text-neutral-400 block mb-1 text-xs">Application/Source:</span>
                                                      <p className="text-white">{usage.service || '-'}</p>
                                                    </div>
                                                    <div>
                                                      <span className="text-neutral-400 block mb-1 text-xs">Username/Email:</span>
                                                      <p className="text-white font-mono text-xs break-all">{usage.username || '-'}</p>
                                                    </div>
                                                    <div>
                                                      <span className="text-neutral-400 block mb-1 text-xs">Credential/Value:</span>
                                                      <p className="text-white font-mono text-xs break-all">{item.password}</p>
                                                    </div>
                                                    <div>
                                                      <span className="text-neutral-400 block mb-1 text-xs">URL/Service:</span>
                                                      <p className="text-white text-xs break-all">{usage.url || '-'}</p>
                                                    </div>
                                                    <div>
                                                      <span className="text-neutral-400 block mb-1 text-xs">Case:</span>
                                                      <p className="text-white">{usage.case_number || '-'}</p>
                                                    </div>
                                                    <div>
                                                      <span className="text-neutral-400 block mb-1 text-xs">Device:</span>
                                                      <p className="text-white">{usage.device || '-'}</p>
                                                    </div>
                                                    <div>
                                                      <span className="text-neutral-400 block mb-1 text-xs">Category:</span>
                                                      <Badge className={`${
                                                        usage.category === 'Email' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                                                        usage.category === 'Social Media' ? 'bg-blue-950 text-blue-300 border-blue-800' :
                                                        usage.category === 'Google Services' ? 'bg-red-950 text-red-300 border-red-800' :
                                                        usage.category === 'Banking' ? 'bg-green-950 text-green-300 border-green-800' :
                                                        usage.category === 'Gaming' ? 'bg-orange-950 text-orange-300 border-orange-800' :
                                                        'bg-neutral-800 text-neutral-300 border-neutral-700'
                                                      }`}>
                                                        {usage.category || 'Other'}
                                                      </Badge>
                                                    </div>
                                                  </div>

                                                  {/* XML Fields Section */}
                                                  {usage.raw_data && usage.raw_data.fields && Object.keys(usage.raw_data.fields).length > 0 && (
                                                    <div className="border-t border-neutral-700 pt-3 mt-3">
                                                      <h5 className="text-neutral-400 text-xs mb-2 uppercase font-semibold">XML FIELDS FOR ENTRY #{uidx + 1}</h5>
                                                      <div className="bg-neutral-800/50 p-3 rounded space-y-1">
                                                        {Object.entries(usage.raw_data.fields).map(([key, value]) => (
                                                          <div key={key} className="flex border-b border-neutral-700/30 pb-1">
                                                            <span className="text-neutral-400 text-xs w-1/3 flex-shrink-0">{key}:</span>
                                                            <span className="text-white text-xs font-mono flex-1 break-all">{value}</span>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp-groups" className="space-y-4">
            {selectedCase && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 text-sm">Case:</span>
                  <Badge className="bg-amber-500 text-black font-semibold">{selectedCase}</Badge>
                </div>
              </div>
            )}
            {/* Filters */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearFilters('whatsapp_groups')}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-neutral-400 text-xs">Device</Label>
                    <Select
                      value={filters.whatsapp_groups.device}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        whatsapp_groups: { ...prev.whatsapp_groups, device: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {whatsappDevices.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Suspect</Label>
                    <Select
                      value={filters.whatsapp_groups.suspect}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        whatsapp_groups: { ...prev.whatsapp_groups, suspect: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {whatsappSuspects.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-neutral-400 text-xs">Case</Label>
                    <Select
                      value={filters.whatsapp_groups.case}
                      onValueChange={(value) => setFilters(prev => ({
                        ...prev,
                        whatsapp_groups: { ...prev.whatsapp_groups, case: value }
                      }))}
                    >
                      <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {whatsappCases.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-amber-400" />
                  WhatsApp Groups Analysis
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  All WhatsApp groups extracted from contacts with member information
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-800 hover:bg-transparent">
                        <TableHead className="text-neutral-400">Group Name</TableHead>
                        <TableHead className="text-neutral-400">Group ID</TableHead>
                        <TableHead className="text-neutral-400">Members</TableHead>
                        <TableHead className="text-neutral-400">Cases</TableHead>
                        <TableHead className="text-neutral-400">Devices</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!shouldShowWhatsApp ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <Filter className="h-12 w-12 text-neutral-600" />
                              <p className="text-neutral-400 text-lg font-semibold">Select a case to view WhatsApp groups</p>
                              <p className="text-neutral-500 text-sm">Or use the search bar above</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredWhatsappGroups.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <MessageCircle className="h-12 w-12 text-neutral-600" />
                              <p className="text-neutral-400 text-lg font-semibold">No WhatsApp groups found</p>
                              <p className="text-neutral-500 text-sm">No groups match the selected filters</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredWhatsappGroups.map((group, idx) => (
                          <TableRow 
                            key={group.group_id || idx} 
                            className="border-neutral-800 cursor-pointer hover:bg-neutral-800/50"
                            onClick={() => handleWhatsappGroupClick(group)}
                          >
                            <TableCell className="text-white font-medium">
                              {group.group_name || 'Unknown Group'}
                            </TableCell>
                            <TableCell className="text-neutral-300 text-xs font-mono">
                              {group.group_id}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-950 text-green-300 border-green-800">
                                {group.member_count} members
                              </Badge>
                            </TableCell>
                            <TableCell className="text-neutral-300 text-xs">
                              {group.cases && group.cases.length > 0 ? group.cases.join(', ') : '-'}
                            </TableCell>
                            <TableCell className="text-neutral-300 text-xs">
                              {group.devices && group.devices.length > 0 ? group.devices.join(', ') : '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suspects" className="space-y-4">
            {selectedCase && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 text-sm">Case:</span>
                  <Badge className="bg-amber-500 text-black font-semibold">{selectedCase}</Badge>
                </div>
              </div>
            )}
            {!shouldShowSuspects ? (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="py-24">
                  <div className="flex flex-col items-center gap-3">
                    <Filter className="h-16 w-16 text-neutral-600" />
                    <p className="text-neutral-400 text-lg font-semibold">Select a case to view suspects</p>
                    <p className="text-neutral-500 text-sm">Or use the search bar above</p>
                  </div>
                </CardContent>
              </Card>
            ) : suspectInfo.length === 0 ? (
              <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="py-24">
                  <div className="flex flex-col items-center gap-3">
                    <Shield className="h-16 w-16 text-neutral-600" />
                    <p className="text-neutral-400 text-lg font-semibold">No Suspect Profiles Available</p>
                    <p className="text-neutral-500 text-sm">Upload case files to see suspect details</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {suspectInfo
                  .filter(suspect => {
                    // Apply search filter
                    if (searchActive) {
                      const searchTerm = normalizeText(searchQuery);
                      
                      // Build searchable text from suspect fields
                      const basicFields = [
                        suspect.person_name,
                        suspect.case_number,
                        suspect.device_info,
                        suspect.suspect_phone,
                        ...(suspect.emails_used || []),
                        ...(suspect.whatsapp_groups || [])
                      ].map(f => normalizeText(f)).join(' ');
                      
                      // Also search in user_accounts
                      let accountsText = '';
                      if (suspect.user_accounts && suspect.user_accounts.length > 0) {
                        accountsText = suspect.user_accounts.map(acc => [
                          acc.username,
                          acc.email,
                          acc.name,
                          acc.source,
                          acc.notes
                        ].filter(Boolean).map(f => normalizeText(f)).join(' ')).join(' ');
                      }
                      
                      const fullSearchText = basicFields + ' ' + accountsText;
                      if (!fullSearchText.includes(searchTerm)) return false;
                    }
                    // Apply case filter
                    return !selectedCase || suspect.case_number === selectedCase;
                  })
                  .map((suspect, idx) => {
                  // Enhanced platform categorization with service_type parsing
                  const platformAccounts = {
                    instagram: [],
                    facebook: [],
                    whatsapp: [],
                    twitter: [],
                    tiktok: [],
                    telegram: [],
                    snapchat: [],
                    linkedin: [],
                    discord: [],
                    revolut: [],
                    microsoft: [],
                    odnoklassniki: [],
                    vk: [],
                    other: []
                  };
                  
                  if (suspect.user_accounts && suspect.user_accounts.length > 0) {
                    suspect.user_accounts.forEach(account => {
                      const source = (account.source || '').toLowerCase();
                      const serviceType = (account.service_type || '').toLowerCase();
                      const serviceId = (account.service_identifier || '').toLowerCase();
                      const username = (account.username || '').toLowerCase();
                      
                      // Skip ALL Chrome accounts (just duplicate emails)
                      if (source === 'chrome') {
                        return;
                      }
                      
                      // Skip ALL Google services (Calendar, Photos, Drive, Gmail, Meet, Duo, etc.)
                      if (source.includes('google') || source.includes('gmail')) {
                        return;
                      }
                      
                      // Skip accounts with Google in service_type or service_identifier
                      if (serviceType.includes('google') || serviceId.includes('google')) {
                        return;
                      }
                      
                      // Skip generic email accounts from "Accounts" source
                      if (source === 'accounts' && (
                        serviceType.includes('gm.exchange') ||
                        serviceType.includes('gm.legacyimap')
                      )) {
                        return;
                      }
                      
                      // Skip placeholder accounts (username is just the app name)
                      const uselessPlaceholders = [
                        'microsoft 365', 'microsoft', 'garmin', 'tiktok', 'like',
                        'facebook', 'messenger', 'instagram', 'whatsapp', 'telegram',
                        'snapchat', 'twitter', 'linkedin', 'revolut', 'netflix',
                        'spotify', 'youtube', 'gmail', 'outlook'
                      ];
                      
                      // If username is just a placeholder AND no other useful data
                      if (username && uselessPlaceholders.includes(username) &&
                          !account.email && !account.name && !account.user_id && 
                          !account.notes && !account.metadata) {
                        return;
                      }
                      
                      // Primary: Check explicit source
                      if (source === 'instagram') {
                        platformAccounts.instagram.push(account);
                      } else if (source === 'facebook' || source === 'facebook messenger') {
                        platformAccounts.facebook.push(account);
                      } else if (source === 'whatsapp') {
                        platformAccounts.whatsapp.push(account);
                      } else if (source === 'twitter') {
                        platformAccounts.twitter.push(account);
                      } else if (source === 'tiktok') {
                        platformAccounts.tiktok.push(account);
                      } else if (source === 'telegram') {
                        platformAccounts.telegram.push(account);
                      } else if (source === 'snapchat') {
                        platformAccounts.snapchat.push(account);
                      } else if (source === 'linkedin') {
                        platformAccounts.linkedin.push(account);
                      } else if (source === 'discord') {
                        platformAccounts.discord.push(account);
                      } else if (source === 'vk') {
                        platformAccounts.vk.push(account);
                      } else if (source === 'odnoklassniki') {
                        platformAccounts.odnoklassniki.push(account);
                      }
                      // Secondary: Parse service_type for "Accounts" source
                      else if (serviceType.includes('facebook') || serviceType.includes('fb')) {
                        platformAccounts.facebook.push(account);
                      } else if (serviceType.includes('instagram')) {
                        platformAccounts.instagram.push(account);
                      } else if (serviceType.includes('whatsapp')) {
                        platformAccounts.whatsapp.push(account);
                      } else if (serviceType.includes('telegram')) {
                        platformAccounts.telegram.push(account);
                      } else if (serviceType.includes('tiktok')) {
                        platformAccounts.tiktok.push(account);
                      } else if (serviceType.includes('linkedin')) {
                        platformAccounts.linkedin.push(account);
                      } else if (serviceType.includes('revolut')) {
                        platformAccounts.revolut.push(account);
                      } else if (serviceType.includes('microsoft') || serviceType.includes('office')) {
                        platformAccounts.microsoft.push(account);
                      } else if (serviceType.includes('ok.android') || serviceType.includes('odnoklassniki')) {
                        platformAccounts.odnoklassniki.push(account);
                      } else if (serviceType.includes('vk') || serviceType.includes('vkontakte')) {
                        platformAccounts.vk.push(account);
                      } else {
                        platformAccounts.other.push(account);
                      }
                    });
                  }

                  // Platform configurations
                  const platforms = [
                    { key: 'instagram', name: 'Instagram', icon: Instagram, color: 'from-purple-600 to-pink-600', textColor: 'text-pink-400', borderColor: 'border-pink-500/30' },
                    { key: 'facebook', name: 'Facebook', icon: Facebook, color: 'from-blue-600 to-blue-800', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
                    { key: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'from-green-600 to-green-800', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
                    { key: 'discord', name: 'Discord', icon: MessageCircle, color: 'from-indigo-500 to-purple-600', textColor: 'text-indigo-300', borderColor: 'border-indigo-500/30' },
                    { key: 'telegram', name: 'Telegram', icon: Send, color: 'from-blue-400 to-blue-600', textColor: 'text-blue-300', borderColor: 'border-blue-400/30' },
                    { key: 'tiktok', name: 'TikTok', icon: Music, color: 'from-cyan-500 to-pink-500', textColor: 'text-cyan-400', borderColor: 'border-cyan-500/30' },
                    { key: 'linkedin', name: 'LinkedIn', icon: Users, color: 'from-blue-700 to-blue-900', textColor: 'text-blue-500', borderColor: 'border-blue-600/30' },
                    { key: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'from-sky-500 to-blue-600', textColor: 'text-sky-400', borderColor: 'border-sky-500/30' },
                    { key: 'snapchat', name: 'Snapchat', icon: Share2, color: 'from-yellow-400 to-yellow-600', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
                    { key: 'vk', name: 'VKontakte', icon: Share2, color: 'from-blue-500 to-blue-700', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
                    { key: 'odnoklassniki', name: 'Odnoklassniki', icon: Users, color: 'from-orange-500 to-orange-700', textColor: 'text-orange-400', borderColor: 'border-orange-500/30' },
                    { key: 'revolut', name: 'Revolut', icon: Database, color: 'from-indigo-600 to-purple-600', textColor: 'text-indigo-400', borderColor: 'border-indigo-500/30' },
                    { key: 'microsoft', name: 'Microsoft', icon: Mail, color: 'from-blue-600 to-cyan-600', textColor: 'text-cyan-400', borderColor: 'border-cyan-500/30' },
                  ];

                  return (
                    <Card key={suspect.case_number || idx} className="bg-neutral-900 border-neutral-800">
                      <CardHeader>
                        <div className="flex items-start gap-6">
                          {/* Profile Image */}
                          <div className="flex-shrink-0">
                            {suspect.profile_image_path ? (
                              <img 
                                src={`${BACKEND_URL}${suspect.profile_image_path}`} 
                                alt={suspect.person_name || 'Suspect'} 
                                className="w-32 h-32 rounded-lg object-cover ring-4 ring-red-500 shadow-2xl"
                                onError={(e) => { 
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="w-32 h-32 rounded-lg bg-neutral-800 flex items-center justify-center ring-4 ring-neutral-700"
                              style={{ display: suspect.profile_image_path ? 'none' : 'flex' }}
                            >
                              <Shield className="h-12 w-12 text-neutral-600" />
                            </div>
                          </div>

                          {/* Suspect Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="h-5 w-5 text-red-400" />
                              <CardTitle className="text-white text-xl">
                                {suspect.person_name || 'Unknown Suspect'}
                              </CardTitle>
                            </div>
                            <CardDescription className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-neutral-500 text-sm">Case Number:</span>
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                                  {suspect.case_number || '-'}
                                </Badge>
                              </div>
                              {suspect.device_info && (
                                <div className="flex items-center gap-2">
                                  <span className="text-neutral-500 text-sm">Device:</span>
                                  <span className="text-neutral-400 text-sm">{suspect.device_info}</span>
                                </div>
                              )}
                              {suspect.suspect_phone && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-neutral-500 text-sm">Phone Number:</span>
                                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 font-mono">
                                    {suspect.suspect_phone}
                                  </Badge>
                                </div>
                              )}
                              {suspect.emails && suspect.emails.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-neutral-500 text-sm">Emails Used:</span>
                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                      {suspect.emails.length} email{suspect.emails.length > 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {suspect.emails.map((email, emailIdx) => (
                                      <Badge 
                                        key={emailIdx} 
                                        variant="outline" 
                                        className="bg-blue-950 text-blue-300 border-blue-800 font-mono text-xs"
                                      >
                                        {email}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-3">
                                <span className="text-neutral-500 text-sm">User Accounts:</span>
                                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                                  {suspect.user_accounts?.length || 0} accounts found
                                </Badge>
                              </div>
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>

                      {/* User Accounts Section - Platform Cards */}
                      {suspect.user_accounts && suspect.user_accounts.length > 0 && (
                        <CardContent className="pt-0">
                          <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Key className="h-4 w-4 text-purple-400" />
                              <h3 className="text-white font-semibold">Social Media & Services</h3>
                            </div>

                            {/* Platform Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {platforms.map(platform => {
                                const accounts = platformAccounts[platform.key];
                                if (accounts.length === 0) return null;
                                
                                const PlatformIcon = platform.icon;
                                
                                return (
                                  <div 
                                    key={platform.key} 
                                    className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-lg p-4 border-2 hover:shadow-lg transition-all"
                                    style={{ borderColor: `${platform.borderColor.replace('border-', '')}` }}
                                  >
                                    {/* Platform Header */}
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className={`p-2 rounded-lg bg-gradient-to-br ${platform.color}`}>
                                        <PlatformIcon className="h-5 w-5 text-white" />
                                      </div>
                                      <div>
                                        <h4 className={`font-semibold ${platform.textColor}`}>{platform.name}</h4>
                                        <p className="text-neutral-500 text-xs">
                                          {accounts.length} account{accounts.length > 1 ? 's' : ''} found
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Account Details */}
                                    <div className="space-y-3">
                                      {accounts.map((account, accIdx) => {
                                        // Check if account has any useful data
                                        const hasUsername = account.username && account.username !== '.';
                                        const hasEmail = account.email;
                                        const hasName = account.name && account.name !== '.' && account.name !== account.username;
                                        const hasUserId = account.user_id;
                                        const hasServiceId = account.service_identifier;
                                        const hasServiceType = account.service_type;
                                        const hasAnyData = hasUsername || hasEmail || hasName || hasUserId || hasServiceId;
                                        
                                        return (
                                        <div key={accIdx} className="bg-neutral-900/70 rounded-lg p-3 space-y-2 border border-neutral-700/50">
                                          {!hasAnyData ? (
                                            <div className="flex items-center gap-2">
                                              <Eye className="h-4 w-4 text-green-400" />
                                              <span className="text-green-400 text-sm font-medium">App Detected</span>
                                              <span className="text-neutral-500 text-xs ml-auto">
                                                Found: {account.source || 'System'}
                                              </span>
                                            </div>
                                          ) : (
                                            <>
                                              {hasUsername && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Username:</span>
                                                  <span className={`text-sm font-semibold break-all ${platform.textColor}`}>
                                                    {account.username}
                                                  </span>
                                                </div>
                                              )}
                                              {hasName && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Name:</span>
                                                  <span className="text-white text-sm break-all">{account.name}</span>
                                                </div>
                                              )}
                                              {hasEmail && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Email:</span>
                                                  <span className="text-blue-400 text-xs font-mono break-all">{account.email}</span>
                                                </div>
                                              )}
                                              {hasUserId && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">
                                                    {account.source === 'LinkedIn' ? 'LinkedIn URN:' : 'User ID:'}
                                                  </span>
                                                  <span className="text-neutral-400 text-xs font-mono break-all" title={account.user_id}>
                                                    {account.source === 'LinkedIn' && account.user_id?.includes('urn:li:') 
                                                      ? `${account.user_id.substring(0, 35)}...` 
                                                      : account.user_id}
                                                  </span>
                                                </div>
                                              )}
                                              {hasServiceId && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Service:</span>
                                                  <span className="text-green-400 text-xs break-all">{account.service_identifier}</span>
                                                </div>
                                              )}
                                              {hasServiceType && !hasServiceId && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Type:</span>
                                                  <span className="text-neutral-400 text-xs break-all italic">{account.service_type}</span>
                                                </div>
                                              )}
                                              
                                              {/* Notes (Occupation, bio, etc.) */}
                                              {account.notes && (
                                                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-neutral-700/50">
                                                  <span className="text-amber-400 text-xs font-medium min-w-[60px]">Info:</span>
                                                  <span className="text-amber-300 text-xs break-all">{account.notes}</span>
                                                </div>
                                              )}
                                              
                                              {/* Metadata (DOB, Bio, etc.) */}
                                              {account.metadata && (
                                                <div className="space-y-1 mt-2 pt-2 border-t border-neutral-700/50">
                                                  {account.metadata['Date of Birth'] && (
                                                    <div className="flex items-start gap-2">
                                                      <span className="text-neutral-500 text-xs font-medium min-w-[60px]">DOB:</span>
                                                      <span className="text-purple-400 text-xs font-semibold">{account.metadata['Date of Birth']}</span>
                                                    </div>
                                                  )}
                                                  {account.metadata['About'] && (
                                                    <div className="flex items-start gap-2">
                                                      <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Bio:</span>
                                                      <span className="text-cyan-300 text-xs italic break-all">{account.metadata['About']}</span>
                                                    </div>
                                                  )}
                                                  {account.metadata['User ID'] && account.metadata['User ID'].length > 0 && (
                                                    <div className="flex items-start gap-2">
                                                      <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Platform ID:</span>
                                                      <span className="text-neutral-400 text-xs font-mono break-all">{account.metadata['User ID'][0]}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              
                                              {account.source && (
                                                <div className="flex items-start gap-2 mt-1 pt-1 border-t border-neutral-700/50">
                                                  <span className="text-neutral-600 text-xs">Source: {account.source}</span>
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Other Services Card */}
                              {(() => {
                                // Only show useful "other" accounts
                                const otherFiltered = platformAccounts.other.filter(acc => {
                                  // Must have at least username or email or service_type
                                  if (!acc.username && !acc.email && !acc.service_type) return false;
                                  
                                  // Skip generic/system entries
                                  const username = (acc.username || '').toLowerCase();
                                  if (username === 'null' || username === 'unknown') return false;
                                  
                                  return true;
                                });
                                
                                if (otherFiltered.length === 0) return null;
                                
                                // Group by source for better organization
                                const groupedBySource = {};
                                otherFiltered.forEach(acc => {
                                  const sourceKey = acc.source || 'Unknown';
                                  if (!groupedBySource[sourceKey]) {
                                    groupedBySource[sourceKey] = [];
                                  }
                                  groupedBySource[sourceKey].push(acc);
                                });
                                
                                return (
                                <div className="md:col-span-2 lg:col-span-3 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-lg p-4 border-2 border-neutral-700">
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-neutral-600 to-neutral-700">
                                      <Database className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-neutral-300">Other Services</h4>
                                      <p className="text-neutral-500 text-xs">
                                        {otherFiltered.length} additional service{otherFiltered.length > 1 ? 's' : ''} detected
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Grouped by source */}
                                  <div className="space-y-4">
                                    {Object.entries(groupedBySource).map(([source, sourceAccounts]) => (
                                      <div key={source} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Badge className="bg-neutral-700 text-neutral-300 border-neutral-600 text-xs">
                                            {source}
                                          </Badge>
                                          <span className="text-neutral-600 text-xs">
                                            ({sourceAccounts.length} {sourceAccounts.length > 1 ? 'accounts' : 'account'})
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                          {sourceAccounts.map((account, accIdx) => (
                                            <div key={accIdx} className="bg-neutral-900/70 rounded-lg p-3 space-y-2 border border-neutral-700/50">
                                              {account.username && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Username:</span>
                                                  <span className="text-neutral-300 text-sm font-semibold break-all">{account.username}</span>
                                                </div>
                                              )}
                                              {account.name && account.name !== '.' && account.name !== account.username && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Name:</span>
                                                  <span className="text-white text-sm break-all">{account.name}</span>
                                                </div>
                                              )}
                                              {account.email && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">Email:</span>
                                                  <span className="text-blue-400 text-xs font-mono break-all">{account.email}</span>
                                                </div>
                                              )}
                                              {account.user_id && (
                                                <div className="flex items-start gap-2">
                                                  <span className="text-neutral-500 text-xs font-medium min-w-[60px]">User ID:</span>
                                                  <span className="text-neutral-400 text-xs font-mono break-all">{account.user_id}</span>
                                                </div>
                                              )}
                                              {account.service_type && (
                                                <div className="flex items-start gap-2 mt-1 pt-1 border-t border-neutral-700/50">
                                                  <span className="text-neutral-600 text-xs break-all">{account.service_type}</span>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                );
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </main>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <DialogHeader>
            <DialogTitle>Upload Case Information</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Please provide case details for: {selectedFile?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="case-number">Numar Dosar (Case Number)</Label>
              <Input
                id="case-number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="e.g., 794/19/P/2025"
                className="bg-neutral-800 border-neutral-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-name">Persoana Perchezitionata (Searched Person)</Label>
              <Input
                id="person-name"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g., Utilizator"
                className="bg-neutral-800 border-neutral-700"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
              className="border-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedContact} onOpenChange={() => {
        setSelectedContact(null);
        setContactDetails(null);
      }}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              {selectedContact?.photo_path && (
                <img 
                  src={`${BACKEND_URL}${selectedContact.photo_path}`} 
                  alt={selectedContact.name} 
                  className="w-24 h-24 rounded-full object-cover border-2 border-amber-500"
                />
              )}
              <div>
                <div className="text-2xl">{selectedContact?.name || 'Contact Details'}</div>
                <div className="text-sm text-neutral-400 font-normal">{selectedContact?.phone}</div>
              </div>
            </DialogTitle>
          </DialogHeader>
          {contactDetails && (
            <div className="space-y-4 py-4 max-h-[600px] overflow-y-auto">
              {/* Main fields */}
              <div className="grid grid-cols-2 gap-4 text-sm border-b border-neutral-800 pb-4">
                <div>
                  <span className="text-neutral-400">Email:</span>
                  <p className="text-white">{selectedContact.email || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">User ID:</span>
                  <p className="text-white font-mono text-xs">{selectedContact.user_id || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Source:</span>
                  <p className="text-white">{selectedContact.source || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Category:</span>
                  <p className="text-white">{selectedContact.category || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Case Number:</span>
                  <p className="text-white">{selectedContact.case_number || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Suspect Name:</span>
                  <p className="text-white">{selectedContact.person_name || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Device:</span>
                  <p className="text-white">{selectedContact.device_info || '-'}</p>
                </div>
              </div>

              {/* WhatsApp Groups */}
              {contactDetails.whatsapp_groups && contactDetails.whatsapp_groups.length > 0 && (
                <div className="border-t border-neutral-800 pt-4">
                  <h4 className="text-green-400 text-sm font-semibold mb-3 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp Groups ({contactDetails.whatsapp_groups.length})
                  </h4>
                  <div className="space-y-2">
                    {contactDetails.whatsapp_groups.map((group, idx) => (
                      <div key={idx} className="bg-neutral-800/50 p-3 rounded text-sm hover:bg-neutral-800 transition-colors">
                        <div className="text-white font-medium">{group.group_name}</div>
                        <div className="text-neutral-500 text-xs mt-1 font-mono">
                          {group.group_id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All XML Fields */}
              {selectedContact.raw_data && (
                <div className="border-t border-neutral-800 pt-4">
                  <h4 className="text-amber-400 text-sm font-semibold mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Complete XML Data
                  </h4>
                  
                  {/* XML Fields */}
                  {selectedContact.raw_data.fields && Object.keys(selectedContact.raw_data.fields).length > 0 && (
                    <div className="bg-neutral-800/50 p-4 rounded mb-3">
                      <h5 className="text-neutral-400 text-xs mb-2 uppercase">Fields</h5>
                      <div className="space-y-2">
                        {Object.entries(selectedContact.raw_data.fields).map(([key, value]) => (
                          <div key={key} className="flex border-b border-neutral-700/50 pb-1">
                            <span className="text-neutral-400 text-xs w-1/3 flex-shrink-0">{key}:</span>
                            <span className="text-white text-xs font-mono flex-1 break-all">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* XML Sub-Models (PhoneNumber, Email, UserID, etc.) */}
                  {selectedContact.raw_data.models && Object.keys(selectedContact.raw_data.models).length > 0 && (
                    <div className="space-y-3">
                      {Object.entries(selectedContact.raw_data.models).map(([modelType, modelArray]) => (
                        <div key={modelType} className="bg-neutral-800/50 p-4 rounded">
                          <h5 className="text-neutral-400 text-xs mb-2 uppercase">{modelType} ({modelArray.length})</h5>
                          {modelArray.map((model, idx) => (
                            <div key={idx} className="mb-3 last:mb-0 pl-3 border-l-2 border-amber-600/50">
                              {Object.entries(model).map(([key, value]) => (
                                <div key={key} className="flex border-b border-neutral-700/30 pb-1 mb-1">
                                  <span className="text-neutral-500 text-xs w-1/3 flex-shrink-0">{key}:</span>
                                  <span className="text-white text-xs font-mono flex-1 break-all">{value}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Duplicates */}
              {contactDetails.total_duplicates > 1 && (
                <div className="border-t border-neutral-800 pt-4">
                  <h4 className="text-neutral-400 text-sm mb-2">
                    Duplicate Records ({contactDetails.total_duplicates})
                  </h4>
                  <div className="space-y-2">
                    {contactDetails.all_records.map((record, idx) => (
                      <div key={idx} className="bg-neutral-800/50 p-3 rounded text-xs">
                        <div className="flex justify-between">
                          <span className="text-white">{record.name}</span>
                          <span className="text-neutral-400">{record.source}</span>
                        </div>
                        <div className="text-neutral-500 mt-1">
                          Device: {record.device_info} | Case: {record.case_number}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credential Detail Dialog */}
      <Dialog open={!!selectedCredential} onOpenChange={() => {
        setSelectedCredential(null);
        setCredentialDetails(null);
        setExpandedGroups({});
      }}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Key className="h-6 w-6 text-black" />
              </div>
              <div>
                <div className="text-xl">Credential Details</div>
                <div className="text-sm text-neutral-400 font-normal">
                  {selectedCredential?.application || selectedCredential?.source || 'Unknown'}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedCredential && credentialDetails && (
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {/* Main Information */}
              <div className="grid grid-cols-2 gap-4 text-sm border-b border-neutral-800 pb-4">
                <div>
                  <Label className="text-neutral-400 text-xs mb-2 block">Category:</Label>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={selectedCredential.category || 'Other'} 
                      onValueChange={(value) => {
                        if (selectedCredential.id) {
                          handleUpdateCredentialCategory(selectedCredential.id, value);
                        }
                      }}
                    >
                      <SelectTrigger className={`text-xs ${
                        selectedCredential.category === 'Email' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                        selectedCredential.category === 'Social Media' ? 'bg-blue-950 text-blue-300 border-blue-800' :
                        selectedCredential.category === 'Google Services' ? 'bg-red-950 text-red-300 border-red-800' :
                        selectedCredential.category === 'Banking' ? 'bg-green-950 text-green-300 border-green-800' :
                        selectedCredential.category === 'Gaming' ? 'bg-orange-950 text-orange-300 border-orange-800' :
                        'bg-neutral-800 text-neutral-300 border-neutral-700'
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Social Media">Social Media</SelectItem>
                        <SelectItem value="Google Services">Google Services</SelectItem>
                        <SelectItem value="Banking">Banking</SelectItem>
                        <SelectItem value="Gaming">Gaming</SelectItem>
                        <SelectItem value="Shopping">Shopping</SelectItem>
                        <SelectItem value="Entertainment">Entertainment</SelectItem>
                        <SelectItem value="Work">Work</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <span className="text-neutral-400">Application:</span>
                  <p className="text-white">{selectedCredential.application || selectedCredential.source || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Username/Email:</span>
                  <p className="text-white font-mono text-xs break-all">{selectedCredential.username || selectedCredential.email || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Credential/Value:</span>
                  <p className="text-white font-mono text-xs break-all">{selectedCredential.password || selectedCredential.user_id || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">URL:</span>
                  <p className="text-white text-xs break-all">{selectedCredential.url || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Email Domain:</span>
                  <p className="text-white text-xs">{selectedCredential.email_domain || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Case Number:</span>
                  <p className="text-white">{selectedCredential.case_number || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Suspect Name:</span>
                  <p className="text-white">{selectedCredential.person_name || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Device:</span>
                  <p className="text-white">{selectedCredential.device_info || '-'}</p>
                </div>
              </div>

              {/* Complete XML Data */}
              {selectedCredential.raw_data && selectedCredential.raw_data.fields && (
                <div className="border-t border-neutral-800 pt-4">
                  <h4 className="text-amber-400 text-sm font-semibold mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Complete XML Data
                  </h4>
                  
                  <div className="bg-neutral-800/50 p-4 rounded">
                    <h5 className="text-neutral-400 text-xs mb-3 uppercase">All Fields from XML</h5>
                    <div className="space-y-2">
                      {Object.entries(selectedCredential.raw_data.fields).map(([key, value]) => (
                        <div key={key} className="flex border-b border-neutral-700/50 pb-2">
                          <span className="text-neutral-400 text-xs w-1/4 flex-shrink-0 font-semibold">{key}:</span>
                          <span className="text-white text-xs font-mono flex-1 break-all whitespace-pre-wrap">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* XML ID */}
                  {selectedCredential.raw_data.xml_id && (
                    <div className="mt-3 text-xs text-neutral-500">
                      XML ID: {selectedCredential.raw_data.xml_id}
                    </div>
                  )}
                </div>
              )}

              {/* Description if exists */}
              {selectedCredential.description && (
                <div className="border-t border-neutral-800 pt-4">
                  <h5 className="text-neutral-400 text-xs mb-2">Description/Notes:</h5>
                  <p className="text-white text-xs font-mono bg-neutral-800/50 p-3 rounded break-all whitespace-pre-wrap">
                    {selectedCredential.description}
                  </p>
                </div>
              )}

              {/* Duplicate Records Section - Tree View */}
              {credentialDetails.total_duplicates > 1 && (() => {
                // Group duplicates by Account and ServiceIdentifier
                const groupedRecords = {};
                
                credentialDetails.all_records.forEach((record, idx) => {
                  // Account: Check XML fields first, then fallback to top-level fields
                  // Priority: raw_data.fields.Account > username > email > user_id
                  const account = record.raw_data?.fields?.Account || 
                                  record.username || 
                                  record.email || 
                                  record.user_id || 
                                  'Unknown Account';
                  
                  // ServiceIdentifier: Check XML fields first, then fallback to top-level fields
                  // Priority: raw_data.fields.ServiceIdentifier > service_identifier > url > application > source
                  const serviceIdentifier = record.raw_data?.fields?.ServiceIdentifier || 
                                           record.service_identifier || 
                                           record.url || 
                                           record.application || 
                                           record.source || 
                                           'Unknown Service';
                  
                  const groupKey = `${account}|||${serviceIdentifier}`;
                  
                  if (!groupedRecords[groupKey]) {
                    groupedRecords[groupKey] = {
                      account,
                      serviceIdentifier,
                      records: []
                    };
                  }
                  
                  groupedRecords[groupKey].records.push({ ...record, originalIndex: idx });
                });
                
                const toggleGroup = (groupKey) => {
                  setExpandedGroups(prev => ({
                    ...prev,
                    [groupKey]: !prev[groupKey]
                  }));
                };
                
                return (
                  <div className="border-t border-neutral-800 pt-4">
                    <h4 className="text-amber-400 text-sm font-semibold mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      All Duplicate Entries ({credentialDetails.total_duplicates}) - Grouped by Account & Service
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(groupedRecords).map(([groupKey, group]) => {
                        const isExpanded = expandedGroups[groupKey];
                        
                        return (
                          <div key={groupKey} className="bg-neutral-800/30 rounded border border-neutral-700/50">
                            {/* Group Header */}
                            <div 
                              className="flex items-center gap-2 p-3 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                              onClick={() => toggleGroup(groupKey)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-amber-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="bg-blue-950 text-blue-300 border-blue-800 font-mono text-xs">
                                    Account: {group.account}
                                  </Badge>
                                  <Badge variant="outline" className="bg-green-950 text-green-300 border-green-800 font-mono text-xs">
                                    Service: {group.serviceIdentifier}
                                  </Badge>
                                  <Badge variant="outline" className="bg-amber-950 text-amber-300 border-amber-800">
                                    {group.records.length} {group.records.length === 1 ? 'entry' : 'entries'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            {/* Expanded Group Content */}
                            {isExpanded && (
                              <div className="border-t border-neutral-700/50 p-3 space-y-3">
                                {group.records.map((record) => (
                                  <div key={record.originalIndex} className="bg-neutral-900/50 p-3 rounded border border-neutral-700/30">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="col-span-2">
                                        <span className="text-amber-400 font-semibold">Entry #{record.originalIndex + 1}</span>
                                      </div>
                                      <div>
                                        <span className="text-neutral-400">Application/Source:</span>
                                        <p className="text-white">{record.application || record.source || '-'}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-400">Username/Email:</span>
                                        <p className="text-white font-mono break-all">{record.username || record.email || '-'}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-400">Credential/Value:</span>
                                        <p className="text-white font-mono break-all">{record.password || record.user_id || '-'}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-400">URL/Service:</span>
                                        <p className="text-white break-all">{record.url || record.service_identifier || '-'}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-400">Case:</span>
                                        <p className="text-white">{record.case_number || '-'}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-400">Device:</span>
                                        <p className="text-white">{record.device_info || '-'}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-400">Category:</span>
                                        <p className="text-white">
                                          <Badge variant="outline" className={
                                            record.category === 'Email' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                                            record.category === 'Social Media' ? 'bg-blue-950 text-blue-300 border-blue-800' :
                                            record.category === 'Google Services' ? 'bg-red-950 text-red-300 border-red-800' :
                                            'bg-neutral-800 text-neutral-300 border-neutral-700'
                                          }>
                                            {record.category || 'Other'}
                                          </Badge>
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Show raw XML data for each duplicate */}
                                    {record.raw_data && record.raw_data.fields && (
                                      <div className="mt-3 pt-3 border-t border-neutral-700/30">
                                        <h5 className="text-neutral-400 text-xs mb-2 uppercase">XML Fields for Entry #{record.originalIndex + 1}</h5>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                          {Object.entries(record.raw_data.fields).map(([key, value]) => (
                                            <div key={key} className="flex border-b border-neutral-700/20 pb-1">
                                              <span className="text-neutral-500 text-xs w-1/3 flex-shrink-0">{key}:</span>
                                              <span className="text-white text-xs font-mono flex-1 break-all">{value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Group Members Dialog */}
      <Dialog open={!!selectedWhatsappGroup} onOpenChange={() => {
        setSelectedWhatsappGroup(null);
        setGroupMembers([]);
      }}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <MessageCircle className="h-6 w-6 text-black" />
              </div>
              <div>
                <div className="text-xl">{selectedWhatsappGroup?.group_name || 'WhatsApp Group'}</div>
                <div className="text-sm text-neutral-400 font-normal">
                  {selectedWhatsappGroup?.member_count || 0} members
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedWhatsappGroup && (
            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {/* Group Information */}
              <div className="grid grid-cols-2 gap-4 text-sm border-b border-neutral-800 pb-4">
                <div>
                  <span className="text-neutral-400">Group ID:</span>
                  <p className="text-white font-mono text-xs break-all">{selectedWhatsappGroup.group_id}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Total Members:</span>
                  <p className="text-white">{selectedWhatsappGroup.member_count}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Cases:</span>
                  <p className="text-white">{selectedWhatsappGroup.cases?.join(', ') || '-'}</p>
                </div>
                <div>
                  <span className="text-neutral-400">Devices:</span>
                  <p className="text-white">{selectedWhatsappGroup.devices?.join(', ') || '-'}</p>
                </div>
              </div>

              {/* Members List */}
              <div className="border-t border-neutral-800 pt-4">
                <h4 className="text-amber-400 text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Group Members ({groupMembers.length})
                </h4>
                
                <div className="space-y-2">
                  {groupMembers.map((member, idx) => (
                    <div 
                      key={member.id || idx} 
                      className="bg-neutral-800/50 rounded border border-neutral-700/30 hover:bg-neutral-800 transition-colors"
                    >
                      <div 
                        className="p-3 cursor-pointer"
                        onClick={() => handleContactClick(member)}
                      >
                        <div className="flex items-center gap-4">
                          {member.photo_path && (
                            <img 
                              src={`${BACKEND_URL}${member.photo_path}`} 
                              alt={member.name} 
                              className="w-12 h-12 rounded-full object-cover border border-amber-500"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-white font-medium">{member.name || 'Unknown'}</p>
                                  {member.source_count > 1 && (
                                    <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-xs rounded-full border border-amber-600/30">
                                      {member.source_count} sources
                                    </span>
                                  )}
                                </div>
                                <p className="text-neutral-400 text-xs font-mono">{member.phone || member.user_id || '-'}</p>
                              </div>
                              <div className="text-right text-xs text-neutral-400">
                                <p>Case: {member.case_number || '-'}</p>
                                <p>Device: {member.device_info || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Show all sources if more than 1 */}
                      {member.source_count > 1 && member.all_sources && (
                        <div className="border-t border-neutral-700/50 px-3 py-2 bg-neutral-900/50">
                          <p className="text-xs text-neutral-500 mb-2">Found in {member.source_count} sources:</p>
                          <div className="space-y-1">
                            {member.all_sources.map((source, sidx) => (
                              <div key={sidx} className="text-xs text-neutral-400 flex justify-between">
                                <span>• {source.name || 'Unknown'}</span>
                                <span className="text-neutral-500">{source.device_info}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Credentials Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-green-400" />
              Export Credentials
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Choose export format and download credentials data
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white mb-2 block">Export Type</Label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wordlist">
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Wordlist</span>
                      <span className="text-xs text-neutral-400">Unique passwords only (for password analysis)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="full">
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Full Export</span>
                      <span className="text-xs text-neutral-400">All fields in CSV format (for reports)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-neutral-800 p-3 rounded border border-neutral-700">
              <h4 className="text-sm font-semibold text-white mb-2">Active Filters:</h4>
              <div className="text-xs text-neutral-400 space-y-1">
                {filters.credentials.case !== "all" && (
                  <div>• Case: {filters.credentials.case}</div>
                )}
                {filters.credentials.account !== "all" && (
                  <div>• Account: {filters.credentials.account}</div>
                )}
                {filters.credentials.service !== "all" && (
                  <div>• Service: {filters.credentials.service}</div>
                )}
                {filters.credentials.type !== "all" && (
                  <div>• Type: {filters.credentials.type}</div>
                )}
                {filters.credentials.device !== "all" && (
                  <div>• Device: {filters.credentials.device}</div>
                )}
                {filters.credentials.suspect !== "all" && (
                  <div>• Suspect: {filters.credentials.suspect}</div>
                )}
                {Object.values(filters.credentials).every(v => v === "all") && (
                  <div className="text-neutral-500">No filters applied - exporting all data</div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleExportCredentials}
                disabled={exporting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {exporting ? (
                  <>Exporting...</>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export {exportType === "wordlist" ? "Wordlist" : "CSV"}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowExportDialog(false)}
                disabled={exporting}
                className="border-neutral-700 text-white hover:bg-neutral-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;