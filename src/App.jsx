import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Layers, 
  FileText, 
  Search, 
  Plus, 
  ChevronRight, 
  ArrowLeft, 
  Check, 
  Lock, 
  Unlock, 
  Smartphone, 
  Monitor,
  Info,
  ChevronLeft,
  Camera,
  MessageSquare,
  LogOut,
  Database,
  RefreshCw,
  Copy,
  Upload,
  MoreVertical,
  Edit2,
  Trash2,
  BarChart3,
  TrendingUp,
  PieChart,
  CheckCircle2,
  Shield,
  Key,
  UserCheck,
  UserX,
  AlertTriangle,
  CreditCard,
  ExternalLink,
  CheckCircle,
  Printer,
  Package,
  Sparkles,
  Scissors,
  ShoppingBag,
  Tag,
  Sun,
  Moon
} from 'lucide-react';
import defaultLogoImg from './assets/logo.png';
import { supabase } from './supabaseClient';
import { registerPlugin } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const SystemBars = registerPlugin('SystemBars');

const logoImg = defaultLogoImg;
const INITIAL_CLIENTS = [];

const INITIAL_INVENTORY = [];

const SQL_SCHEMA_INSTRUCTION = `-- PASTE THIS IN YOUR SUPABASE SQL EDITOR:

-- 1. Create the clients table
create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  garment_type text,
  status text,
  stage text,
  bolt_width text,
  notes text,
  total_billing numeric default 0,
  paid_deposit numeric default 0,
  measurements jsonb default '{}'::jsonb,
  last_measured text,
  fabric_swatch_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clients enable row level security;
create policy "Users manage own clients" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Allow public read by phone" on public.clients for select using (true);

-- 2. Setup Storage policies for 'Tailorpro' bucket
create policy "Public read access" on storage.objects for select using (bucket_id = 'Tailorpro');
create policy "Authenticated upload access" on storage.objects for insert to authenticated with check (bucket_id = 'Tailorpro');

-- 3. Profiles & Access Approval control table
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  studio_name text,
  designer_name text,
  role text default 'owner',
  status text default 'pending',
  plan text default 'free',
  license_key text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;
drop policy if exists "Authenticated view profiles" on public.profiles;
drop policy if exists "Users manage own profile" on public.profiles;
drop policy if exists "Allow public insertion on signup" on public.profiles;
drop policy if exists "Allow update profiles" on public.profiles;

create policy "Authenticated view profiles" on public.profiles for select to authenticated using (true);
create policy "Allow public insertion on signup" on public.profiles for insert with check (true);
create policy "Allow update profiles" on public.profiles for update to authenticated using (true);

-- 4. Activation / License Keys table
create table if not exists public.license_keys (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  plan text default 'pro',
  is_used boolean default false,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.license_keys enable row level security;
create policy "Authenticated access license keys" on public.license_keys for all to authenticated using (true);

-- 5. Inventory & Materials Tracker table
create table if not exists public.inventory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  item_name text not null,
  category text default 'Fabric',
  quantity numeric default 0,
  unit text default 'Yards',
  low_stock_threshold numeric default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.inventory enable row level security;
create policy "Users manage own inventory" on public.inventory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
`;

const maleFields = [
  { key: 'chest', label: 'Chest', segment: 'UPPER BODY' },
  { key: 'shoulder', label: 'Shoulder', segment: 'UPPER BODY' },
  { key: 'neck', label: 'Neck', segment: 'UPPER BODY' },
  { key: 'sleeve', label: 'Sleeve Length', segment: 'UPPER BODY' },
  { key: 'waist', label: 'Waist', segment: 'LOWER BODY' },
  { key: 'hips', label: 'Hips', segment: 'LOWER BODY' },
  { key: 'thigh', label: 'Thigh', segment: 'LOWER BODY' },
  { key: 'knee', label: 'Knee', segment: 'LOWER BODY' },
  { key: 'ankle', label: 'Ankle', segment: 'LOWER BODY' },
  { key: 'inseam', label: 'Inseam', segment: 'LOWER BODY' },
  { key: 'length', label: 'Full Length', segment: 'LOWER BODY' },
];

const femaleFields = [
  { key: 'bust', label: 'Bust', segment: 'UPPER BODY' },
  { key: 'shoulder', label: 'Shoulder', segment: 'UPPER BODY' },
  { key: 'underbust', label: 'Underbust', segment: 'UPPER BODY' },
  { key: 'breast_length', label: 'Breast Length', segment: 'UPPER BODY' },
  { key: 'sleeve', label: 'Sleeve Length', segment: 'UPPER BODY' },
  { key: 'round_sleeves', label: 'Round Sleeves', segment: 'UPPER BODY' },
  { key: 'top_length', label: 'Top Length', segment: 'UPPER BODY' },
  { key: 'waist', label: 'Waist', segment: 'LOWER BODY' },
  { key: 'hips', label: 'Hips', segment: 'LOWER BODY' },
  { key: 'skirt_length', label: 'Skirt Length', segment: 'LOWER BODY' },
  { key: 'length', label: 'Full Length', segment: 'LOWER BODY' },
];

