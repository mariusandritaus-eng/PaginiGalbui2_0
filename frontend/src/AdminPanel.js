import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Trash2, AlertTriangle, LogOut, Database, ChevronDown, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = BACKEND_URL;

function AdminPanel({ onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedCases, setExpandedCases] = useState({});

  useEffect(() => {
    if (isAuthenticated) {
      loadCases();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      await axios.post(`${API}/admin/login`, { username, password });
      setIsAuthenticated(true);
    } catch (error) {
      setLoginError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/cases`);
      setCases(response.data);
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (session) => {
    setLoading(true);
    try {
      // Use profile_id method if available (more precise)
      if (session.profile_id) {
        await axios.delete(`${API}/admin/sessions/by-profile/${encodeURIComponent(session.profile_id)}`);
      } else {
        // Fallback to case_number/person_name/device_info method for sessions without profile_id
        const caseNumber = encodeURIComponent(session.case_number);
        const personName = encodeURIComponent(session.person_name);
        const deviceInfo = encodeURIComponent(session.device_info);
        await axios.delete(`${API}/admin/sessions/${caseNumber}/${personName}/${deviceInfo}`);
      }
      // Reload cases after deletion
      await loadCases();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleCase = (caseNumber) => {
    setExpandedCases(prev => ({
      ...prev,
      [caseNumber]: !prev[caseNumber]
    }));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setCases([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-md p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-amber-600 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Admin Login</h2>
              <p className="text-neutral-400 text-sm">Database Management</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-4xl my-8 relative">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-600 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Database Management</h2>
              <p className="text-neutral-400 text-sm">Manage uploaded cases</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition-colors p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading && cases.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">Loading cases...</div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">No cases found in database</div>
          ) : (
            <>
              <div className="space-y-4">
              {cases.map((caseData) => (
                <div
                  key={caseData.case_number}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden"
                >
                  {/* Case Header - Clickable to expand/collapse */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-neutral-750 transition-colors"
                    onClick={() => toggleCase(caseData.case_number)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {expandedCases[caseData.case_number] ? (
                          <ChevronDown className="w-5 h-5 text-amber-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-neutral-400" />
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-white">
                            {caseData.case_number}
                          </h3>
                          <div className="flex gap-4 text-sm mt-1">
                            <div className="text-blue-400">
                              <span className="font-medium">{caseData.totals.contacts.toLocaleString()}</span>
                              <span className="text-neutral-500 ml-1">contacts</span>
                            </div>
                            <div className="text-amber-400">
                              <span className="font-medium">{caseData.totals.passwords.toLocaleString()}</span>
                              <span className="text-neutral-500 ml-1">passwords</span>
                            </div>
                            <div className="text-purple-400">
                              <span className="font-medium">{caseData.totals.user_accounts.toLocaleString()}</span>
                              <span className="text-neutral-500 ml-1">accounts</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-neutral-400 text-sm">
                          {caseData.sessions.length} upload{caseData.sessions.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sessions List - Shown when expanded */}
                  {expandedCases[caseData.case_number] && (
                    <div className="border-t border-neutral-700 bg-neutral-850">
                      {caseData.sessions.map((session, idx) => (
                        <div
                          key={session.session_id}
                          className={`p-4 flex items-start justify-between hover:bg-neutral-800 transition-colors ${
                            idx !== caseData.sessions.length - 1 ? 'border-b border-neutral-700' : ''
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-medium">
                                {session.person_name || 'Unknown Person'}
                              </span>
                              <span className="text-neutral-500">•</span>
                              <span className="text-neutral-400 text-sm">
                                {session.device_info || 'Unknown Device'}
                              </span>
                              {session.uploaded_at && session.uploaded_at !== 'Unknown' && (
                                <>
                                  <span className="text-neutral-500">•</span>
                                  <span className="text-neutral-500 text-xs">
                                    {new Date(session.uploaded_at).toLocaleString()}
                                  </span>
                                </>
                              )}
                            </div>
                            
                            <div className="flex gap-4 text-sm">
                              <div className="text-blue-400">
                                <span className="font-medium">{session.contacts.toLocaleString()}</span>
                                <span className="text-neutral-500 ml-1">contacts</span>
                              </div>
                              <div className="text-amber-400">
                                <span className="font-medium">{session.passwords.toLocaleString()}</span>
                                <span className="text-neutral-500 ml-1">passwords</span>
                              </div>
                              <div className="text-purple-400">
                                <span className="font-medium">{session.user_accounts.toLocaleString()}</span>
                                <span className="text-neutral-500 ml-1">accounts</span>
                              </div>
                              <div className="text-neutral-500 ml-auto">
                                <span className="font-medium">{session.total.toLocaleString()}</span>
                                <span className="ml-1">total</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(session);
                            }}
                            className="ml-4 p-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors"
                            title="Delete this upload session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Data Cleanup Section */}
            <div className="mt-8 pt-6 border-t border-neutral-700">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-500" />
                Database Cleanup Tools
              </h3>
              <p className="text-sm text-neutral-400 mb-4">
                Remove incorrectly imported data from the database
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    if (!window.confirm('Remove all WhatsApp newsletter/channel entries from contacts? This will clean up duplicate contact records.')) return;
                    setLoading(true);
                    try {
                      const response = await axios.post(`${API}/admin/cleanup-newsletters`);
                      alert(`✅ Success: ${response.data.message}`);
                      await loadCases(); // Reload to show updated counts
                    } catch (error) {
                      alert(`❌ Error: ${error.message}`);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 text-blue-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clean Newsletters
                </button>
                
                <button
                  onClick={async () => {
                    if (!window.confirm('Remove all WhatsApp group entries from contacts? This will clean up group records.')) return;
                    setLoading(true);
                    try {
                      const response = await axios.post(`${API}/admin/cleanup-groups`);
                      alert(`✅ Success: ${response.data.message}`);
                      await loadCases();
                    } catch (error) {
                      alert(`❌ Error: ${error.message}`);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800/50 text-purple-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clean Groups
                </button>
              </div>
              
              <div className="mt-3 p-3 bg-neutral-800/50 rounded-lg text-xs text-neutral-400">
                <strong>Note:</strong> These tools remove incorrectly imported data. Future uploads will automatically filter out these entries.
              </div>
            </div>
            </>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-red-800 rounded-xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-900/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Confirm Deletion</h3>
              </div>

              <p className="text-neutral-300 mb-2">
                Are you sure you want to delete this upload session?
              </p>
              
              <div className="bg-neutral-800 rounded-lg p-3 mb-4">
                <div className="text-white font-medium mb-1">
                  {deleteConfirm.person_name || 'Unknown Person'}
                </div>
                <div className="text-neutral-400 text-sm">
                  {deleteConfirm.device_info || 'Unknown Device'}
                </div>
              </div>

              <div className="bg-neutral-800 rounded-lg p-3 mb-4 space-y-1 text-sm">
                <div className="text-neutral-400">This will permanently delete:</div>
                <div className="text-blue-400">• {deleteConfirm.contacts.toLocaleString()} contacts</div>
                <div className="text-amber-400">• {deleteConfirm.passwords.toLocaleString()} passwords</div>
                <div className="text-purple-400">• {deleteConfirm.user_accounts.toLocaleString()} user accounts</div>
                <div className="text-neutral-500">• All associated images and files</div>
              </div>

              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-6">
                <p className="text-red-400 text-sm font-medium">
                  ⚠️ This action cannot be undone!
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleDeleteSession(deleteConfirm.profile_id);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:bg-neutral-700 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete Session'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
