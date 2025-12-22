import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Database, Users, Key, UserCircle } from "lucide-react";
import AdminPanel from "./AdminPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = BACKEND_URL;

// Animated counter component
const AnimatedCounter = ({ end, duration = 2000, label, icon: Icon, color }) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || end === 0) return;

    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      setCount(Math.floor(easeOutCubic * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVisible, end, duration]);

  // Format number with thousands separator
  const formatNumber = (num) => {
    return num.toLocaleString('en-US');
  };

  return (
    <div 
      ref={ref}
      className="flex flex-col items-center p-6 bg-neutral-900/50 rounded-xl border border-neutral-800 backdrop-blur-sm hover:border-amber-500/50 transition-all duration-300"
    >
      <div className={`p-3 rounded-full ${color} mb-4`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <div className="text-4xl sm:text-5xl font-bold text-white mb-2 font-mono tabular-nums">
        {formatNumber(count)}
      </div>
      <div className="text-neutral-400 text-sm uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
};

// Rotating digit component for slot machine effect
const RotatingDigit = ({ digit, delay = 0 }) => {
  const [currentDigit, setCurrentDigit] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!isAnimating) return;

    const totalDuration = 2000 + delay;
    const interval = 50;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += interval;
      if (elapsed < totalDuration - 500) {
        // Fast rotation
        setCurrentDigit(Math.floor(Math.random() * 10));
      } else if (elapsed < totalDuration) {
        // Slow down
        setCurrentDigit(Math.floor(Math.random() * 10));
      } else {
        // Stop at final digit
        setCurrentDigit(digit);
        setIsAnimating(false);
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [digit, delay, isAnimating]);

  return (
    <span className={`inline-block transition-all duration-100 ${isAnimating ? 'blur-[1px]' : ''}`}>
      {currentDigit}
    </span>
  );
};

// Slot machine counter for more dramatic effect
const SlotMachineCounter = ({ end, label, icon: Icon, color }) => {
  const digits = String(end).split('');
  
  return (
    <div className="flex flex-col items-center p-6 bg-neutral-900/50 rounded-xl border border-neutral-800 backdrop-blur-sm hover:border-amber-500/50 transition-all duration-300">
      <div className={`p-3 rounded-full ${color} mb-4`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <div className="text-4xl sm:text-5xl font-bold text-white mb-2 font-mono tabular-nums flex">
        {digits.map((d, i) => (
          <RotatingDigit key={i} digit={parseInt(d)} delay={i * 100} />
        ))}
      </div>
      <div className="text-neutral-400 text-sm uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
};

function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ contacts: 0, passwords: 0, user_accounts: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [availableCases, setAvailableCases] = useState([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    loadStats();
    loadFilters();
  }, []);

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
      setStatsLoaded(true);
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
      
      const allCases = [...new Set([
        ...(contactFilters.data.cases || []),
        ...(passwordFilters.data.cases || []),
        ...(accountFilters.data.cases || [])
      ])].filter(c => c).sort();
      setAvailableCases(allCases);
    } catch (error) {
      console.error("Error loading filters:", error);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/app?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchClick = () => {
    if (searchQuery.trim()) {
      navigate(`/app?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleCaseSelect = (value) => {
    setSelectedCase(value);
    if (value && value !== "all") {
      navigate(`/app?case=${encodeURIComponent(value)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex flex-col">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-4 right-4 w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
              PaginiGalbui
            </span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Intelligence Database for Forensic Analysis
          </p>
        </div>

        {/* Animated Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 w-full max-w-3xl">
          {statsLoaded ? (
            <>
              <AnimatedCounter
                end={stats.contacts}
                label="Contacts"
                icon={Users}
                color="bg-blue-600"
                duration={2000}
              />
              <AnimatedCounter
                end={stats.passwords}
                label="Passwords"
                icon={Key}
                color="bg-amber-600"
                duration={2200}
              />
              <AnimatedCounter
                end={stats.user_accounts}
                label="Accounts"
                icon={UserCircle}
                color="bg-purple-600"
                duration={2400}
              />
            </>
          ) : (
            <>
              <div className="flex flex-col items-center p-6 bg-neutral-900/50 rounded-xl border border-neutral-800 animate-pulse">
                <div className="w-14 h-14 bg-neutral-800 rounded-full mb-4" />
                <div className="w-24 h-10 bg-neutral-800 rounded mb-2" />
                <div className="w-16 h-4 bg-neutral-800 rounded" />
              </div>
              <div className="flex flex-col items-center p-6 bg-neutral-900/50 rounded-xl border border-neutral-800 animate-pulse">
                <div className="w-14 h-14 bg-neutral-800 rounded-full mb-4" />
                <div className="w-24 h-10 bg-neutral-800 rounded mb-2" />
                <div className="w-16 h-4 bg-neutral-800 rounded" />
              </div>
              <div className="flex flex-col items-center p-6 bg-neutral-900/50 rounded-xl border border-neutral-800 animate-pulse">
                <div className="w-14 h-14 bg-neutral-800 rounded-full mb-4" />
                <div className="w-24 h-10 bg-neutral-800 rounded mb-2" />
                <div className="w-16 h-4 bg-neutral-800 rounded" />
              </div>
            </>
          )}
        </div>

        {/* Search and Case Selection */}
        <div className="w-full max-w-2xl space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-neutral-500" />
            </div>
            <Input
              type="text"
              placeholder="Search contacts, emails, phone numbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-12 pr-24 py-6 text-lg bg-neutral-900/80 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
            />
            <button
              onClick={handleSearchClick}
              disabled={!searchQuery.trim()}
              className="absolute inset-y-2 right-2 px-6 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Search
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-neutral-500 text-sm">or</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Case Selector */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <Select onValueChange={handleCaseSelect} value={selectedCase}>
                <SelectTrigger className="w-full py-6 text-lg bg-neutral-900/80 border-neutral-700 text-white focus:border-amber-500 focus:ring-amber-500/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-neutral-500" />
                    <SelectValue placeholder="Select a case to view..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700">
                  {availableCases.map((caseNum) => (
                    <SelectItem 
                      key={caseNum} 
                      value={caseNum}
                      className="text-white hover:bg-neutral-800 focus:bg-neutral-800"
                    >
                      {caseNum}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick action hint */}
          <p className="text-center text-neutral-500 text-sm mt-6">
            Press Enter to search or select a case to browse data
          </p>
        </div>

        {/* Browse All Link */}
        <div className="mt-8">
          <button
            onClick={() => navigate('/app')}
            className="text-neutral-400 hover:text-amber-500 transition-colors text-sm underline underline-offset-4"
          >
            Browse all data →
          </button>
        </div>
      </div>

      {/* Footer with centered DCCO logo */}
      <footer className="relative z-10 py-6 flex justify-center items-center">
        <img 
          src="/dcco-logo.png" 
          alt="DCCO Logo" 
          className="h-32 object-contain"
        />
      </footer>

      {/* Floating Kenny image in bottom right - clickable for admin panel */}
      <div 
        className="fixed bottom-6 right-6 z-50 group cursor-pointer"
        onClick={() => setShowAdminPanel(true)}
      >
        <img 
          src="/logo.png" 
          alt="Made by A.M." 
          className="h-16 w-auto drop-shadow-lg transition-transform duration-300 hover:scale-110"
        />
        {/* Tooltip on hover */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-neutral-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
          Made by A.M.
        </div>
      </div>

      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}

export default LandingPage;