export default function App() {
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [activeTab, setActiveTab] = useState('clients');
  const [searchQuery, setSearchQuery] = useState('');
  
  // App authentication & Supabase status
  const [authStatus, setAuthStatus] = useState('splash'); // splash, login, signup, authenticated
  const [studioName, setStudioName] = useState('Classic Stitches Studio');
  const [studioLogo, setStudioLogo] = useState(''); // Holds brand logo URL uploaded by designer
  const [momoNumber, setMomoNumber] = useState('0546920418');
  const [momoName, setMomoName] = useState('Mubarik Tuahir Ali');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [workshopLockPin, setWorkshopLockPin] = useState('1234');
  const [signUpRole, setSignUpRole] = useState('owner'); // owner, tailor, front_desk
  const [userRole, setUserRole] = useState('owner'); // owner, tailor, front_desk
  
  // Upload brand logo state
  const [tempLogoFile, setTempLogoFile] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');

  // Super Admin & License Authorization states
  const [signUpLicenseKey, setSignUpLicenseKey] = useState('');
  const [pendingLicenseKey, setPendingLicenseKey] = useState('');
  const [isActivatingKey, setIsActivatingKey] = useState(false);
  const [pendingKeyError, setPendingKeyError] = useState('');
  const [accountApprovalStatus, setAccountApprovalStatus] = useState('approved'); // approved, pending, blocked
  const [adminSubTab, setAdminSubTab] = useState('users'); // users, keys, sql
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [adminKeysList, setAdminKeysList] = useState([]);
  const [newKeyPlan, setNewKeyPlan] = useState('pro');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Inventory Tracker states
  const [inventoryList, setInventoryList] = useState(INITIAL_INVENTORY);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [invName, setInvName] = useState('');
  const [invCategory, setInvCategory] = useState('Fabric');
  const [invQty, setInvQty] = useState('');
  const [invUnit, setInvUnit] = useState('Yards');
  const [invThreshold, setInvThreshold] = useState('5');

  // Invoice & Receipt Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceClient, setInvoiceClient] = useState(null);

  // Client Public Order Tracker states
  const [trackingPhoneSearch, setTrackingPhoneSearch] = useState('');
  const [trackedResultClient, setTrackedResultClient] = useState(null);
  const [hasSearchedTracking, setHasSearchedTracking] = useState(false);

  // Supabase Sync log states
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [dbSyncing, setDbSyncing] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [copiedSchema, setCopiedSchema] = useState(false);

  const [viewMode, setViewMode] = useState('desktop'); // mobile, desktop
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);

  const [activeSegment, setActiveSegment] = useState('UPPER BODY');
  const [activeField, setActiveField] = useState('chest');
  const [tapeMeasurements, setTapeMeasurements] = useState({});
  const [measurementGender, setMeasurementGender] = useState('male');
  const [autoNext, setAutoNext] = useState(true);
  const autoNextTimeoutRef = useRef(null);
  const isCacheLoadedRef = useRef(false);
  const isInventoryCacheLoadedRef = useRef(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const clientsRef = useRef(clients);
  const inventoryListRef = useRef(inventoryList);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    inventoryListRef.current = inventoryList;
  }, [inventoryList]);

  const [tailorLock, setTailorLock] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPinUnlockPrompt, setShowPinUnlockPrompt] = useState(false);

  const [selectedGarment, setSelectedGarment] = useState('Kente Gown');
  const [selectedBoltWidth, setSelectedBoltWidth] = useState('60 Inches');
  const [patternNotes, setPatternNotes] = useState('');
  const [snappedFabric, setSnappedFabric] = useState(null);
  const [garmentsList, setGarmentsList] = useState([]);
  const [ledgerSubTab, setLedgerSubTab] = useState('analytics'); // analytics or ledger
  const [isSnapping, setIsSnapping] = useState(false);

  const [showNewConsultModal, setShowNewConsultModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientGarment, setNewClientGarment] = useState('Kente Gown');
  const [newClientTotalBilling, setNewClientTotalBilling] = useState('');
  const [newClientPaidDeposit, setNewClientPaidDeposit] = useState('');

  const [activeMenuClientId, setActiveMenuClientId] = useState(null);
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientGarment, setEditClientGarment] = useState('');
  const [editClientTotalBilling, setEditClientTotalBilling] = useState('');
  const [editClientPaidDeposit, setEditClientPaidDeposit] = useState('');

  const [hapticTrigger, setHapticTrigger] = useState(false);

  // Splash screen transition timer
  useEffect(() => {
    if (authStatus === 'splash') {
      const timer = setTimeout(() => {
        checkSupabaseSession();
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [authStatus]);

  // Dark Mode Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('tailorpro_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tailorpro_theme', theme);
    const metaTag = document.getElementById('theme-color-meta');
    const activeColor = theme === 'dark' ? '#0F172A' : '#F9F6F0';
    if (metaTag) {
      metaTag.setAttribute('content', activeColor);
    }
    try {
      StatusBar.setBackgroundColor({ color: activeColor });
      StatusBar.setStyle({ style: theme === 'dark' ? Style.Light : Style.Dark });
    } catch (e) {}
    try {
      if (SystemBars && SystemBars.setColors) {
        SystemBars.setColors({
          statusBarColor: activeColor,
          navigationBarColor: activeColor,
          isDark: theme === 'dark'
        });
      }
    } catch (e) {}
  }, [theme]);

  // Handle customer tracking direct link via URL query param (?phone=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const phoneParam = params.get('phone');
      if (phoneParam) {
        setTrackingPhoneSearch(phoneParam);
        setAuthStatus('client_tracker');
        setTimeout(() => {
          triggerPublicTracking(phoneParam);
        }, 300);
      }
    }
  }, []);

  // Android Hardware Back Button handler
  useEffect(() => {
    const handleBackButton = () => {
      if (showInvoiceModal) { setShowInvoiceModal(false); return; }
      if (showNewConsultModal) { setShowNewConsultModal(false); return; }
      if (showEditClientModal) { setShowEditClientModal(false); return; }
      if (showInventoryModal) { setShowInventoryModal(false); return; }
      if (showSettingsModal) { setShowSettingsModal(false); return; }
      if (tailorLock && userRole !== 'tailor') { setShowPinUnlockPrompt(true); return; }
      if (currentScreen !== 'dashboard') { setCurrentScreen('dashboard'); return; }
      if (activeTab !== 'clients') { setActiveTab('clients'); return; }
    };

    window.addEventListener('popstate', handleBackButton);
    document.addEventListener('backbutton', handleBackButton);
    return () => {
      window.removeEventListener('popstate', handleBackButton);
      document.removeEventListener('backbutton', handleBackButton);
    };
  }, [showInvoiceModal, showNewConsultModal, showEditClientModal, showInventoryModal, showSettingsModal, currentScreen, activeTab, tailorLock, userRole]);

  // Set viewMode based on device width (Mobile vs Tablet vs Desktop)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 600) {
        setViewMode('mobile');
      } else {
        setViewMode('desktop');
      }
    }
  }, []);

  // Sync clients when authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      syncOfflineData();
    }
  }, [authStatus]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuClientId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Load clients cache on login/mount
  useEffect(() => {
    const key = 'tailorpro_clients_' + (loginEmail || 'local');
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        setClients(JSON.parse(cached));
      } catch (e) {}
    } else {
      setClients([]);
    }
    isCacheLoadedRef.current = true;
  }, [loginEmail]);

  // Save clients to cache on changes
  useEffect(() => {
    if (isCacheLoadedRef.current) {
      const key = 'tailorpro_clients_' + (loginEmail || 'local');
      localStorage.setItem(key, JSON.stringify(clients));
    }
  }, [clients, loginEmail]);

  // Load inventory cache on login/mount
  useEffect(() => {
    const key = 'tailorpro_inventory_' + (loginEmail || 'local');
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        setInventoryList(JSON.parse(cached));
      } catch (e) {}
    } else {
      setInventoryList(INITIAL_INVENTORY);
    }
    isInventoryCacheLoadedRef.current = true;
  }, [loginEmail]);

  // Save inventory to cache on changes
  useEffect(() => {
    if (isInventoryCacheLoadedRef.current) {
      const key = 'tailorpro_inventory_' + (loginEmail || 'local');
      localStorage.setItem(key, JSON.stringify(inventoryList));
    }
  }, [inventoryList, loginEmail]);

  // Online listener to trigger automatic sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSupabaseConnected(true);
      syncOfflineData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSupabaseConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loginEmail]);

  const fetchAdminData = async () => {
    try {
      const { data: users, error: uErr } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (uErr) console.error("Admin profiles fetch error:", uErr.message);
      if (users) setAdminUsersList(users);

      const { data: keys, error: kErr } = await supabase.from('license_keys').select('*').order('created_at', { ascending: false });
      if (kErr) console.error("Admin keys fetch error:", kErr.message);
      if (keys) setAdminKeysList(keys);
    } catch (err) {
      console.warn("Failed fetching admin management records:", err.message);
    }
  };

  const triggerPublicTracking = async (phone) => {
    setHasSearchedTracking(true);
    setDbSyncing(true);
    const searchClean = phone.trim();

    let match = clients.find(c => c.phone && c.phone.trim() === searchClean);

    if (!match) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('phone', searchClean);

        if (!error && data && data.length > 0) {
          const c = data[0];
          match = {
            id: c.id,
            name: c.name,
            garmentType: c.garment_type,
            status: c.status || 'Active',
            lastMeasured: c.last_measured || 'Just now',
            phone: c.phone || '',
            measurements: c.measurements || {},
            totalBilling: Number(c.total_billing || 0),
            paidDeposit: Number(c.paid_deposit || 0),
            outstandingBalance: Number(c.total_billing || 0) - Number(c.paid_deposit || 0),
            notes: c.notes || '',
            boltWidth: c.bolt_width || '60 Inches',
            stage: c.stage || 'Cutting',
            fabricSwatchUrl: c.fabric_swatch_url
          };
        }
      } catch (err) {
        console.warn("Tracker query error:", err.message);
      }
    }

    setTrackedResultClient(match || null);
    setDbSyncing(false);
  };

  const handleApproveUser = async (userId, newStatus) => {
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
      if (error) throw error;
      setAdminUsersList(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert("Failed updating user access status: " + err.message);
    }
  };

  const handleGenerateLicenseKey = async () => {
    setIsGeneratingKey(true);
    try {
      const randomCode = 'TP-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + newKeyPlan.toUpperCase();
      const { data, error } = await supabase.from('license_keys').insert([
        { code: randomCode, plan: newKeyPlan, is_used: false }
      ]).select();

      if (error) throw error;
      if (data && data[0]) {
        setAdminKeysList(prev => [data[0], ...prev]);
      }
    } catch (err) {
      alert("Failed creating activation code: " + err.message);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const syncInventoryFromSupabase = async () => {
    try {
      const { data } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
      if (data && data.length > 0) {
        setInventoryList(data);
      }
    } catch (e) {
      console.warn("Could not sync inventory from Supabase:", e.message);
    }
  };

  const handleAddInventoryItem = async (e) => {
    e.preventDefault();
    if (!invName) return;
    const newItem = {
      id: 'inv-' + Date.now(),
      item_name: invName,
      category: invCategory,
      quantity: Number(invQty || 0),
      unit: invUnit,
      low_stock_threshold: Number(invThreshold || 5)
    };

    setInventoryList(prev => [newItem, ...prev]);

    if (supabaseConnected) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase.from('inventory').insert([{
            user_id: user.id,
            item_name: invName,
            category: invCategory,
            quantity: Number(invQty || 0),
            unit: invUnit,
            low_stock_threshold: Number(invThreshold || 5)
          }]).select();
          if (!error && data && data[0]) {
            setInventoryList(prev => prev.map(item => item.id === newItem.id ? data[0] : item));
          }
        }
      } catch (err) {}
    }

    setInvName('');
    setInvQty('');
    setShowInventoryModal(false);
  };

  const handleUpdateInventoryQty = async (id, delta) => {
    const targetItem = inventoryList.find(item => item.id === id);
    if (!targetItem) return;
    const newQty = Math.max(0, Number(targetItem.quantity || 0) + delta);
    let willBeDirty = true;

    if (supabaseConnected && !id.toString().startsWith('inv-')) {
      try {
        const { error } = await supabase.from('inventory').update({ quantity: newQty }).eq('id', id);
        if (!error) willBeDirty = false;
      } catch (e) {}
    }

    setInventoryList(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: newQty, isDirty: willBeDirty };
      }
      return item;
    }));
  };

  const handleDeleteInventoryItem = async (id) => {
    setInventoryList(prev => prev.filter(item => item.id !== id));
    if (!id.toString().startsWith('inv-')) {
      let deletedOnServer = false;
      if (supabaseConnected) {
        try {
          const { error } = await supabase.from('inventory').delete().eq('id', id);
          if (!error) deletedOnServer = true;
        } catch (e) {}
      }
      if (!deletedOnServer) {
        addPendingDelete('inventory', id);
      }
    }
  };

  const sendSmartWhatsAppMessage = (client, type) => {
    if (!client.phone) {
      alert("Please enter a valid phone number for this client.");
      return;
    }
    const sanitizedPhone = client.phone.replace(/[^0-9+]/g, '');
    let msg = "";
    const outstanding = (Number(client.totalBilling || 0) - Number(client.paidDeposit || 0));

    if (type === 'fitting') {
      msg = `Hello ${client.name}, warm greetings from ${studioName}! ✂️ Your ${client.garmentType} is ready for your fitting session. Please let us know when you can visit our workshop. Thank you!`;
    } else if (type === 'pickup') {
      msg = `Hello ${client.name}! 🛍️ Great news from ${studioName}: Your ${client.garmentType} is 100% completed and ready for pickup/delivery!`;
    } else if (type === 'billing') {
      msg = `Hello ${client.name}, here is a billing summary from ${studioName}. Order: ${client.garmentType}. Total: GHS ${client.totalBilling}, Paid: GHS ${client.paidDeposit}. Outstanding balance: GHS ${outstanding}. Thank you!`;
    }

    const waUrl = `https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const checkSupabaseSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const user = session.user;
        setLoginEmail(user.email);
        setStudioName(user.user_metadata?.studio_name || 'Classic Stitches Studio');
        setStudioLogo(user.user_metadata?.studio_logo || '');
        setWorkshopLockPin(user.user_metadata?.lock_pin || '1234');
        setMomoNumber(user.user_metadata?.momo_number || '0546920418');
        setMomoName(user.user_metadata?.momo_name || 'Mubarik Tuahir Ali');
        let role = user.user_metadata?.role || 'owner';
        
        if (user.email === 'admin@tailorpro.com') {
          role = 'super_admin';
        }
        setUserRole(role);
        if (role === 'tailor') {
          setTailorLock(true);
        }
        setSupabaseConnected(true);

        // Check or create Profile status
        try {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profile) {
            setAccountApprovalStatus(profile.status);
            if (profile.status === 'pending') {
              setAuthStatus('pending_approval');
              return;
            } else if (profile.status === 'blocked') {
              setAuthStatus('account_blocked');
              return;
            }
          } else {
            // Auto-create profile record
            const initStatus = (user.email === 'admin@tailorpro.com' || role === 'super_admin') ? 'approved' : 'pending';
            const { error: insErr } = await supabase.from('profiles').upsert([{
              id: user.id,
              email: user.email,
              studio_name: user.user_metadata?.studio_name || 'Classic Stitches Studio',
              designer_name: user.user_metadata?.designer_name || 'Designer',
              role: role,
              status: initStatus
            }], { onConflict: 'id' });
            if (insErr) console.error("Auto-create profile error:", insErr.message);
            setAccountApprovalStatus(initStatus);
            if (initStatus === 'pending') {
              setAuthStatus('pending_approval');
              return;
            }
          }
        } catch (pErr) {
          console.warn("Profiles check bypassed or table not ready yet:", pErr.message);
        }

        if (role === 'super_admin' || user.email === 'admin@tailorpro.com') {
          fetchAdminData();
        }

        setAuthStatus('authenticated');
        syncOfflineData();
      } else {
        setAuthStatus('login');
      }
    } catch (err) {
      console.warn("Session check failed, falling back to login screen.", err.message);
      setAuthStatus('login');
    }
  };

  const addPendingDelete = (type, id) => {
    const key = `tailorpro_pending_deletes_${type}_${loginEmail || 'local'}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem(key, JSON.stringify(current));
    }
  };

  const syncOfflineData = async () => {
    if (!navigator.onLine) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setDbSyncing(true);

      // 1. Process pending client deletions
      const clDeletesKey = `tailorpro_pending_deletes_clients_${loginEmail || 'local'}`;
      const clDeletes = JSON.parse(localStorage.getItem(clDeletesKey) || '[]');
      if (clDeletes.length > 0) {
        for (const id of clDeletes) {
          await supabase.from('clients').delete().eq('id', id);
        }
        localStorage.setItem(clDeletesKey, JSON.stringify([]));
      }

      // 2. Process pending inventory deletions
      const invDeletesKey = `tailorpro_pending_deletes_inventory_${loginEmail || 'local'}`;
      const invDeletes = JSON.parse(localStorage.getItem(invDeletesKey) || '[]');
      if (invDeletes.length > 0) {
        for (const id of invDeletes) {
          await supabase.from('inventory').delete().eq('id', id);
        }
        localStorage.setItem(invDeletesKey, JSON.stringify([]));
      }

      let currentClients = [...clientsRef.current];
      let currentInventory = [...inventoryListRef.current];
      let hasStateChanges = false;

      // 3. Client Creations (id starts with 'local-')
      for (let i = 0; i < currentClients.length; i++) {
        const client = currentClients[i];
        if (client.id.toString().startsWith('local-')) {
          try {
            const dbEntry = {
              user_id: user.id,
              name: client.name,
              phone: client.phone,
              garment_type: client.garmentType,
              status: client.status || 'Active',
              stage: client.stage || 'Cutting',
              bolt_width: client.boltWidth || '60 Inches',
              notes: client.notes || '',
              total_billing: client.totalBilling || 0,
              paid_deposit: client.paidDeposit || 0,
              measurements: client.measurements,
              last_measured: client.lastMeasured || 'Just now',
              fabric_swatch_url: client.fabricSwatchUrl
            };
            const { data, error } = await supabase.from('clients').insert([dbEntry]).select();
            if (!error && data && data[0]) {
              currentClients[i] = {
                ...client,
                id: data[0].id,
                isDirty: false
              };
              hasStateChanges = true;
            }
          } catch (e) {
            console.error("Sync client insert failed:", client.name, e);
          }
        }
      }

      // 4. Inventory Creations (id starts with 'inv-')
      for (let i = 0; i < currentInventory.length; i++) {
        const item = currentInventory[i];
        if (item.id.toString().startsWith('inv-')) {
          try {
            const dbEntry = {
              user_id: user.id,
              item_name: item.item_name,
              category: item.category,
              quantity: item.quantity,
              unit: item.unit,
              low_stock_threshold: item.low_stock_threshold
            };
            const { data, error } = await supabase.from('inventory').insert([dbEntry]).select();
            if (!error && data && data[0]) {
              currentInventory[i] = {
                ...data[0],
                isDirty: false
              };
              hasStateChanges = true;
            }
          } catch (e) {
            console.error("Sync inventory insert failed:", item.item_name, e);
          }
        }
      }

      // 5. Client Updates (isDirty is true)
      for (let i = 0; i < currentClients.length; i++) {
        const client = currentClients[i];
        if (client.isDirty && !client.id.toString().startsWith('local-')) {
          try {
            const { error } = await supabase
              .from('clients')
              .update({
                name: client.name,
                phone: client.phone,
                garment_type: client.garmentType,
                status: client.status,
                stage: client.stage,
                bolt_width: client.boltWidth,
                notes: client.notes,
                total_billing: client.totalBilling,
                paid_deposit: client.paidDeposit,
                measurements: client.measurements,
                last_measured: client.lastMeasured,
                fabric_swatch_url: client.fabricSwatchUrl
              })
              .eq('id', client.id);
            if (!error) {
              currentClients[i] = { ...client, isDirty: false };
              hasStateChanges = true;
            }
          } catch (e) {
            console.error("Sync client update failed for:", client.name, e);
          }
        }
      }

      // 6. Inventory Updates (isDirty is true)
      for (let i = 0; i < currentInventory.length; i++) {
        const item = currentInventory[i];
        if (item.isDirty && !item.id.toString().startsWith('inv-')) {
          try {
            const { error } = await supabase
              .from('inventory')
              .update({
                item_name: item.item_name,
                category: item.category,
                quantity: item.quantity,
                unit: item.unit,
                low_stock_threshold: item.low_stock_threshold
              })
              .eq('id', item.id);
            if (!error) {
              currentInventory[i] = { ...item, isDirty: false };
              hasStateChanges = true;
            }
          } catch (e) {
            console.error("Sync inventory update failed for:", item.item_name, e);
          }
        }
      }

      if (hasStateChanges) {
        setClients(currentClients);
        setInventoryList(currentInventory);
      }

      // Pull fresh data
      await syncClientsFromSupabase();
      try {
        const { data } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
        if (data) setInventoryList(data);
      } catch (e) {}

      setSupabaseConnected(true);
    } catch (err) {
      console.warn("Offline synchronization worker encountered an error:", err.message);
    } finally {
      setDbSyncing(false);
    }
  };

  const syncClientsFromSupabase = async () => {
    setDbSyncing(true);
    setDbError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSupabaseConnected(false);
        setDbSyncing(false);
        return;
      }
      
      setSupabaseConnected(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped = data.map(c => ({
          id: c.id,
          name: c.name,
          garmentType: c.garment_type,
          status: c.status || 'Active',
          lastMeasured: c.last_measured || 'Just now',
          phone: c.phone || '',
          measurements: c.measurements || { chest: '0.0', shoulder: '0.0', sleeve: '0.0', waist: '0.0', hips: '0.0', length: '0.0' },
          totalBilling: Number(c.total_billing || 0),
          paidDeposit: Number(c.paid_deposit || 0),
          outstandingBalance: Number(c.total_billing || 0) - Number(c.paid_deposit || 0),
          notes: c.notes || '',
          boltWidth: c.bolt_width || '60 Inches',
          stage: c.stage || 'Cutting',
          fabricSwatchUrl: c.fabric_swatch_url
        }));
        setClients(mapped);
      } else {
        setClients([]);
      }
    } catch (err) {
      console.warn("Supabase pull failed. Local database active.", err.message);
    } finally {
      setDbSyncing(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.garmentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const measurementFields = measurementGender === 'female' ? femaleFields : maleFields;

  const activeFieldDetails = measurementFields.find(f => f.key === activeField);

  const startTape = (client) => {
    setSelectedClient(client);
    setTapeMeasurements({ ...client.measurements });
    const initialGender = client.measurements?._category || 'male';
    setMeasurementGender(initialGender);
    const fields = initialGender === 'female' ? femaleFields : maleFields;
    const firstField = fields[0];
    setActiveField(firstField.key);
    setActiveSegment(firstField.segment);
    setCurrentScreen('digital-tape');
  };

  const handleGenderChange = (gender) => {
    setMeasurementGender(gender);
    const fields = gender === 'female' ? femaleFields : maleFields;
    const hasSameKey = fields.some(f => f.key === activeField);
    if (hasSameKey) {
      const match = fields.find(f => f.key === activeField);
      setActiveSegment(match.segment);
    } else {
      setActiveField(fields[0].key);
      setActiveSegment(fields[0].segment);
    }
  };

  const startSpec = (client) => {
    setSelectedClient(client);
    setSelectedGarment(client.garmentType || 'Kente Gown');
    setSelectedBoltWidth(client.boltWidth || '60 Inches');
    setPatternNotes(client.notes || '');
    setSnappedFabric(client.fabricSwatchUrl || null);

    if (client.garmentsList && Array.isArray(client.garmentsList) && client.garmentsList.length > 0) {
      setGarmentsList(client.garmentsList);
    } else {
      setGarmentsList([
        {
          id: 'garment-' + Date.now(),
          garmentType: client.garmentType || 'Kente Gown',
          boltWidth: client.boltWidth || '60 Inches',
          notes: client.notes || '',
          fabricSwatches: client.fabricSwatchUrl ? [client.fabricSwatchUrl] : []
        }
      ]);
    }
    setCurrentScreen('order-spec');
  };

  const addGarmentToSpec = () => {
    setGarmentsList(prev => [
      ...prev,
      {
        id: 'garment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        garmentType: '3-Piece Suit',
        boltWidth: '60 Inches',
        notes: '',
        fabricSwatches: []
      }
    ]);
  };

  const removeGarmentFromSpec = (id) => {
    if (garmentsList.length <= 1) return;
    setGarmentsList(prev => prev.filter(g => g.id !== id));
  };

  const updateGarmentInSpec = (id, field, value) => {
    setGarmentsList(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const handleGarmentFabricUpload = async (garmentId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsSnapping(true);
    try {
      const fileName = `attachments/fabric-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      let imageUrl = '';

      if (supabaseConnected) {
        const { data, error } = await supabase.storage
          .from('Tailorpro')
          .upload(fileName, file, { cacheControl: '3600', upsert: true });
        
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('Tailorpro')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      } else {
        const reader = new FileReader();
        await new Promise((resolve) => {
          reader.onloadend = () => {
            imageUrl = reader.result;
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }

      setGarmentsList(prev => prev.map(g => {
        if (g.id === garmentId) {
          const currentSwatches = g.fabricSwatches || [];
          return { ...g, fabricSwatches: [...currentSwatches, imageUrl] };
        }
        return g;
      }));
    } catch (err) {
      console.warn("Fabric upload failed, using local offline preview:", err.message);
      alert("Storage upload failed. Fallback offline preview loaded locally.");
    } finally {
      setIsSnapping(false);
    }
  };

  const removeFabricSwatchFromGarment = (garmentId, indexToRemove) => {
    setGarmentsList(prev => prev.map(g => {
      if (g.id === garmentId) {
        const updatedSwatches = (g.fabricSwatches || []).filter((_, idx) => idx !== indexToRemove);
        return { ...g, fabricSwatches: updatedSwatches };
      }
      return g;
    }));
  };


  const advanceToNextField = () => {
    setHapticTrigger(true);
    setTimeout(() => setHapticTrigger(false), 200);

    const currentIndex = measurementFields.findIndex(f => f.key === activeField);
    if (currentIndex < measurementFields.length - 1) {
      const nextField = measurementFields[currentIndex + 1];
      setActiveField(nextField.key);
      setActiveSegment(nextField.segment);
    }
  };

  const prevField = () => {
    const currentIndex = measurementFields.findIndex(f => f.key === activeField);
    if (currentIndex > 0) {
      const prevField = measurementFields[currentIndex - 1];
      setActiveField(prevField.key);
      setActiveSegment(prevField.segment);
    }
  };

  const saveTapeMeasurements = async () => {
    if (selectedClient) {
      const currentHistory = selectedClient.measurements?._history || [];
      const historyItem = {
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        measurements: { ...tapeMeasurements }
      };
      // Keep up to 10 historical records
      const updatedHistory = [historyItem, ...currentHistory].slice(0, 10);

      const updatedTape = { 
        ...tapeMeasurements, 
        _category: measurementGender,
        _history: updatedHistory 
      };
      let willBeDirty = true;

      if (supabaseConnected && !selectedClient.id.toString().startsWith('local-')) {
        try {
          const { error } = await supabase
            .from('clients')
            .update({
              measurements: updatedTape,
              last_measured: 'Just now'
            })
            .eq('id', selectedClient.id);
          if (!error) willBeDirty = false;
        } catch (e) {
          console.warn("Failed syncing measurements to Supabase", e.message);
        }
      }

      const updatedClients = clients.map(c => {
        if (c.id === selectedClient.id) {
          return {
            ...c,
            measurements: updatedTape,
            lastMeasured: 'Just now',
            isDirty: willBeDirty
          };
        }
        return c;
      });
      setClients(updatedClients);
    }
    setCurrentScreen('dashboard');
  };

  const calculateRequiredYardage = (boltWidthVal = selectedBoltWidth) => {
    const bust = parseFloat(tapeMeasurements.chest || tapeMeasurements.bust || (selectedClient && (selectedClient.measurements.chest || selectedClient.measurements.bust)) || 36);
    const len = parseFloat(tapeMeasurements.length || (selectedClient && selectedClient.measurements.length) || 58);
    const width = boltWidthVal === '60 Inches' ? 60 : boltWidthVal === '45 Inches' ? 45 : 36;

    let basePanels = width === 60 ? 2 : width === 45 ? 3 : 4;
    let computed = ((len + 6) * basePanels) / 36;
    if (bust > 40) computed += 0.5;
    
    return (Math.ceil(computed * 2) / 2).toFixed(1);
  };

  const confirmSpecOrder = async () => {
    if (selectedClient) {
      const primaryGarment = garmentsList[0] || {};
      let willBeDirty = true;

      if (supabaseConnected && !selectedClient.id.toString().startsWith('local-')) {
        try {
          const { error } = await supabase
            .from('clients')
            .update({
              garments_list: garmentsList,
              garment_type: primaryGarment.garmentType || selectedGarment,
              bolt_width: primaryGarment.boltWidth || selectedBoltWidth,
              notes: primaryGarment.notes || patternNotes,
              fabric_swatch_url: (primaryGarment.fabricSwatches && primaryGarment.fabricSwatches[0]) || snappedFabric
            })
            .eq('id', selectedClient.id);
          if (!error) willBeDirty = false;
        } catch (e) {
          console.warn("Failed syncing specifications to Supabase", e.message);
        }
      }

      const updatedClients = clients.map(c => {
        if (c.id === selectedClient.id) {
          return {
            ...c,
            garmentsList: garmentsList,
            garmentType: primaryGarment.garmentType || selectedGarment,
            boltWidth: primaryGarment.boltWidth || selectedBoltWidth,
            notes: primaryGarment.notes || patternNotes,
            fabricSwatchUrl: (primaryGarment.fabricSwatches && primaryGarment.fabricSwatches[0]) || snappedFabric,
            isDirty: willBeDirty
          };
        }
        return c;
      });
      setClients(updatedClients);
    }
    setCurrentScreen('dashboard');
  };

  // Upload fabric attachment image to Supabase Storage bucket 'Tailorpro'
  const handleFabricAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsSnapping(true);
    try {
      const fileName = `attachments/fabric-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

      if (supabaseConnected) {
        const { data, error } = await supabase.storage
          .from('Tailorpro')
          .upload(fileName, file, { cacheControl: '3600', upsert: true });
        
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('Tailorpro')
          .getPublicUrl(fileName);
        
        setSnappedFabric(publicUrl);
      } else {
        // Fallback offline preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
          setSnappedFabric(reader.result);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.warn("Fabric upload failed, using local offline preview:", err.message);
      alert("Storage upload failed. Fallback offline preview loaded locally.");
    } finally {
      setIsSnapping(false);
    }
  };

  const moveOrderStage = async (clientId, newStage) => {
    let willBeDirty = true;
    if (supabaseConnected && !clientId.toString().startsWith('local-')) {
      try {
        const { error } = await supabase
          .from('clients')
          .update({ stage: newStage })
          .eq('id', clientId);
        if (!error) willBeDirty = false;
      } catch (e) {
        console.warn("Failed syncing runway stages to Supabase", e.message);
      }
    }

    const updated = clients.map(c => {
      if (c.id === clientId) {
        return { ...c, stage: newStage, isDirty: willBeDirty };
      }
      return c;
    });
    setClients(updated);
  };

  const markJobPaidAndCompleted = async (client) => {
    const updatedTotal = Number(client.totalBilling) || 0;
    let willBeDirty = true;
    if (supabaseConnected && !client.id.toString().startsWith('local-')) {
      try {
        const { error } = await supabase
          .from('clients')
          .update({ 
            paid_deposit: updatedTotal, 
            stage: 'Delivered' 
          })
          .eq('id', client.id);
        if (!error) willBeDirty = false;
      } catch (e) {
        console.warn("Failed syncing payment settlement to Supabase", e.message);
      }
    }

    const updated = clients.map(c => {
      if (c.id === client.id) {
        return { 
          ...c, 
          paidDeposit: updatedTotal, 
          stage: 'Delivered',
          isDirty: willBeDirty
        };
      }
      return c;
    });
    setClients(updated);

    if (client.phone) {
      const confirmReceipt = window.confirm(`Job for ${client.name} has been settled & marked completed! Would you like to send a WhatsApp receipt to ${client.name}?`);
      if (confirmReceipt) {
        const sanitizedPhone = client.phone.replace(/[^0-9+]/g, '');
        const msg = `Hello ${client.name}, thank you for choosing ${studioName}! Your order for ${client.garmentType} has been paid in full (GHS ${updatedTotal}) and marked completed. We hope to see you again soon!`;
        const waUrl = `https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
      }
    } else {
      alert(`Job for ${client.name} marked paid in full & completed!`);
    }
  };

  const handlePinKeyPress = (digit) => {
    if (pinInput.length < 4) {
      const newVal = pinInput + digit;
      setPinInput(newVal);
      if (newVal.length === 4) {
        setTimeout(() => {
          if (newVal === workshopLockPin) {
            setTailorLock(false);
            setPinInput('');
            setPinError(false);
            setShowPinUnlockPrompt(false);
          } else {
            setPinError(true);
            setPinInput('');
          }
        }, 300);
      }
    }
  };

  const handleCreateConsult = async (e) => {
    e.preventDefault();
    if (loginEmail === 'guest@tailorpro.com') {
      alert("⚠️ Guest Mode Restriction: You are currently exploring demo mode. Please register a studio account to create and save new client records!");
      setShowNewConsultModal(false);
      return;
    }
    if (!newClientName || !newClientPhone) return;

    const totalBill = Number(newClientTotalBilling) || 0;
    const paidDep = Number(newClientPaidDeposit) || 0;

    const newLocalId = 'local-' + Date.now();
    const newClientData = {
      name: newClientName,
      garmentType: newClientGarment,
      status: 'Active',
      lastMeasured: 'Brand new',
      phone: newClientPhone,
      measurements: {
        chest: '0.0',
        shoulder: '0.0',
        sleeve: '0.0',
        waist: '0.0',
        hips: '0.0',
        length: '0.0'
      },
      totalBilling: totalBill,
      paidDeposit: paidDep,
      outstandingBalance: totalBill - paidDep,
      notes: 'Initial fitting scheduled.',
      boltWidth: '60 Inches',
      stage: 'Cutting'
    };

    if (supabaseConnected) {
      setDbSyncing(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User authentication session not found.");
        const dbEntry = {
          user_id: user.id,
          name: newClientName,
          phone: newClientPhone,
          garment_type: newClientGarment,
          status: 'Active',
          stage: 'Cutting',
          bolt_width: '60 Inches',
          notes: 'Initial fitting scheduled.',
          total_billing: totalBill,
          paid_deposit: paidDep,
          last_measured: 'Brand new',
          measurements: newClientData.measurements
        };

        const { data, error } = await supabase
          .from('clients')
          .insert([dbEntry])
          .select();

        if (error) throw error;

        if (data && data[0]) {
          const syncedC = {
            id: data[0].id,
            name: data[0].name,
            garmentType: data[0].garment_type,
            status: data[0].status,
            lastMeasured: data[0].last_measured,
            phone: data[0].phone,
            measurements: data[0].measurements,
            totalBilling: Number(data[0].total_billing),
            paidDeposit: Number(data[0].paid_deposit),
            outstandingBalance: Number(data[0].total_billing) - Number(data[0].paid_deposit),
            notes: data[0].notes,
            boltWidth: data[0].bolt_width,
            stage: data[0].stage
          };
          setClients([syncedC, ...clients]);
          setNewClientName('');
          setNewClientPhone('');
          setNewClientTotalBilling('');
          setNewClientPaidDeposit('');
          setShowNewConsultModal(false);
          startTape(syncedC);
          return;
        }
      } catch (err) {
        console.warn("Supabase client insertion error. Adding locally.", err.message);
      } finally {
        setDbSyncing(false);
      }
    }

    const localEntry = { id: newLocalId, ...newClientData };
    setClients([localEntry, ...clients]);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientTotalBilling('');
    setNewClientPaidDeposit('');
    setShowNewConsultModal(false);
    startTape(localEntry);
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    
    const updatedClients = clients.filter(c => c.id !== clientId);
    setClients(updatedClients);
    localStorage.setItem('tailorpro_clients_' + (loginEmail || 'local'), JSON.stringify(updatedClients));

    if (!clientId.toString().startsWith('local-')) {
      let deletedOnServer = false;
      if (supabaseConnected) {
        try {
          const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', clientId);
          if (!error) deletedOnServer = true;
        } catch (e) {
          console.warn("Failed deleting client from Supabase", e.message);
        }
      }
      if (!deletedOnServer) {
        addPendingDelete('clients', clientId);
      }
    }
    setActiveMenuClientId(null);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setEditClientName(client.name);
    setEditClientPhone(client.phone);
    setEditClientGarment(client.garmentType);
    setEditClientTotalBilling(client.totalBilling.toString());
    setEditClientPaidDeposit(client.paidDeposit.toString());
    setShowEditClientModal(true);
    setActiveMenuClientId(null);
  };

  const handleEditClientSubmit = async (e) => {
    e.preventDefault();
    if (!editingClient) return;

    const totalBill = Number(editClientTotalBilling) || 0;
    const paidDep = Number(editClientPaidDeposit) || 0;
    let willBeDirty = true;

    if (supabaseConnected && !editingClient.id.toString().startsWith('local-')) {
      try {
        const { error } = await supabase
          .from('clients')
          .update({
            name: editClientName,
            phone: editClientPhone,
            garment_type: editClientGarment,
            total_billing: totalBill,
            paid_deposit: paidDep
          })
          .eq('id', editingClient.id);
        if (!error) willBeDirty = false;
      } catch (e) {
        console.warn("Failed updating client in Supabase", e.message);
      }
    }

    const updatedClients = clients.map(c => {
      if (c.id === editingClient.id) {
        return {
          ...c,
          name: editClientName,
          phone: editClientPhone,
          garmentType: editClientGarment,
          totalBilling: totalBill,
          paidDeposit: paidDep,
          outstandingBalance: totalBill - paidDep,
          isDirty: willBeDirty
        };
      }
      return c;
    });

    setClients(updatedClients);
    localStorage.setItem('tailorpro_clients_' + (loginEmail || 'local'), JSON.stringify(updatedClients));

    setShowEditClientModal(false);
    setEditingClient(null);
  };

  // Sign up brand logo preview handler
  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTempLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setDbSyncing(true);
    setDbError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });

      if (error) throw error;

      if (data?.user) {
        const user = data.user;
        setStudioName(user.user_metadata?.studio_name || 'Classic Stitches Studio');
        setStudioLogo(user.user_metadata?.studio_logo || '');
        setWorkshopLockPin(user.user_metadata?.lock_pin || '1234');
        setMomoNumber(user.user_metadata?.momo_number || '0546920418');
        setMomoName(user.user_metadata?.momo_name || 'Mubarik Tuahir Ali');
        let role = user.user_metadata?.role || 'owner';
        if (user.email === 'admin@tailorpro.com') {
          role = 'super_admin';
        }
        setUserRole(role);
        if (role === 'tailor') {
          setTailorLock(true);
        }
        setSupabaseConnected(true);

        // Verify status in profiles table
        try {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profile) {
            setAccountApprovalStatus(profile.status);
            if (profile.status === 'pending') {
              setAuthStatus('pending_approval');
              return;
            } else if (profile.status === 'blocked') {
              setAuthStatus('account_blocked');
              return;
            }
          }
        } catch (pErr) {
          console.warn("Could not fetch profile on login", pErr.message);
        }

        if (role === 'super_admin' || user.email === 'admin@tailorpro.com') {
          fetchAdminData();
        }

        setAuthStatus('authenticated');
        syncOfflineData();
      }
    } catch (err) {
      setDbError(err.message);
    } finally {
      setDbSyncing(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setDbSyncing(true);
    setDbError(null);
    
    try {
      let isApprovedWithKey = false;
      let usedKeyPlan = 'free';

      // Verify License Key if provided
      if (signUpLicenseKey.trim()) {
        const cleanKey = signUpLicenseKey.trim().toUpperCase();
        const { data: keyData, error: keyError } = await supabase
          .from('license_keys')
          .select('*')
          .eq('code', cleanKey)
          .eq('is_used', false)
          .single();

        if (keyError || !keyData) {
          throw new Error("Invalid or already used Activation Key. Please check the code or leave blank for pending approval.");
        }
        isApprovedWithKey = true;
        usedKeyPlan = keyData.plan || 'pro';
      }

      // 1. Perform regular Supabase signUp first to authenticate the session
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: {
            studio_name: studioName,
            designer_name: signUpName,
            studio_logo: '',
            lock_pin: workshopLockPin,
            role: signUpRole
          }
        }
      });

      if (error) throw error;

      let finalLogoUrl = logoPreviewUrl || '';

      // 2. Upload logo if selected
      if (data?.user && tempLogoFile) {
        setIsUploadingLogo(true);
        try {
          const fileExt = tempLogoFile.name.split('.').pop();
          const logoName = `brand-logos/logo-${Date.now()}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('Tailorpro')
            .upload(logoName, tempLogoFile, { cacheControl: '3600', upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('Tailorpro')
            .getPublicUrl(logoName);
          
          finalLogoUrl = publicUrl;

          await supabase.auth.updateUser({
            data: { studio_logo: finalLogoUrl }
          });
        } catch (uploadErr) {
          console.warn("Authenticated logo upload failed, keeping preview logo:", uploadErr.message);
        } finally {
          setIsUploadingLogo(false);
        }
      }

      if (data?.user) {
        setStudioLogo(finalLogoUrl);
        let role = signUpRole;
        if (signUpEmail === 'admin@tailorpro.com') role = 'super_admin';
        setUserRole(role);
        if (role === 'tailor') {
          setTailorLock(true);
        }

        const initialStatus = (isApprovedWithKey || role === 'super_admin') ? 'approved' : 'pending';

        // Insert into public.profiles table
        try {
          const { error: pErr } = await supabase.from('profiles').upsert([{
            id: data.user.id,
            email: signUpEmail,
            studio_name: studioName,
            designer_name: signUpName,
            role: role,
            status: initialStatus,
            plan: usedKeyPlan,
            license_key: signUpLicenseKey.trim() || null
          }], { onConflict: 'id' });
          if (pErr) console.error("Could not insert profile record:", pErr.message);
        } catch (pErr) {
          console.warn("Could not insert profile record exception:", pErr.message);
        }

        // If key was used, mark key as used
        if (isApprovedWithKey && signUpLicenseKey.trim()) {
          try {
            await supabase.from('license_keys').update({ is_used: true, used_by: data.user.id }).eq('code', signUpLicenseKey.trim().toUpperCase());
          } catch (kErr) {}
        }

        setAccountApprovalStatus(initialStatus);
        setSupabaseConnected(true);

        if (initialStatus === 'pending') {
          setAuthStatus('pending_approval');
        } else {
          alert("Registration successful! Welcome to Tailor Pro.");
          setAuthStatus('authenticated');
        }
      }
    } catch (err) {
      setDbError(err.message);
    } finally {
      setDbSyncing(false);
    }
  };

  const handleActivatePendingAccount = async (e) => {
    e.preventDefault();
    if (!pendingLicenseKey.trim()) {
      setPendingKeyError("Please enter an activation license key.");
      return;
    }
    setIsActivatingKey(true);
    setPendingKeyError('');
    try {
      const cleanKey = pendingLicenseKey.trim().toUpperCase();
      const { data: keyData, error: keyError } = await supabase
        .from('license_keys')
        .select('*')
        .eq('code', cleanKey)
        .eq('is_used', false)
        .single();

      if (keyError || !keyData) {
        throw new Error("Invalid or already used Activation Key. Please verify the code and try again.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User session not found. Please log in again.");
      }

      await supabase.from('license_keys').update({ is_used: true, used_by: user.id }).eq('code', cleanKey);

      const { error: profErr } = await supabase.from('profiles').update({
        status: 'approved',
        plan: keyData.plan || 'pro',
        license_key: cleanKey
      }).eq('id', user.id);

      if (profErr) throw profErr;

      setAccountApprovalStatus('approved');
      alert("License Key activated successfully! Welcome to Tailor Pro.");
      setAuthStatus('authenticated');
      syncOfflineData();
    } catch (err) {
      setPendingKeyError(err.message);
    } finally {
      setIsActivatingKey(false);
    }
  };

  const handleUpdateStudioProfile = async (e) => {
    e.preventDefault();
    setDbSyncing(true);
    setDbError(null);
    try {
      let finalLogoUrl = studioLogo;

      if (tempLogoFile) {
        setIsUploadingLogo(true);
        const fileExt = tempLogoFile.name.split('.').pop();
        const logoName = `brand-logos/logo-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('Tailorpro')
          .upload(logoName, tempLogoFile, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('Tailorpro')
          .getPublicUrl(logoName);
        
        finalLogoUrl = publicUrl;
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          studio_name: studioName,
          studio_logo: finalLogoUrl,
          lock_pin: workshopLockPin,
          momo_number: momoNumber,
          momo_name: momoName
        }
      });

      if (error) throw error;

      setStudioLogo(finalLogoUrl);
      setTempLogoFile(null);
      setLogoPreviewUrl('');
      setShowSettingsModal(false);
      alert("Studio settings updated successfully!");
    } catch (err) {
      alert("Failed to update studio profile: " + err.message);
    } finally {
      setDbSyncing(false);
      setIsUploadingLogo(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setAuthStatus('login');
    setLoginEmail('');
    setLoginPassword('');
    setTempLogoFile(null);
    setLogoPreviewUrl('');
    setStudioLogo('');
    setDbError(null);
    setSupabaseConnected(false);
    setClients([]);
  };

  const copySqlSchemaToClipboard = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_INSTRUCTION);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  // Sub-Views render outputs
  const renderSplashScreen = () => (
    <div className="splash-container" style={{ paddingBottom: '60px' }}>
      <img src={logoImg} alt="Tailor Pro Logo" className="splash-logo" />
      <h1 style={{ fontSize: '32px', fontFamily: 'var(--font-brand)', fontWeight: 800 }}>TAILOR PRO</h1>
      <p className="text-body" style={{ marginTop: '6px', letterSpacing: '1px' }}>PRECISION DESIGN & LAYOUT SYSTEM</p>
      <div className="loader-bar">
        <div className="loader-progress"></div>
      </div>
      <button onClick={() => setAuthStatus('login')} className="auth-link" style={{ marginTop: '40px' }}>
        Skip Loading →
      </button>
    </div>
  );

  const renderLoginScreen = () => (
    <div className="auth-screen-layout" style={{ paddingBottom: '60px' }}>
      <div className="auth-header">
        <img src={logoImg} alt="Tailor Pro Logo" className="auth-logo-mini" />
        <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-brand)' }}>Welcome to Tailor Pro</h1>
        <p className="text-body" style={{ fontSize: '13px', marginTop: '4px' }}>Supabase B2B Database Connected</p>
      </div>

      {dbError && (
        <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#B91C1C', marginBottom: '14px' }}>
          <strong>Sync Error: </strong> {dbError}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="auth-input-group">
          <label>Email Address</label>
          <input type="email" required className="auth-text-input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="designer@tailorpro.com" />
        </div>
        <div className="auth-input-group">
          <label>Password</label>
          <input type="password" required className="auth-text-input" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <button type="submit" disabled={dbSyncing} className="primary-action-btn" style={{ marginTop: '10px' }}>
          {dbSyncing ? 'Accessing Secure API...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-footer-links" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={() => setAuthStatus('signup')} className="auth-link">
          Don't have a studio account? Register here
        </button>
        <button onClick={() => setAuthStatus('client_tracker')} className="auth-link" style={{ color: '#059669', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Scissors size={14} /> Are you a customer? Track your order status here
        </button>
      </div>

      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '11px', color: 'var(--secondary-color)' }}>
          Developed by <strong>Mokars Tech</strong>
        </span>
        
        {/* Support Section */}
        <div style={{ padding: '12px', backgroundColor: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '300px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: 'var(--text-color)' }}>
            ☕ Support Tailor Pro
          </span>
          <span style={{ fontSize: '10px', color: 'var(--secondary-color)', display: 'block', marginBottom: '6px', lineHeight: '1.3' }}>
            Buy me a coffee via MTN Mobile Money:
          </span>
          <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-color)', letterSpacing: '0.5px' }}>
            0546920418
          </div>
          <span style={{ fontSize: '9px', color: 'var(--secondary-color)', display: 'block', marginTop: '2px' }}>
            Name: Mubarik Tuahir Ali
          </span>
        </div>
      </div>
    </div>
  );

  const renderSignUpScreen = () => (
    <div className="auth-screen-layout" style={{ paddingBottom: '80px', overflowY: 'auto' }}>
      <div className="auth-header" style={{ marginBottom: '16px' }}>
        {logoPreviewUrl ? (
          <img src={logoPreviewUrl} alt="Preview Logo" className="auth-logo-mini" style={{ objectFit: 'cover' }} />
        ) : (
          <img src={logoImg} alt="Tailor Pro Logo" className="auth-logo-mini" />
        )}
        <h1 style={{ fontSize: '22px', fontFamily: 'var(--font-brand)' }}>Register Studio</h1>
        <p className="text-body" style={{ fontSize: '13px' }}>Create Supabase Auth Database account</p>
      </div>

      {dbError && (
        <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #F87171', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#B91C1C', marginBottom: '14px' }}>
          <strong>Registration Error: </strong> {dbError}
        </div>
      )}

      <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="auth-input-group">
          <label>Studio / Brand Name</label>
          <input type="text" required className="auth-text-input" value={studioName} onChange={(e) => setStudioName(e.target.value)} placeholder="Classic Stitches Studio" />
        </div>

        {/* Brand Logo Picker Input */}
        <div className="auth-input-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Brand Logo (Image)</span>
            {tempLogoFile && <span style={{ color: '#059669', fontSize: '10px' }}>Selected</span>}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--border-color)', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            <Upload size={16} /> {tempLogoFile ? 'Change Brand Logo' : 'Choose brand logo file'}
            <input type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
          </label>
        </div>

        <div className="auth-input-group">
          <label>Your Role</label>
          <select className="auth-text-input" value={signUpRole} onChange={(e) => setSignUpRole(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '13px' }}>
            <option value="owner">Studio Owner / Head Designer</option>
            <option value="tailor">Tailor / Workshop Stitcher</option>
            <option value="front_desk">Front Desk / Stylist</option>
          </select>
        </div>

        <div className="auth-input-group">
          <label>Designer Name</label>
          <input type="text" required className="auth-text-input" value={signUpName} onChange={(e) => setSignUpName(e.target.value)} placeholder="Akosua Mensah" />
        </div>
        <div className="auth-input-group">
          <label>Email Address</label>
          <input type="email" required className="auth-text-input" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} placeholder="designer@studio.com" />
        </div>
        <div className="auth-input-group">
          <label>Workshop Safety PIN (4-Digits)</label>
          <input type="text" maxLength={4} required className="auth-text-input" value={workshopLockPin} onChange={(e) => setWorkshopLockPin(e.target.value.replace(/\D/g,''))} placeholder="1234" />
        </div>
        <div className="auth-input-group">
          <label>Password</label>
          <input type="password" required className="auth-text-input" value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} placeholder="••••••••" />
        </div>

        <div className="auth-input-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Activation / License Key (Optional)</span>
            <span style={{ fontSize: '10px', color: 'var(--secondary-color)' }}>Instant Activation</span>
          </label>
          <input type="text" className="auth-text-input" value={signUpLicenseKey} onChange={(e) => setSignUpLicenseKey(e.target.value)} placeholder="e.g. TP-98X2-PRO" style={{ textTransform: 'uppercase', letterSpacing: '1px' }} />
          <span style={{ fontSize: '10px', color: 'var(--secondary-color)', marginTop: '2px' }}>
            If you do not have a key, your registration will be sent to the owner for approval.
          </span>
        </div>
        
        <button type="submit" disabled={isUploadingLogo || dbSyncing} className="primary-action-btn" style={{ marginTop: '8px' }}>
          {isUploadingLogo ? 'Uploading logo to storage...' : dbSyncing ? 'Creating API credentials...' : 'Register Brand'}
        </button>
      </form>

      <div className="auth-footer-links">
        <button onClick={() => setAuthStatus('login')} className="auth-link">
          Already registered? Sign in instead
        </button>
      </div>

      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '11px', color: 'var(--secondary-color)' }}>
          Developed by <strong>Mokars Tech</strong>
        </span>
        
        {/* Support Section */}
        <div style={{ padding: '12px', backgroundColor: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '300px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: 'var(--text-color)' }}>
            ☕ Support Tailor Pro
          </span>
          <span style={{ fontSize: '10px', color: 'var(--secondary-color)', display: 'block', marginBottom: '6px', lineHeight: '1.3' }}>
            Buy me a coffee via MTN Mobile Money:
          </span>
          <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-color)', letterSpacing: '0.5px' }}>
            0546920418
          </div>
          <span style={{ fontSize: '9px', color: 'var(--secondary-color)', display: 'block', marginTop: '2px' }}>
            Name: Mubarik Tuahir Ali
          </span>
        </div>
      </div>
    </div>
  );

  const renderPendingApprovalScreen = () => (
    <div className="auth-screen-layout" style={{ padding: '30px 20px', textAlign: 'center', maxWidth: '440px', margin: '0 auto' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <AlertTriangle size={32} />
      </div>
      <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-brand)', marginBottom: '10px' }}>Account Pending Activation</h1>
      <p style={{ fontSize: '14px', color: 'var(--secondary-color)', lineHeight: '1.5', marginBottom: '20px' }}>
        Thank you for registering <strong>{studioName || 'your studio'}</strong>! Your account is created and currently pending administrator review.
      </p>

      <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left', fontSize: '12px', lineHeight: '1.6' }}>
        <div><strong>Email:</strong> {loginEmail || signUpEmail}</div>
        <div><strong>Status:</strong> <span style={{ color: '#D97706', fontWeight: 'bold' }}>⏳ Pending Review</span></div>
      </div>

      {/* License Key Activation Section */}
      <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', marginBottom: '20px', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ backgroundColor: '#D1FAE5', color: '#059669', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Key size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontFamily: 'var(--font-brand)' }}>Activate Account Immediately</h3>
            <span style={{ fontSize: '11px', color: 'var(--secondary-color)' }}>Have a license key? Enter it below to unlock access.</span>
          </div>
        </div>

        {pendingKeyError && (
          <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {pendingKeyError}
          </div>
        )}

        <form onSubmit={handleActivatePendingAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--secondary-color)', marginBottom: '4px' }}>LICENSE ACTIVATION KEY</label>
            <input
              type="text"
              required
              className="auth-text-input"
              value={pendingLicenseKey}
              onChange={(e) => setPendingLicenseKey(e.target.value)}
              placeholder="e.g. TP-98X2-PRO"
              style={{ textTransform: 'uppercase', letterSpacing: '1px', width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '13px' }}
            />
          </div>
          <button
            type="submit"
            disabled={isActivatingKey}
            className="primary-action-btn"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}
          >
            {isActivatingKey ? (
              <>
                <RefreshCw size={16} className="spin" /> Activating...
              </>
            ) : (
              <>
                <CheckCircle size={16} /> Activate Account
              </>
            )}
          </button>
        </form>
      </div>

      <button onClick={handleLogout} className="primary-action-btn" style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)', width: '100%' }}>
        Back to Login
      </button>
    </div>
  );

  const renderAccountBlockedScreen = () => (
    <div className="auth-screen-layout" style={{ padding: '40px 20px', textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <UserX size={32} />
      </div>
      <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-brand)', marginBottom: '10px' }}>Access Revoked</h1>
      <p style={{ fontSize: '14px', color: 'var(--secondary-color)', lineHeight: '1.5', marginBottom: '24px' }}>
        Your account access has been suspended or revoked by the application administrator. Please contact support to restore access.
      </p>
      <button onClick={handleLogout} className="primary-action-btn">
        Return to Login
      </button>
    </div>
  );

  const renderAdminPanelScreen = () => (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Admin Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={24} style={{ color: '#059669' }} />
            <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-brand)', margin: 0 }}>Super Admin Panel</h1>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--secondary-color)', marginTop: '4px' }}>
            Manage user approvals, access authorization, and monetization activation keys.
          </p>
        </div>
        <button onClick={fetchAdminData} className="primary-action-btn" style={{ padding: '8px 14px', fontSize: '12px', width: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Sync Records
        </button>
      </div>

      {/* Admin Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button onClick={() => setAdminSubTab('users')} className={`sidebar-tab ${adminSubTab === 'users' ? 'active' : ''}`} style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UserCheck size={16} /> User Approvals ({adminUsersList.length})
        </button>
        <button onClick={() => setAdminSubTab('keys')} className={`sidebar-tab ${adminSubTab === 'keys' ? 'active' : ''}`} style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Key size={16} /> Activation Keys ({adminKeysList.length})
        </button>
        <button onClick={() => setAdminSubTab('sql')} className={`sidebar-tab ${adminSubTab === 'sql' ? 'active' : ''}`} style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Database size={16} /> SQL Setup
        </button>
      </div>

      {/* TAB 1: USER APPROVALS */}
      {adminSubTab === 'users' && (
        <div>
          <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)', color: 'var(--secondary-color)' }}>
                  <th style={{ padding: '12px 16px' }}>Studio / Designer</th>
                  <th style={{ padding: '12px 16px' }}>Email</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsersList.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--secondary-color)' }}>
                      No profile records found. Run the updated SQL setup in your Supabase editor if table isn't created yet.
                    </td>
                  </tr>
                ) : (
                  adminUsersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{u.studio_name || 'Unnamed Studio'}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--secondary-color)' }}>{u.designer_name || 'Designer'}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.05)', fontSize: '11px', textTransform: 'capitalize' }}>
                          {u.role || 'owner'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: u.status === 'approved' ? '#D1FAE5' : u.status === 'blocked' ? '#FEE2E2' : '#FEF3C7',
                          color: u.status === 'approved' ? '#065F46' : u.status === 'blocked' ? '#991B1B' : '#92400E'
                        }}>
                          {u.status === 'approved' ? 'Active' : u.status === 'blocked' ? 'Blocked' : 'Pending Review'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {u.status !== 'approved' && (
                            <button onClick={() => handleApproveUser(u.id, 'approved')} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                              Approve
                            </button>
                          )}
                          {u.status !== 'blocked' && (
                            <button onClick={() => handleApproveUser(u.id, 'blocked')} style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                              Block Access
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVATION KEYS */}
      {adminSubTab === 'keys' && (
        <div>
          <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>Generate New Activation Key</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={newKeyPlan} onChange={(e) => setNewKeyPlan(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontSize: '13px' }}>
                <option value="pro">Pro Monthly Plan</option>
                <option value="yearly">Yearly VIP Plan</option>
                <option value="lifetime">Lifetime License</option>
              </select>
              <button onClick={handleGenerateLicenseKey} disabled={isGeneratingKey} className="primary-action-btn" style={{ width: 'auto', padding: '10px 20px', fontSize: '13px' }}>
                {isGeneratingKey ? 'Generating...' : '🔑 Generate Key'}
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)', color: 'var(--secondary-color)' }}>
                  <th style={{ padding: '12px 16px' }}>Activation Code</th>
                  <th style={{ padding: '12px 16px' }}>Plan Tier</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Copy Code</th>
                </tr>
              </thead>
              <tbody>
                {adminKeysList.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--secondary-color)' }}>
                      No generated keys. Click "Generate Key" above to create one.
                    </td>
                  </tr>
                ) : (
                  adminKeysList.map(k => (
                    <tr key={k.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px' }}>
                        {k.code}
                      </td>
                      <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>{k.plan}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: k.is_used ? '#E5E7EB' : '#D1FAE5',
                          color: k.is_used ? '#6B7280' : '#065F46'
                        }}>
                          {k.is_used ? 'Redeemed' : 'Available'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => { navigator.clipboard.writeText(k.code); alert("Key copied to clipboard!"); }} style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Copy size={12} /> Copy
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SQL SETUP */}
      {adminSubTab === 'sql' && (
        <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', margin: 0 }}>Supabase Authorization Schema</h3>
            <button onClick={copySqlSchemaToClipboard} className="save-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
              {copiedSchema ? 'Copied!' : 'Copy SQL Script'}
            </button>
          </div>
          <pre style={{ backgroundColor: '#1E293B', color: '#F8FAFC', padding: '16px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '400px' }}>
            {SQL_SCHEMA_INSTRUCTION}
          </pre>
        </div>
      )}
    </div>
  );

  const renderInventoryScreen = () => (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={24} style={{ color: 'var(--text-color)' }} />
            <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-brand)', margin: 0 }}>Fabric & Materials Inventory</h1>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--secondary-color)', marginTop: '4px' }}>
            Track fabric yards, linings, zippers, and trims. Monitor low-stock alerts.
          </p>
        </div>
        <button onClick={() => setShowInventoryModal(true)} className="primary-action-btn" style={{ width: 'auto', padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Add Material
        </button>
      </div>

      <div style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', display: 'grid', gap: '16px' }}>
        {inventoryList.map(item => {
          const isLowStock = Number(item.quantity) <= Number(item.low_stock_threshold);
          return (
            <div key={item.id} style={{ backgroundColor: 'var(--surface-color)', border: isLowStock ? '2px solid #F87171' : '1px solid var(--border-color)', borderRadius: '16px', padding: '18px', position: 'relative' }}>
              {isLowStock && (
                <span style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#FEE2E2', color: '#B91C1C', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> Low Stock
                </span>
              )}
              <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--secondary-color)', display: 'block', marginBottom: '4px' }}>
                {item.category}
              </span>
              <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', paddingRight: isLowStock ? '70px' : '0' }}>{item.item_name}</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-color)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <span style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'monospace' }}>
                  {item.quantity} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>{item.unit}</span>
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handleUpdateInventoryQty(item.id, -1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                  <button onClick={() => handleUpdateInventoryQty(item.id, 1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--secondary-color)' }}>
                <span>Alert at: ≤ {item.low_stock_threshold} {item.unit}</span>
                <button onClick={() => handleDeleteInventoryItem(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const shareInvoiceWhatsApp = () => {
    if (!invoiceClient) return;
    const totalBill = Number(invoiceClient.totalBilling || 0);
    const paidDep = Number(invoiceClient.paidDeposit || 0);
    const due = totalBill - paidDep;
    const invId = invoiceClient.id.toString().substring(0,6).toUpperCase();
    
    let message = `*${(studioName || 'TAILOR PRO STUDIO').toUpperCase()}*\n`;
    message += `-----------------------------\n`;
    message += `Dear *${invoiceClient.name}*,\n\n`;
    message += `Here is your order invoice details:\n`;
    message += `👗 *Garment*: ${invoiceClient.garmentType}\n`;
    message += `📈 *Stage*: ${invoiceClient.stage || 'Consult'}\n\n`;
    message += `*Billing Details*:\n`;
    message += `💰 *Total Amount*: GHS ${totalBill.toLocaleString()}\n`;
    message += `🟢 *Deposit Paid*: GHS ${paidDep.toLocaleString()}\n`;
    message += `⏳ *Balance Due*: GHS ${due.toLocaleString()}\n\n`;
    message += `*Payment Details (MoMo)*:\n`;
    message += `💳 *Number*: ${momoNumber || '0546920418'}\n`;
    if (momoName) {
      message += `👤 *Name*: ${momoName}\n`;
    }
    message += `🔖 *Reference*: INV-${invId}\n\n`;
    
    // Generate direct public tracking link using page location
    const trackingUrl = `${window.location.origin}${window.location.pathname}?phone=${encodeURIComponent(invoiceClient.phone)}`;
    message += `📍 *Track your order status live here*:\n${trackingUrl}\n\n`;
    message += `Thank you for choosing us! ✨`;
    
    // Clean up phone number from non-digits (like plus, spaces)
    const sanitizedPhone = invoiceClient.phone.replace(/\D/g, '');
    
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const renderInvoiceModal = () => {
    if (!invoiceClient) return null;
    const totalBill = Number(invoiceClient.totalBilling || 0);
    const paidDep = Number(invoiceClient.paidDeposit || 0);
    const due = totalBill - paidDep;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <div style={{ backgroundColor: '#FFF', color: '#0F172A', borderRadius: '20px', width: '100%', maxWidth: '540px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E2E8F0', paddingBottom: '20px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                {studioLogo && <img src={studioLogo} alt="Studio Logo" style={{ height: '36px', width: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #CBD5E1' }} />}
                <h2 style={{ fontFamily: 'var(--font-brand)', margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: 'bold' }}>{(studioName || 'TAILOR PRO STUDIO').toUpperCase()}</h2>
              </div>
              <span style={{ fontSize: '12px', color: '#64748B', display: 'block' }}>Bespoke Tailoring & Fashion Design</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', display: 'block' }}>INVOICE</span>
              <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>#INV-{invoiceClient.id.toString().substring(0,6).toUpperCase()}</span>
              <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>Date: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Client Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', marginBottom: '20px', fontSize: '13px' }}>
            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '2px' }}>BILLED TO</span>
              <strong style={{ fontSize: '15px', color: '#0F172A' }}>{invoiceClient.name}</strong>
              <div style={{ color: '#475569', marginTop: '2px' }}>📞 {invoiceClient.phone || 'N/A'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '2px' }}>ORDER DETAILS</span>
              <div style={{ fontWeight: 'bold', color: '#0F172A' }}>{invoiceClient.garmentType}</div>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>Stage: {invoiceClient.stage || 'Consult'}</span>
            </div>
          </div>

          {/* Billing Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', textTransform: 'uppercase', fontSize: '11px', color: '#64748B' }}>
                <th style={{ textAlign: 'left', padding: '8px 0' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '8px 0' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 0', fontWeight: '600', color: '#1E293B' }}>{invoiceClient.garmentType} (Custom Tailoring & Materials)</td>
                <td style={{ textAlign: 'right', padding: '12px 0', fontFamily: 'monospace', fontWeight: 'bold' }}>GHS {totalBill.toLocaleString()}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 0', color: '#047857', fontWeight: '500' }}>Less Deposit Paid</td>
                <td style={{ textAlign: 'right', padding: '12px 0', fontFamily: 'monospace', color: '#047857', fontWeight: 'bold' }}>- GHS {paidDep.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals Summary Box */}
          <div style={{ backgroundColor: due === 0 ? '#F0FDF4' : '#FFFBEB', border: due === 0 ? '1px solid #BBF7D0' : '1px solid #FDE68A', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: due === 0 ? '#166534' : '#92400E', display: 'block' }}>Payment Status</span>
              <strong style={{ fontSize: '14px', color: due === 0 ? '#15803D' : '#B45309' }}>{due === 0 ? '🟢 PAID IN FULL' : '⏳ BALANCE OUTSTANDING'}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 'bold' }}>Balance Due</span>
              <div style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'monospace', color: due === 0 ? '#15803D' : '#B45309' }}>GHS {due.toLocaleString()}</div>
            </div>
          </div>

          {/* MoMo Support Footer */}
          <div style={{ backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', padding: '14px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center', fontSize: '12px', color: '#334155' }}>
            <div style={{ fontWeight: 'bold', color: '#0F172A', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span>💳 Mobile Money (MoMo) Payment Details</span>
            </div>
            <div>
              <strong>Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: '#2563EB' }}>{momoNumber || '0546920418'}</span>
              {momoName && <span style={{ marginLeft: '8px', color: '#64748B' }}>({momoName})</span>}
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
              Please quote invoice #{invoiceClient.id.toString().substring(0,6).toUpperCase()} as reference when making payment.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => window.print()} className="primary-action-btn" style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Printer size={16} /> Print / Save PDF
              </button>
              <button 
                onClick={shareInvoiceWhatsApp} 
                className="primary-action-btn" 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  backgroundColor: '#22C55E', 
                  color: '#FFFFFF', 
                  border: 'none' 
                }}
              >
                <MessageSquare size={16} /> Share to WhatsApp
              </button>
            </div>
            <button onClick={() => setShowInvoiceModal(false)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: '#FFF', color: '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
              Close
            </button>
          </div>

        </div>
      </div>
    );
  };

  const renderPublicTrackingScreen = () => (
    <div style={{ padding: '30px 20px 60px 20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <button onClick={() => setAuthStatus('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-color)', fontWeight: 'bold', fontSize: '13px', marginBottom: '20px' }}>
        <ArrowLeft size={16} /> Return to Studio Login
      </button>
      <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-color)' }}>
        <Scissors size={28} />
      </div>
      <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-brand)', marginBottom: '6px' }}>Order Status Tracker</h1>
      <p style={{ fontSize: '13px', color: 'var(--secondary-color)', marginBottom: '24px', lineHeight: '1.4' }}>
        Enter your registered telephone number below to check your garment production status.
      </p>

      <form onSubmit={async (e) => {
        e.preventDefault();
        setHasSearchedTracking(true);
        setDbSyncing(true);
        const searchClean = trackingPhoneSearch.trim();

        // 1. Check local state cache first
        let match = clients.find(c => c.phone && c.phone.trim() === searchClean);

        // 2. Fetch from Supabase if not found locally
        if (!match) {
          try {
            const { data, error } = await supabase
              .from('clients')
              .select('*')
              .eq('phone', searchClean);

            if (!error && data && data.length > 0) {
              const c = data[0];
              match = {
                id: c.id,
                name: c.name,
                garmentType: c.garment_type,
                status: c.status || 'Active',
                lastMeasured: c.last_measured || 'Just now',
                phone: c.phone || '',
                measurements: c.measurements || {},
                totalBilling: Number(c.total_billing || 0),
                paidDeposit: Number(c.paid_deposit || 0),
                outstandingBalance: Number(c.total_billing || 0) - Number(c.paid_deposit || 0),
                notes: c.notes || '',
                boltWidth: c.bolt_width || '60 Inches',
                stage: c.stage || 'Cutting',
                fabricSwatchUrl: c.fabric_swatch_url
              };
            }
          } catch (err) {
            console.warn("Tracker query error:", err.message);
          }
        }

        setTrackedResultClient(match || null);
        setDbSyncing(false);
      }} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input 
          type="text" 
          required 
          className="auth-text-input" 
          value={trackingPhoneSearch} 
          onChange={(e) => setTrackingPhoneSearch(e.target.value)} 
          placeholder="e.g. 0244123456" 
          style={{ flex: 1, padding: '12px' }} 
        />
        <button type="submit" className="primary-action-btn" style={{ width: 'auto', padding: '12px 20px' }}>
          <Search size={16} /> Track
        </button>
      </form>

      {hasSearchedTracking && (
        <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', textAlign: 'left' }}>
          {trackedResultClient ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', margin: 0 }}>{trackedResultClient.name}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--secondary-color)' }}>{trackedResultClient.garmentType}</span>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: '12px', backgroundColor: '#D1FAE5', color: '#065F46', fontSize: '12px', fontWeight: 'bold' }}>
                  {trackedResultClient.stage || 'Consult'} Stage
                </span>
              </div>

              {/* Runway Steps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '16px', textAlign: 'center' }}>
                {['Consult', 'Cutting', 'Fitting', 'Delivered'].map(stg => {
                  const stagesOrder = ['Consult', 'Cutting', 'Fitting', 'Delivered'];
                  const currentIdx = stagesOrder.indexOf(trackedResultClient.stage || 'Consult');
                  const stgIdx = stagesOrder.indexOf(stg);
                  const isDone = stgIdx <= currentIdx;

                  return (
                    <div key={stg} style={{ padding: '8px 4px', borderRadius: '8px', backgroundColor: isDone ? 'var(--text-color)' : 'var(--bg-color)', color: isDone ? 'var(--bg-color)' : 'var(--secondary-color)', fontSize: '10px', fontWeight: 'bold', border: '1px solid var(--border-color)' }}>
                      {stg}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--secondary-color)', fontSize: '13px' }}>
              ❌ No order found associated with this phone number. Please verify your phone number with your tailor.
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderAuthenticatedView = () => {
    if (currentScreen === 'digital-tape' && selectedClient) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="measurement-header">
            <button onClick={() => setCurrentScreen('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-color)', fontWeight: 600 }}>
              <ArrowLeft size={16} /> Back
            </button>
            <h2>{selectedClient.name}</h2>
            <button onClick={saveTapeMeasurements} className="save-btn">Save</button>
          </div>

          {/* Gender Selector Category tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 12px 0' }}>
            <div className="gender-mode-header" style={{ width: '100%', maxWidth: '320px' }}>
              <button 
                onClick={() => handleGenderChange('male')} 
                className={`gender-mode-btn ${measurementGender === 'male' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', gap: '6px' }}
              >
                <span>♂️</span> Male Category
              </button>
              <button 
                onClick={() => handleGenderChange('female')} 
                className={`gender-mode-btn ${measurementGender === 'female' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', gap: '6px' }}
              >
                <span>♀️</span> Female Category
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <span className="text-body" style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '12px' }}>
              Segment: {activeSegment}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Auto-Next:</span>
              <button 
                onClick={() => setAutoNext(!autoNext)} 
                style={{ border: 'none', padding: '3px 8px', borderRadius: '12px', backgroundColor: autoNext ? 'var(--text-color)' : 'var(--surface-color)', color: autoNext ? 'var(--bg-color)' : 'var(--secondary-color)', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {autoNext ? 'ON 🟢' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="digital-tape-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {measurementFields.map(field => {
                const isActive = activeField === field.key;
                return (
                  <div 
                    key={field.key} 
                    onClick={() => {
                      setActiveField(field.key);
                      setActiveSegment(field.segment);
                      const inputEl = document.getElementById(`input-${field.key}`);
                      if (inputEl) inputEl.focus();
                    }}
                    className={isActive ? 'active-input-card' : 'inactive-input-card'}
                    style={isActive && hapticTrigger ? { transform: 'scale(0.98)', border: '2px solid #111111' } : {}}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--text-color)' : 'var(--secondary-color)' }}>
                      {field.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                      <input
                        id={`input-${field.key}`}
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        placeholder="Tap to enter"
                        value={tapeMeasurements[field.key] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^[0-9]*\.?[0-9]*$/.test(val) || val === '') {
                            const updated = { ...tapeMeasurements, [field.key]: val };
                            setTapeMeasurements(updated);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            advanceToNextField();
                          }
                        }}
                        onFocus={() => {
                          setActiveField(field.key);
                          setActiveSegment(field.segment);
                        }}
                        className="text-mono"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontFamily: 'inherit',
                          fontSize: isActive ? '20px' : '16px',
                          color: 'var(--text-color)',
                          width: '100%',
                          padding: 0,
                        }}
                      />
                      {(tapeMeasurements[field.key] || isActive) && (
                        <span style={{ fontSize: '12px', color: 'var(--secondary-color)', fontWeight: 'bold' }}>in</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="croquis-box" style={{ height: '100%', minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px' }}>
              
              {/* Telemetry Header */}
              <div style={{ width: '100%', textAlign: 'center', backgroundColor: 'var(--surface-color)', padding: '6px 8px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10px', color: 'var(--secondary-color)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block' }}>
                  Active Fitting Telemetry
                </span>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-color)' }}>
                  {activeFieldDetails?.label}: {tapeMeasurements[activeField] ? `${tapeMeasurements[activeField]}"` : '...'}
                </span>
              </div>

              {/* Interactive SVG Mannequin with Highlight Overlays */}
              <div style={{ position: 'relative', margin: '8px 0' }}>
                <svg width="120" height="230" viewBox="0 0 120 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Head & Neck */}
                  <path d="M60 22 C64 22 67 19 67 14 C67 9 64 6 60 6 C56 6 53 9 53 14 C53 19 56 22 60 22 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                  <path d="M57 22 L57 28 C57 32 63 32 63 28 L63 22" stroke={activeField === 'neck' ? '#047857' : 'var(--secondary-color)'} strokeWidth={activeField === 'neck' ? '3' : '1.2'} />
                  
                  {/* Torso & Arms */}
                  <path d="M42 34 C46 32 54 30 60 30 C66 30 74 32 78 34 C82 36 84 41 84 45 L80 90 C79 93 76 95 73 95 L68 95 C66 98 64 105 65 110 C66 115 69 125 70 135 C68 138 65 140 60 140 C55 140 52 138 50 135 C51 125 54 115 55 110 C56 105 54 98 52 95 L47 95 C44 95 41 93 40 90 L36 45 C36 41 38 36 42 34 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                  
                  {/* Legs */}
                  <path d="M50 135 L44 225 C43 228 46 230 49 230 L53 230 L57 160 L60 160 L63 160 L67 230 L71 230 C74 230 77 228 76 225 L70 135" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />

                  {/* Anatomical Highlights & Glowing Measuring Lines */}
                  {(activeField === 'chest' || activeField === 'bust') && (
                    <>
                      <rect x="38" y="46" width="44" height="18" rx="4" fill="#047857" fillOpacity="0.25" stroke="#047857" strokeWidth="1.5" />
                      <line x1="36" y1="55" x2="84" y2="55" stroke="#047857" strokeWidth="3.5" strokeDasharray="4 2" />
                    </>
                  )}
                  {activeField === 'shoulder' && (
                    <>
                      <line x1="36" y1="33" x2="84" y2="33" stroke="#047857" strokeWidth="4" strokeDasharray="3 2" />
                      <circle cx="36" cy="33" r="3" fill="#047857" />
                      <circle cx="84" cy="33" r="3" fill="#047857" />
                    </>
                  )}
                  {activeField === 'underbust' && (
                    <>
                      <rect x="42" y="62" width="36" height="10" rx="3" fill="#047857" fillOpacity="0.25" />
                      <line x1="40" y1="67" x2="80" y2="67" stroke="#047857" strokeWidth="3.5" strokeDasharray="3 2" />
                    </>
                  )}
                  {activeField === 'breast_length' && (
                    <line x1="48" y1="33" x2="48" y2="58" stroke="#047857" strokeWidth="3.5" strokeDasharray="3 2" />
                  )}
                  {activeField === 'neck' && (
                    <ellipse cx="60" cy="25" rx="9" ry="5" fill="#047857" fillOpacity="0.3" stroke="#047857" strokeWidth="2" />
                  )}
                  {activeField === 'sleeve' && (
                    <path d="M78 34 L82 95" stroke="#047857" strokeWidth="4" strokeDasharray="4 2" />
                  )}
                  {activeField === 'round_sleeves' && (
                    <line x1="74" y1="60" x2="86" y2="60" stroke="#047857" strokeWidth="4" />
                  )}
                  {activeField === 'top_length' && (
                    <line x1="55" y1="33" x2="55" y2="95" stroke="#047857" strokeWidth="3.5" strokeDasharray="4 2" />
                  )}
                  {activeField === 'waist' && (
                    <>
                      <rect x="46" y="90" width="28" height="10" rx="3" fill="#047857" fillOpacity="0.3" />
                      <line x1="44" y1="95" x2="76" y2="95" stroke="#047857" strokeWidth="4" strokeDasharray="3 2" />
                    </>
                  )}
                  {activeField === 'hips' && (
                    <>
                      <rect x="48" y="120" width="24" height="12" rx="3" fill="#047857" fillOpacity="0.3" />
                      <line x1="46" y1="125" x2="74" y2="125" stroke="#047857" strokeWidth="4" strokeDasharray="3 2" />
                    </>
                  )}
                  {activeField === 'thigh' && (
                    <line x1="43" y1="150" x2="57" y2="150" stroke="#047857" strokeWidth="3.5" strokeDasharray="3 2" />
                  )}
                  {activeField === 'knee' && (
                    <line x1="44" y1="180" x2="56" y2="180" stroke="#047857" strokeWidth="3.5" strokeDasharray="3 2" />
                  )}
                  {activeField === 'ankle' && (
                    <line x1="42" y1="220" x2="52" y2="220" stroke="#047857" strokeWidth="3.5" strokeDasharray="3 2" />
                  )}
                  {activeField === 'inseam' && (
                    <line x1="59" y1="155" x2="59" y2="225" stroke="#047857" strokeWidth="4" strokeDasharray="4 2" />
                  )}
                  {activeField === 'skirt_length' && (
                    <line x1="60" y1="95" x2="60" y2="180" stroke="#047857" strokeWidth="3.5" strokeDasharray="4 2" />
                  )}
                  {activeField === 'length' && (
                    <line x1="60" y1="30" x2="60" y2="225" stroke="#047857" strokeWidth="4" strokeDasharray="4 2" />
                  )}
                </svg>
              </div>

              {/* Tailoring Anatomical Guidance Tip */}
              <div style={{ backgroundColor: 'var(--surface-color)', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', width: '100%', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#047857', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                  💡 Fitting Guide
                </span>
                <p style={{ fontSize: '10px', color: 'var(--secondary-color)', margin: 0, lineHeight: '1.3' }}>
                  {activeField === 'chest' || activeField === 'bust' ? 'Wrap tape around fullest part of chest/bust, keeping tape level across back.' :
                   activeField === 'shoulder' ? 'Measure across back from outer left shoulder tip to right shoulder tip.' :
                   activeField === 'waist' ? 'Measure around natural waistline above navel at narrowest torso point.' :
                   activeField === 'hips' ? 'Measure around fullest part of hips & buttocks with feet together.' :
                   activeField === 'sleeve' ? 'Measure from shoulder point down arm to wrist bone.' :
                   activeField === 'inseam' ? 'Measure along inner leg seam from crotch down to ankle bone.' :
                   `Position tape snugly around ${activeFieldDetails?.label.toLowerCase()} without pulling tightly.`}
                </p>
              </div>

            </div>
          </div>


          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0 0' }}>
            <button onClick={prevField} className="nav-tab" style={{ flexDirection: 'row', gap: '4px' }}>
              <ChevronLeft size={16} /> Prev
            </button>
            <button onClick={advanceToNextField} className="nav-tab" style={{ flexDirection: 'row', gap: '4px' }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (currentScreen === 'order-spec' && selectedClient) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="measurement-header">
            <button onClick={() => setCurrentScreen('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-color)', fontWeight: 600 }}>
              <ArrowLeft size={16} /> Back
            </button>
            <h2>Spec Sheet: {selectedClient.name}</h2>
            <button onClick={confirmSpecOrder} className="save-btn">Confirm</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            <datalist id="spec-garments-list">
              <option value="Kente Gown" />
              <option value="3-Piece Suit" />
              <option value="Kaftan" />
              <option value="Agbada" />
              <option value="Shirt & Trouser" />
              <option value="Corporate Jacket" />
            </datalist>

            {garmentsList.map((garment, index) => (
              <div 
                key={garment.id || index} 
                style={{ 
                  backgroundColor: 'var(--surface-color)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '16px', 
                  padding: '16px', 
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                      {index + 1}
                    </span>
                    Garment #{index + 1}: {garment.garmentType || 'Item'}
                  </span>
                  {garmentsList.length > 1 && (
                    <button 
                      onClick={() => removeGarmentFromSpec(garment.id)}
                      style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}
                      title="Remove Garment"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>

                <div className="spec-grid">
                  <div className="croquis-box">
                    <span style={{ fontSize: '11px', color: 'var(--secondary-color)', position: 'absolute', top: '8px' }}>Visual Croquis spec</span>
                    
                    {(garment.fabricSwatches && garment.fabricSwatches.length > 0) ? (
                      <img src={garment.fabricSwatches[0]} alt="Primary fabric swatch" style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '8px', border: '1px solid var(--border-color)' }} />
                    ) : (
                      <svg width="80" height="160" viewBox="0 0 120 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Head & Neck */}
                        <path d="M60 22 C64 22 67 19 67 14 C67 9 64 6 60 6 C56 6 53 9 53 14 C53 19 56 22 60 22 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                        <path d="M57 22 L57 28 C57 32 63 32 63 28 L63 22" stroke="var(--secondary-color)" strokeWidth="1.2" />
                        
                        {/* Mannequin Body */}
                        <path d="M42 34 C46 32 54 30 60 30 C66 30 74 32 78 34 C82 36 84 41 84 45 L80 90 C79 93 76 95 73 95 L68 95 C66 98 64 105 65 110 C66 115 69 125 70 135 C68 138 65 140 60 140 C55 140 52 138 50 135 C51 125 54 115 55 110 C56 105 54 98 52 95 L47 95 C44 95 41 93 40 90 L36 45 C36 41 38 36 42 34 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                        <path d="M50 135 L44 225 C43 228 46 230 49 230 L53 230 L57 160 L60 160 L63 160 L67 230 L71 230 C74 230 77 228 76 225 L70 135" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />

                        {/* Garment overlays */}
                        {garment.garmentType === 'Kente Gown' && (
                          <path d="M42 34 L78 34 L80 80 L76 135 L76 225 L44 225 L44 135 L40 80 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="2" fillOpacity="0.5" />
                        )}
                        {garment.garmentType === '3-Piece Suit' && (
                          <>
                            <path d="M42 34 L78 34 L80 95 L40 95 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="2" fillOpacity="0.5"/>
                            <path d="M48 95 L44 225 L58 225 L58 150 L62 150 L62 225 L76 225 L72 95 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="1.5" fillOpacity="0.5" />
                          </>
                        )}
                        {garment.garmentType === 'Kaftan' && (
                          <path d="M38 34 L82 34 L80 200 L40 200 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="2" fillOpacity="0.5" />
                        )}
                      </svg>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '6px' }}>{garment.garmentType}</span>
                  </div>

                  <div className="spec-controls">
                    <div className="select-wrapper">
                      <label>Garment Type</label>
                      <input 
                        type="text" 
                        list="spec-garments-list" 
                        className="select-input" 
                        value={garment.garmentType || ''} 
                        onChange={(e) => updateGarmentInSpec(garment.id, 'garmentType', e.target.value)} 
                        placeholder="Kente Gown, Kaftan, Suit..."
                        required
                      />
                    </div>

                    <div className="select-wrapper">
                      <label>Fabric Bolt Width</label>
                      <select 
                        className="select-input" 
                        value={garment.boltWidth || '60 Inches'} 
                        onChange={(e) => updateGarmentInSpec(garment.id, 'boltWidth', e.target.value)}
                      >
                        <option value="60 Inches">60 Inches Width</option>
                        <option value="45 Inches">45 Inches Width</option>
                        <option value="36 Inches">36 Inches Width</option>
                      </select>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-color)', display: 'block', marginBottom: '6px' }}>
                        Fabric Photos ({garment.fabricSwatches ? garment.fabricSwatches.length : 0})
                      </span>
                      
                      {/* Fabric Swatches Gallery */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {(garment.fabricSwatches || []).map((swatchUrl, sIdx) => (
                          <div key={sIdx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <img src={swatchUrl} alt={`Fabric ${sIdx+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button 
                              onClick={() => removeFabricSwatchFromGarment(garment.id, sIdx)}
                              style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
                              title="Remove Photo"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <label className="numpad-button" style={{ height: '48px', display: 'flex', flexDirection: 'row', fontSize: '11px', gap: '6px', cursor: 'pointer', justifyContent: 'center', alignItems: 'center', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
                        {isSnapping ? (
                          <span>Uploading...</span>
                        ) : (
                          <>
                            <Upload size={16} />
                            <span>Add Fabric Photo</span>
                          </>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => handleGarmentFabricUpload(garment.id, e)} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pulse-box" style={{ margin: '14px 0' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--secondary-color)', display: 'block', marginBottom: '4px' }}>
                    Automated Yardage Calculator ({garment.garmentType})
                  </span>
                  <p style={{ fontSize: '11px', color: 'var(--secondary-color)', marginBottom: '6px' }}>
                    Based on {(selectedClient.measurements?._category || 'male') === 'female' ? 'Bust' : 'Chest'}: {selectedClient.measurements?.bust || selectedClient.measurements?.chest || '0.0'}" and Length: {selectedClient.measurements?.length || '0.0'}"
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '6px' }}>
                    <span className="text-mono" style={{ fontSize: '24px', color: 'var(--text-color)' }}>{calculateRequiredYardage(garment.boltWidth)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Yards Needed</span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-color)', display: 'block', marginBottom: '4px' }}>
                    Pattern Notes & Sewing Specs
                  </span>
                  <textarea 
                    value={garment.notes || ''}
                    onChange={(e) => updateGarmentInSpec(garment.id, 'notes', e.target.value)}
                    className="select-input" 
                    rows={3}
                    style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px', resize: 'none' }}
                    placeholder={`Notes for ${garment.garmentType || 'this item'}...`}
                  />
                </div>
              </div>
            ))}

            <button 
              onClick={addGarmentToSpec}
              style={{ 
                width: '100%', 
                padding: '14px', 
                backgroundColor: 'var(--surface-color)', 
                border: '2px dashed var(--border-color)', 
                borderRadius: '16px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                fontWeight: '700', 
                fontSize: '14px',
                color: 'var(--text-color)',
                marginBottom: '24px'
              }}
            >
              <Plus size={18} /> Add Another Garment to Order
            </button>
          </div>
        </div>
      );
    }

    if (activeTab === 'admin') {
      return renderAdminPanelScreen();
    }

    if (activeTab === 'inventory') {
      return renderInventoryScreen();
    }

    if (activeTab === 'tracker') {
      return renderPublicTrackingScreen();
    }

    if (activeTab === 'clients') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setShowSettingsModal(true)} title="Edit Studio settings">
              {studioLogo ? (
                <img src={studioLogo} alt="Studio Brand Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
              ) : (
                <img src={defaultLogoImg} alt="Tailor Pro Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
              )}
              <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', margin: 0 }}>TAILOR PRO ⚙️</h1>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setTailorLock(true)} className="save-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={14} /> TAILOR
              </button>
              {viewMode === 'mobile' && (
                <button onClick={handleLogout} className="save-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}>
                  <LogOut size={12} /> LogOut
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '12px', margin: '10px 0', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={14} style={{ color: supabaseConnected ? '#059669' : '#DC2626' }} />
              <span style={{ fontWeight: 600 }}>
                {supabaseConnected ? 'Supabase Connected 🟢' : 'Offline sandbox mode 🔴'}
              </span>
            </div>
            <button 
              onClick={syncOfflineData} 
              disabled={dbSyncing} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-color)', fontWeight: 'bold' }}
            >
              <RefreshCw size={12} className={dbSyncing ? 'animate-spin' : ''} /> {dbSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>

          <div className="search-bar-container">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input" 
              placeholder="Search clients, active orders..." 
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Active Consultations</h2>
            <div className="swiper-container">
              {clients.map(client => (
                <div key={client.id} onClick={() => startTape(client)} className="consultation-card">
                  <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{client.name.split(' ')[0]}</span>
                  <span className="text-body" style={{ fontSize: '12px' }}>{client.garmentType}</span>
                  <div className="badge">
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: client.status === 'Active' ? '#10B981' : client.status === 'In-Sewing' ? '#F59E0B' : '#EF4444'
                    }}></span>
                    <span>{client.status}</span>
                  </div>
                </div>
              ))}
              {clients.length === 0 && (
                <div style={{ padding: '20px', fontSize: '12px', color: 'var(--secondary-color)', textAlign: 'center', width: '100%' }}>
                  No active consultations. Add a client using the button below.
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Client Directory ({studioName})</h2>
            <div className="client-list">
              {filteredClients.map(client => (
                <div 
                  key={client.id} 
                  className="client-row" 
                  onClick={() => setExpandedClientId(expandedClientId === client.id ? null : client.id)}
                  style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="client-avatar">
                        {client.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="client-info">
                        <h3 style={{ fontSize: '14px' }}>{client.name}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--secondary-color)' }}>Last Measured: {client.lastMeasured}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => startTape(client)} style={{ border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '12px', fontSize: '12px', cursor: 'pointer', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontWeight: 'bold' }}>Tape</button>
                      <button onClick={() => startSpec(client)} style={{ border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '12px', fontSize: '12px', cursor: 'pointer', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontWeight: 'bold' }}>Spec</button>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuClientId(activeMenuClientId === client.id ? null : client.id);
                        }} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: 'var(--secondary-color)' }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuClientId === client.id && (
                        <div style={{ 
                          position: 'absolute', 
                          right: 0, 
                          top: '32px', 
                          backgroundColor: 'var(--surface-color)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '12px', 
                          padding: '6px', 
                          zIndex: 100, 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          minWidth: '95px'
                        }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(client);
                            }} 
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: 'var(--text-color)', 
                              fontSize: '12px', 
                              padding: '6px 8px', 
                              textAlign: 'left', 
                              cursor: 'pointer', 
                              borderRadius: '8px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              fontWeight: 600
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClient(client.id);
                            }} 
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: '#DC2626', 
                              fontSize: '12px', 
                              padding: '6px 8px', 
                              textAlign: 'left', 
                              cursor: 'pointer', 
                              borderRadius: '8px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              fontWeight: 600
                            }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {expandedClientId === client.id && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                      {/* Current active measurements */}
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-color)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>📐 Current Active Measurements</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                          {Object.entries(client.measurements || {}).map(([key, val]) => {
                            if (key.startsWith('_')) return null;
                            return (
                              <div key={key} style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '10px', color: 'var(--secondary-color)', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                                <strong style={{ fontSize: '13px', color: 'var(--text-color)', fontFamily: 'monospace' }}>{val || '0.0'} in</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Measurement History timeline */}
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-color)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>📜 Fitting History & Timeline</span>
                        
                        {(!client.measurements?._history || client.measurements._history.length === 0) ? (
                          <div style={{ fontSize: '11px', color: 'var(--secondary-color)', padding: '6px', fontStyle: 'italic' }}>
                            No previous records found. New logs are saved automatically when you complete a tape session.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                            {client.measurements._history.map((hist, histIdx) => (
                              <div key={histIdx} style={{ backgroundColor: 'var(--bg-color)', border: '1px dashed var(--border-color)', borderRadius: '10px', padding: '8px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--secondary-color)', fontWeight: 'bold' }}>📅 Recorded: {hist.date}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
                                  {Object.entries(hist.measurements || {}).map(([mKey, mVal]) => {
                                    if (mKey.startsWith('_')) return null;
                                    return (
                                      <span key={mKey} style={{ fontSize: '10px', color: 'var(--text-color)' }}>
                                        <span style={{ textTransform: 'capitalize', color: 'var(--secondary-color)' }}>{mKey.replace('_', ' ')}:</span> <strong>{mVal} in</strong>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredClients.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--secondary-color)', fontSize: '13px' }}>
                  No clients registered yet.
                </div>
              )}
            </div>
          </div>

          <button onClick={() => setShowNewConsultModal(true)} className="floating-action-button">
            <Plus size={18} /> New Consult
          </button>
        </div>
      );
    }

    if (activeTab === 'runway') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h1 style={{ fontFamily: 'var(--font-brand)' }}>RUNWAY</h1>
            <button onClick={() => setTailorLock(true)} className="save-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} /> TAILOR
            </button>
          </div>

          <div className="kanban-columns">
            {['Cutting', 'Sewing', 'Fitting', 'Ready'].map(stage => {
              const stageOrders = clients.filter(c => c.stage === stage);
              return (
                <div key={stage} className="kanban-column">
                  <div className="kanban-header">{stage}</div>
                  {stageOrders.length === 0 ? (
                    <div style={{ fontSize: '11px', textAlign: 'center', color: 'var(--secondary-color)', padding: '20px 0', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>Empty</div>
                  ) : (
                    stageOrders.map(order => (
                      <div key={order.id} className="kanban-card">
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{order.name.split(' ')[0]} M.</span>
                        <span style={{ fontSize: '11px', color: 'var(--secondary-color)' }}>{order.garmentType}</span>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                          {stage !== 'Cutting' && (
                            <button 
                              onClick={() => {
                                const prevStages = ['Cutting', 'Sewing', 'Fitting', 'Ready'];
                                const currIdx = prevStages.indexOf(stage);
                                moveOrderStage(order.id, prevStages[currIdx - 1]);
                              }}
                              style={{ padding: '2px 4px', fontSize: '10px', border: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
                            >
                              ◀
                            </button>
                          )}
                          {stage !== 'Ready' && (
                            <button 
                              onClick={() => {
                                const nextStages = ['Cutting', 'Sewing', 'Fitting', 'Ready'];
                                const currIdx = nextStages.indexOf(stage);
                                moveOrderStage(order.id, nextStages[currIdx + 1]);
                              }}
                              style={{ padding: '2px 4px', fontSize: '10px', border: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', flex: 1 }}
                            >
                              Next Stage ▶
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === 'ledger') {
      const totalBillingSum = clients.reduce((acc, c) => acc + Number(c.totalBilling || 0), 0);
      const totalReceivedSum = clients.reduce((acc, c) => acc + Number(c.paidDeposit || 0), 0);
      const totalBalanceDueSum = totalBillingSum - totalReceivedSum;
      const completedJobsCount = clients.filter(c => c.stage === 'Delivered' || (c.totalBilling > 0 && c.totalBilling === c.paidDeposit)).length;
      const collectionRate = totalBillingSum > 0 ? Math.round((totalReceivedSum / totalBillingSum) * 100) : 0;

      // Calculate garment stats
      const garmentCounts = {};
      clients.forEach(c => {
        const items = (c.garmentsList && c.garmentsList.length > 0) ? c.garmentsList : [{ garmentType: c.garmentType || 'General Sewing' }];
        items.forEach(item => {
          const gType = item.garmentType || 'General Sewing';
          garmentCounts[gType] = (garmentCounts[gType] || 0) + 1;
        });
      });
      const totalGarmentItems = Object.values(garmentCounts).reduce((a, b) => a + b, 0) || 1;
      const sortedGarments = Object.entries(garmentCounts).sort((a, b) => b[1] - a[1]);

      // Calculate stage counts
      const stageCounts = { Consult: 0, Cutting: 0, Fitting: 0, Delivered: 0 };
      clients.forEach(c => {
        const st = c.stage || 'Consult';
        stageCounts[st] = (stageCounts[st] || 0) + 1;
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h1 style={{ fontFamily: 'var(--font-brand)', margin: 0 }}>FINANCIAL ANALYTICS</h1>
            
            {/* Sub-tab Pill Switcher */}
            <div style={{ display: 'flex', backgroundColor: 'var(--surface-color)', padding: '3px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setLedgerSubTab('analytics')}
                style={{ 
                  padding: '5px 12px', 
                  borderRadius: '9px', 
                  border: 'none', 
                  backgroundColor: ledgerSubTab === 'analytics' ? 'var(--text-color)' : 'transparent', 
                  color: ledgerSubTab === 'analytics' ? 'var(--bg-color)' : 'var(--secondary-color)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <BarChart3 size={12} /> Revenue Dashboard
              </button>
              <button 
                onClick={() => setLedgerSubTab('ledger')}
                style={{ 
                  padding: '5px 12px', 
                  borderRadius: '9px', 
                  border: 'none', 
                  backgroundColor: ledgerSubTab === 'ledger' ? 'var(--text-color)' : 'transparent', 
                  color: ledgerSubTab === 'ledger' ? 'var(--bg-color)' : 'var(--secondary-color)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <FileText size={12} /> Client Ledger
              </button>
            </div>
          </div>

          {ledgerSubTab === 'analytics' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              
              {/* 4 Financial Metric Cards */}
              <div className="ledger-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div className="ledger-metric-card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--secondary-color)', fontWeight: 700 }}>Gross Revenue</span>
                    <TrendingUp size={14} style={{ color: 'var(--secondary-color)' }} />
                  </div>
                  <span className="text-mono" style={{ fontSize: '16px', fontWeight: 'bold' }}>GHS {totalBillingSum.toLocaleString()}</span>
                </div>

                <div className="ledger-metric-card" style={{ padding: '12px', borderLeft: '3px solid #047857' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#047857', fontWeight: 700 }}>Cash Received</span>
                    <CheckCircle2 size={14} style={{ color: '#047857' }} />
                  </div>
                  <span className="text-mono" style={{ fontSize: '16px', fontWeight: 'bold', color: '#047857' }}>GHS {totalReceivedSum.toLocaleString()}</span>
                </div>

                <div className="ledger-metric-card due" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#B45309', fontWeight: 700 }}>Outstanding</span>
                    <Info size={14} style={{ color: '#B45309' }} />
                  </div>
                  <span className="text-mono" style={{ fontSize: '16px', fontWeight: 'bold', color: '#B45309' }}>GHS {totalBalanceDueSum.toLocaleString()}</span>
                </div>

                <div className="ledger-metric-card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--secondary-color)', fontWeight: 700 }}>Jobs Completed</span>
                    <PieChart size={14} style={{ color: 'var(--secondary-color)' }} />
                  </div>
                  <span className="text-mono" style={{ fontSize: '16px', fontWeight: 'bold' }}>{completedJobsCount} / {clients.length}</span>
                </div>
              </div>

              {/* Payment Collection Progress Card */}
              <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--secondary-color)' }}>
                    Payment Collection Rate
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: collectionRate >= 80 ? '#047857' : '#B45309' }}>
                    {collectionRate}% Collected
                  </span>
                </div>
                <div style={{ width: '100%', backgroundColor: 'var(--bg-color)', height: '10px', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: `${collectionRate}%`, backgroundColor: collectionRate >= 80 ? '#047857' : '#B45309', height: '100%', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Top Garment Analytics */}
              <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--secondary-color)', display: 'block', marginBottom: '12px' }}>
                  Top Garment Demand Breakdown
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedGarments.map(([gName, count]) => {
                    const pct = Math.round((count / totalGarmentItems) * 100);
                    return (
                      <div key={gName}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '600' }}>{gName}</span>
                          <span style={{ color: 'var(--secondary-color)' }}>{count} orders ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', backgroundColor: 'var(--bg-color)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, backgroundColor: 'var(--text-color)', height: '100%' }} />
                        </div>
                      </div>
                    );
                  })}
                  {sortedGarments.length === 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--secondary-color)' }}>No garments recorded yet.</span>
                  )}
                </div>
              </div>

              {/* Production Runway Stage Distribution */}
              <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--secondary-color)', display: 'block', marginBottom: '12px' }}>
                  Workshop Runway Pipeline Stages
                </span>
                <div style={{ gridTemplateColumns: 'repeat(4, 1fr)', display: 'grid', gap: '8px', textAlign: 'center' }}>
                  {Object.entries(stageCounts).map(([stName, stCount]) => (
                    <div key={stName} style={{ backgroundColor: 'var(--bg-color)', padding: '10px 6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', display: 'block', color: 'var(--text-color)' }}>{stCount}</span>
                      <span style={{ fontSize: '10px', color: 'var(--secondary-color)', textTransform: 'uppercase', fontWeight: 600 }}>{stName}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              <div className="ledger-list">
                {clients.map(client => {
                  const isBalanced = client.totalBilling === client.paidDeposit;
                  const outstanding = client.totalBilling - client.paidDeposit;
                  
                  const whatsappMsg = `Hello ${client.name}, this is a status & billing update from ${studioName}. Garment: ${client.garmentType}. Total cost: GHS ${client.totalBilling}, Paid deposit: GHS ${client.paidDeposit}. Outstanding balance: GHS ${outstanding}. Stage: ${client.stage}. Thank you!`;
                  
                  const handleWhatsAppClick = () => {
                    if (!client.phone) {
                      alert("Please add a phone number for this client first.");
                      return;
                    }
                    const sanitizedPhone = client.phone.replace(/[^0-9+]/g, '');
                    const waUrl = `https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=${encodeURIComponent(whatsappMsg)}`;
                    window.open(waUrl, '_blank');
                  };

                  return (
                    <div key={client.id} className="ledger-item" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{client.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--secondary-color)' }}>{client.garmentType}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span>Total: GHS {client.totalBilling}</span>
                        <span>Paid Deposit: GHS {client.paidDeposit}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isBalanced ? '#047857' : '#B45309' }}>
                          {isBalanced ? '🟢 PAID IN FULL' : `🔴 DUE: GHS ${outstanding}`}
                        </span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => { setInvoiceClient(client); setShowInvoiceModal(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            <Printer size={12} /> Print Invoice
                          </button>
                          
                          {!isBalanced && (
                            <button 
                              onClick={() => markJobPaidAndCompleted(client)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', backgroundColor: 'var(--text-color)', color: 'var(--bg-color)', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              <Check size={12} /> Mark Paid
                            </button>
                          )}

                          <button 
                            onClick={() => sendSmartWhatsAppMessage(client, 'fitting')}
                            title="Send Fitting Reminder"
                            style={{ padding: '6px 8px', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            ✂️ Fitting
                          </button>
                          <button 
                            onClick={() => sendSmartWhatsAppMessage(client, 'pickup')}
                            title="Send Pickup Alert"
                            style={{ padding: '6px 8px', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            🛍️ Pickup
                          </button>
                          <button 
                            onClick={() => sendSmartWhatsAppMessage(client, 'billing')}
                            title="Send Billing Reminder"
                            style={{ padding: '6px 8px', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            💳 Bill
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {clients.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--secondary-color)', fontSize: '13px' }}>
                    No transaction accounts.
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={14} /> Supabase Schema Installer
                  </span>
                  <button 
                    onClick={copySqlSchemaToClipboard} 
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <Copy size={12} /> {copiedSchema ? 'Copied!' : 'Copy SQL'}
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--secondary-color)', marginBottom: '8px', lineHeight: '1.4' }}>
                  Run this SQL in your Supabase Editor to setup the table structure.
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }
  };

  const getScreenContent = () => {
    switch (authStatus) {
      case 'splash':
        return renderSplashScreen();
      case 'login':
        return renderLoginScreen();
      case 'signup':
        return renderSignUpScreen();
      case 'client_tracker':
        return renderPublicTrackingScreen();
      case 'pending_approval':
        return renderPendingApprovalScreen();
      case 'account_blocked':
        return renderAccountBlockedScreen();
      case 'authenticated':
      default:
        return renderAuthenticatedView();
    }
  };

  const isAuthPage = authStatus !== 'authenticated';

  return (
    <div className={`app-host-container ${viewMode === 'desktop' ? 'desktop-mode' : ''}`}>
      
      {viewMode === 'mobile' && !tailorLock && (
        <div className="view-mode-header" style={{ marginBottom: '8px', zIndex: 10 }}>
          <button onClick={() => setViewMode('desktop')} className="view-mode-btn">
            <Monitor size={12} /> Desktop View
          </button>
          <button onClick={() => setViewMode('mobile')} className="view-mode-btn active">
            <Smartphone size={12} /> Mobile View
          </button>
        </div>
      )}

      {/* CASE A: MOBILE VIEW MOCKUP FRAME */}
      {viewMode === 'mobile' && (
        <div className="device-container" style={isAuthPage ? { height: '800px' } : {}}>
          <div className="device-screen">
            
            <div className="status-bar">
              <span style={{ fontFamily: 'var(--font-brand)' }}>9:41 AM</span>
              <span style={{ letterSpacing: '0.5px', fontWeight: 'bold' }}>TAILOR PRO</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>100%</span>
                <Smartphone size={14} />
              </div>
            </div>

            {tailorLock && authStatus === 'authenticated' && (
              <div className="tailor-lock-overlay">
                <div className="lock-screen-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={18} />
                    <span style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: '18px' }}>TAILOR WORKSHOP</span>
                  </div>
                  {userRole !== 'tailor' && (
                    <button onClick={() => setShowPinUnlockPrompt(true)} className="save-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Unlock size={12} /> Unlock
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ padding: '12px 14px', backgroundColor: 'var(--surface-color)', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={16} />
                    <span>Safety Active. Telephone details hidden.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {clients.map(client => (
                      <div key={client.id} style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', backgroundColor: 'var(--surface-color)' }}>
                        <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>{client.name.charAt(0)}. {client.name.split(' ')[1] || ''}</h3>
                        <div className="lock-grid">
                          {((client.measurements?._category || 'male') === 'female' ? femaleFields : maleFields).map(field => (
                            <div key={field.key} className="lock-stat-card">
                              <span className="lock-stat-label">{field.label}</span>
                              <span className="lock-stat-val text-mono">{client.measurements?.[field.key] || '0.0'} in</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {showPinUnlockPrompt && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--bg-color)', zIndex: 110, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <Lock size={32} style={{ color: 'var(--text-color)', marginBottom: '12px' }} />
                      <h2>Enter Security PIN</h2>
                      <p className="text-body" style={{ marginTop: '4px' }}>Enter PIN to exit</p>
                    </div>
                    <div className="lock-pin-prompt">
                      <div className="pin-display">
                        {[0,1,2,3].map(i => <div key={i} className={`pin-dot ${pinInput.length > i ? 'filled' : ''}`}></div>)}
                      </div>
                      {pinError && <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: 600 }}>Incorrect PIN.</span>}
                      <div className="numpad-container">
                        {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={() => handlePinKeyPress(num.toString())} className="numpad-button">{num}</button>)}
                        <button onClick={() => { setPinInput(''); setPinError(false); setShowPinUnlockPrompt(false); }} className="numpad-button numpad-action">Cancel</button>
                        <button onClick={() => handlePinKeyPress('0')} className="numpad-button">0</button>
                        <button onClick={() => setPinInput(pinInput.slice(0, -1))} className="numpad-button numpad-action">⌫</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="screen-content" style={{ flex: 1, overflowY: 'auto' }}>
              {getScreenContent()}
            </div>

            {!isAuthPage && (
              <div className="bottom-nav">
                <button className={`nav-tab ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => { setActiveTab('clients'); setCurrentScreen('dashboard'); }}>
                  <Users size={22} />
                  <span>Clients</span>
                </button>
                <button className={`nav-tab ${activeTab === 'runway' ? 'active' : ''}`} onClick={() => { setActiveTab('runway'); setCurrentScreen('dashboard'); }}>
                  <Layers size={22} />
                  <span>Runway</span>
                </button>
                {userRole === 'owner' && (
                  <>
                    <button className={`nav-tab ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => { setActiveTab('ledger'); setCurrentScreen('dashboard'); }}>
                      <FileText size={22} />
                      <span>Ledger</span>
                    </button>
                    <button className={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => { setActiveTab('inventory'); setCurrentScreen('dashboard'); syncInventoryFromSupabase(); }}>
                      <Package size={22} />
                      <span>Inventory</span>
                    </button>
                  </>
                )}
                {(userRole === 'super_admin' || loginEmail === 'admin@tailorpro.com') && (
                  <button className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => { setActiveTab('admin'); setCurrentScreen('dashboard'); fetchAdminData(); }}>
                    <Shield size={22} style={{ color: '#059669' }} />
                    <span>Admin</span>
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* CASE B: RESPONSIVE DESKTOP WORKSPACE */}
      {viewMode === 'desktop' && (
        <div className="desktop-container">
          
          <div className="desktop-sidebar">
            <div className="desktop-nav-links">
              <div 
                onClick={() => !isAuthPage && setShowSettingsModal(true)}
                style={{ 
                  padding: '0 8px 20px 8px', 
                  borderBottom: '1px solid var(--border-color)', 
                  marginBottom: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  cursor: !isAuthPage ? 'pointer' : 'default'
                }}
                title={!isAuthPage ? "Edit Studio settings" : ""}
              >
                {studioLogo ? (
                  <img src={studioLogo} alt="Studio Brand Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                ) : (
                  <img src={defaultLogoImg} alt="Tailor Pro Logo" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
                )}
                <div>
                  <span style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 800, display: 'block' }}>TAILOR PRO</span>
                  {!isAuthPage && <span style={{ fontSize: '9px', color: 'var(--secondary-color)', display: 'block' }}>⚙️ Studio settings</span>}
                </div>
              </div>
              
              {!isAuthPage ? (
                <>
                  <button onClick={() => { setActiveTab('clients'); setCurrentScreen('dashboard'); }} className={`sidebar-tab ${activeTab === 'clients' ? 'active' : ''}`}>
                    <Users size={18} />
                    <span>Client Database</span>
                  </button>
                  <button onClick={() => { setActiveTab('runway'); setCurrentScreen('dashboard'); }} className={`sidebar-tab ${activeTab === 'runway' ? 'active' : ''}`}>
                    <Layers size={18} />
                    <span>Runway Pipeline</span>
                  </button>
                  {userRole === 'owner' && (
                    <>
                      <button onClick={() => { setActiveTab('ledger'); setCurrentScreen('dashboard'); }} className={`sidebar-tab ${activeTab === 'ledger' ? 'active' : ''}`}>
                        <FileText size={18} />
                        <span>Ledger & Billing</span>
                      </button>
                      <button onClick={() => { setActiveTab('inventory'); setCurrentScreen('dashboard'); syncInventoryFromSupabase(); }} className={`sidebar-tab ${activeTab === 'inventory' ? 'active' : ''}`}>
                        <Package size={18} />
                        <span>Fabric Inventory</span>
                      </button>
                    </>
                  )}
                  {(userRole === 'super_admin' || loginEmail === 'admin@tailorpro.com') && (
                    <button onClick={() => { setActiveTab('admin'); setCurrentScreen('dashboard'); fetchAdminData(); }} className={`sidebar-tab ${activeTab === 'admin' ? 'active' : ''}`} style={{ color: '#059669', fontWeight: 'bold' }}>
                      <Shield size={18} />
                      <span>Super Admin Panel</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => setAuthStatus('login')} className={`sidebar-tab ${authStatus === 'login' ? 'active' : ''}`}>
                    <Users size={18} />
                    <span>Studio Login</span>
                  </button>
                  <button onClick={() => setAuthStatus('signup')} className={`sidebar-tab ${authStatus === 'signup' ? 'active' : ''}`}>
                    <Plus size={18} />
                    <span>Register Studio</span>
                  </button>
                </>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!isAuthPage && (
                <button onClick={() => setTailorLock(true)} className="primary-action-btn" style={{ fontSize: '13px', padding: '10px' }}>
                  <Lock size={14} /> Enter Tailor Mode
                </button>
              )}

              <div className="view-mode-header" style={{ alignSelf: 'center', width: '100%' }}>
                <button onClick={() => setViewMode('desktop')} className={`view-mode-btn ${viewMode === 'desktop' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
                  <Monitor size={12} /> Desktop
                </button>
                <button onClick={() => setViewMode('mobile')} className={`view-mode-btn ${viewMode === 'mobile' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}>
                  <Smartphone size={12} /> Mobile
                </button>
              </div>

              {!isAuthPage && (
                <button onClick={handleLogout} className="sidebar-tab" style={{ padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <LogOut size={16} /> Logout Studio
                </button>
              )}
            </div>
          </div>

          <div className="desktop-content-area">
            {tailorLock && authStatus === 'authenticated' && (
              <div className="tailor-lock-overlay">
                <div className="lock-screen-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={22} />
                    <span style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: '22px' }}>TAILOR WORKSHOP VIEW</span>
                  </div>
                  {userRole !== 'tailor' && (
                    <button onClick={() => setShowPinUnlockPrompt(true)} className="save-btn" style={{ padding: '8px 16px', fontSize: '14px' }}>
                      <Unlock size={14} /> Unlock
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ padding: '12px 16px', backgroundColor: 'var(--surface-color)', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Info size={18} />
                    <span>Operational safety active. Client contact & details hidden.</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {clients.map(client => (
                      <div key={client.id} style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', backgroundColor: 'var(--surface-color)' }}>
                        <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>{client.name} ({client.garmentType})</h3>
                        <div className="lock-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                          {((client.measurements?._category || 'male') === 'female' ? femaleFields : maleFields).map(field => (
                            <div key={field.key} className="lock-stat-card">
                              <span className="lock-stat-label">{field.label}</span>
                              <span className="lock-stat-val text-mono">{client.measurements?.[field.key] || '0.0'} in</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {showPinUnlockPrompt && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--bg-color)', zIndex: 110, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <Lock size={48} style={{ color: 'var(--text-color)', marginBottom: '16px' }} />
                      <h2>Enter Security PIN</h2>
                      <p className="text-body">Enter PIN to exit</p>
                    </div>
                    <div className="lock-pin-prompt" style={{ width: '100%', maxWidth: '300px' }}>
                      <div className="pin-display">
                        {[0,1,2,3].map(i => <div key={i} className={`pin-dot ${pinInput.length > i ? 'filled' : ''}`}></div>)}
                      </div>
                      {pinError && <span style={{ color: '#DC2626', fontSize: '13px', fontWeight: 600 }}>Incorrect PIN.</span>}
                      <div className="numpad-container">
                        {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={() => handlePinKeyPress(num.toString())} className="numpad-button">{num}</button>)}
                        <button onClick={() => { setPinInput(''); setPinError(false); setShowPinUnlockPrompt(false); }} className="numpad-button numpad-action">Cancel</button>
                        <button onClick={() => handlePinKeyPress('0')} className="numpad-button">0</button>
                        <button onClick={() => setPinInput(pinInput.slice(0, -1))} className="numpad-button numpad-action">⌫</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="screen-content" style={{ flex: 1, overflowY: 'auto' }}>
              {getScreenContent()}
            </div>
          </div>
        </div>
      )}

      {/* NEW CONSULTATION MODAL */}
      {showNewConsultModal && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17, 17, 17, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 120 }}>
          <div style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '20px' }}>New Consultation</h2>
            <form onSubmit={handleCreateConsult} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="select-wrapper">
                <label>Client Name</label>
                <input type="text" required value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="select-input" placeholder="Akosua Mensah" />
              </div>
              <div className="select-wrapper">
                <label>Phone Number</label>
                <input type="tel" required value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} className="select-input" placeholder="+233 24 412 3456" />
              </div>
              <div className="select-wrapper">
                <label>Garment Type</label>
                <input 
                  type="text" 
                  list="consult-garments-list" 
                  className="select-input" 
                  value={newClientGarment} 
                  onChange={(e) => setNewClientGarment(e.target.value)} 
                  placeholder="Kente Gown, Kaftan, Suit..." 
                  required 
                />
                <datalist id="consult-garments-list">
                  <option value="Kente Gown" />
                  <option value="3-Piece Suit" />
                  <option value="Kaftan" />
                </datalist>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="select-wrapper">
                  <label>Total Billing (GHS)</label>
                  <input 
                    type="number" 
                    className="select-input" 
                    value={newClientTotalBilling} 
                    onChange={(e) => setNewClientTotalBilling(e.target.value)} 
                    placeholder="0" 
                    min="0"
                  />
                </div>
                <div className="select-wrapper">
                  <label>Paid Deposit (GHS)</label>
                  <input 
                    type="number" 
                    className="select-input" 
                    value={newClientPaidDeposit} 
                    onChange={(e) => setNewClientPaidDeposit(e.target.value)} 
                    placeholder="0" 
                    min="0"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowNewConsultModal(false)} className="numpad-button numpad-action" style={{ flex: 1, height: '40px' }}>Cancel</button>
                <button type="submit" className="save-btn" style={{ flex: 1, height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Start Tape</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CONSULTATION MODAL */}
      {showEditClientModal && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17, 17, 17, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 120 }}>
          <div style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '20px' }}>Edit Client Details</h2>
            <form onSubmit={handleEditClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="select-wrapper">
                <label>Client Name</label>
                <input type="text" required value={editClientName} onChange={(e) => setEditClientName(e.target.value)} className="select-input" placeholder="Akosua Mensah" />
              </div>
              <div className="select-wrapper">
                <label>Phone Number</label>
                <input type="tel" required value={editClientPhone} onChange={(e) => setEditClientPhone(e.target.value)} className="select-input" placeholder="+233 24 412 3456" />
              </div>
              <div className="select-wrapper">
                <label>Garment Type</label>
                <input 
                  type="text" 
                  list="edit-consult-garments-list" 
                  className="select-input" 
                  value={editClientGarment} 
                  onChange={(e) => setEditClientGarment(e.target.value)} 
                  placeholder="Kente Gown, Kaftan, Suit..." 
                  required 
                />
                <datalist id="edit-consult-garments-list">
                  <option value="Kente Gown" />
                  <option value="3-Piece Suit" />
                  <option value="Kaftan" />
                </datalist>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="select-wrapper">
                  <label>Total Billing (GHS)</label>
                  <input 
                    type="number" 
                    className="select-input" 
                    value={editClientTotalBilling} 
                    onChange={(e) => setEditClientTotalBilling(e.target.value)} 
                    placeholder="0" 
                    min="0"
                  />
                </div>
                <div className="select-wrapper">
                  <label>Paid Deposit (GHS)</label>
                  <input 
                    type="number" 
                    className="select-input" 
                    value={editClientPaidDeposit} 
                    onChange={(e) => setEditClientPaidDeposit(e.target.value)} 
                    placeholder="0" 
                    min="0"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => { setShowEditClientModal(false); setEditingClient(null); }} className="numpad-button numpad-action" style={{ flex: 1, height: '40px' }}>Cancel</button>
                <button type="submit" className="save-btn" style={{ flex: 1, height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDIO SETTINGS MODAL */}
      {showSettingsModal && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17, 17, 17, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 120 }}>
          <div style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '90%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px' }}>Studio Brand Settings</h2>
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Preview Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
              ) : studioLogo ? (
                <img src={studioLogo} alt="Studio Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
              ) : null}
            </div>
            <form onSubmit={handleUpdateStudioProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="select-wrapper">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>App Theme (Appearance)</span>
                  <span style={{ fontSize: '11px', color: 'var(--secondary-color)', textTransform: 'uppercase', fontWeight: 'bold' }}>{theme} mode</span>
                </label>
                <div className="theme-selector-container">
                  <div
                    className={`theme-card-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <div className="theme-icon-wrapper">
                      <Sun size={20} />
                    </div>
                    <span className="theme-label">Light (Day)</span>
                    <span className="theme-status-indicator">{theme === 'light' ? '✓ Active' : 'Select'}</span>
                  </div>
                  <div
                    className={`theme-card-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <div className="theme-icon-wrapper">
                      <Moon size={20} />
                    </div>
                    <span className="theme-label">Dark (Night)</span>
                    <span className="theme-status-indicator">{theme === 'dark' ? '✓ Active' : 'Select'}</span>
                  </div>
                </div>
              </div>

              <div className="select-wrapper">
                <label>Studio / Brand Name</label>
                <input type="text" required value={studioName} onChange={(e) => setStudioName(e.target.value)} className="select-input" placeholder="Classic Stitches Studio" />
              </div>

              {/* Brand Logo Picker Input */}
              <div className="select-wrapper">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Brand Logo (Image)</span>
                  {tempLogoFile && <span style={{ color: '#059669', fontSize: '10px' }}>Selected</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--surface-color)', border: '1px dashed var(--border-color)', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  <Upload size={16} /> {tempLogoFile ? 'Change Brand Logo' : 'Upload new logo file'}
                  <input type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="select-wrapper">
                <label>Designer Mobile Money (MoMo) Number</label>
                <input type="text" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} className="select-input" placeholder="e.g. 0546920418" />
              </div>

              <div className="select-wrapper">
                <label>MoMo Account Holder Name</label>
                <input type="text" value={momoName} onChange={(e) => setMomoName(e.target.value)} className="select-input" placeholder="e.g. Mubarik Tuahir Ali" />
              </div>

              <div className="select-wrapper">
                <label>Workshop Safety PIN (4-Digits)</label>
                <input type="text" maxLength={4} required value={workshopLockPin} onChange={(e) => setWorkshopLockPin(e.target.value.replace(/\D/g,''))} className="select-input" placeholder="1234" />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => { setShowSettingsModal(false); setTempLogoFile(null); setLogoPreviewUrl(''); }} className="numpad-button numpad-action" style={{ flex: 1, height: '40px' }}>Cancel</button>
                <button type="submit" disabled={isUploadingLogo || dbSyncing} className="save-btn" style={{ flex: 1, height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {isUploadingLogo ? 'Uploading Logo...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW MATERIAL INVENTORY MODAL */}
      {showInventoryModal && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17, 17, 17, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 120 }}>
          <div style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '20px', margin: 0 }}>Add New Material to Inventory</h2>
            <form onSubmit={handleAddInventoryItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="select-wrapper">
                <label>Item / Material Name</label>
                <input type="text" required value={invName} onChange={(e) => setInvName(e.target.value)} className="select-input" placeholder="e.g. Italian Wool, Silk Lining..." />
              </div>
              <div className="select-wrapper">
                <label>Category</label>
                <select value={invCategory} onChange={(e) => setInvCategory(e.target.value)} className="select-input">
                  <option value="Fabric">Fabric</option>
                  <option value="Lining">Lining</option>
                  <option value="Zipper">Zipper</option>
                  <option value="Button">Button</option>
                  <option value="Trim">Trim / Lace</option>
                  <option value="Threads">Threads</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="select-wrapper">
                  <label>Quantity</label>
                  <input type="number" required value={invQty} onChange={(e) => setInvQty(e.target.value)} className="select-input" placeholder="0" min="0" />
                </div>
                <div className="select-wrapper">
                  <label>Unit</label>
                  <select value={invUnit} onChange={(e) => setInvUnit(e.target.value)} className="select-input">
                    <option value="Yards">Yards</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Meters">Meters</option>
                    <option value="Rolls">Rolls</option>
                  </select>
                </div>
              </div>
              <div className="select-wrapper">
                <label>Low-Stock Alert Threshold</label>
                <input type="number" value={invThreshold} onChange={(e) => setInvThreshold(e.target.value)} className="select-input" placeholder="5" min="1" />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowInventoryModal(false)} className="numpad-button numpad-action" style={{ flex: 1, height: '40px' }}>Cancel</button>
                <button type="submit" className="save-btn" style={{ flex: 1, height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Add Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICE & RECEIPT MODAL */}
      {showInvoiceModal && renderInvoiceModal()}

    </div>
  );
}
