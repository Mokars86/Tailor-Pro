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
  Upload
} from 'lucide-react';
import defaultLogoImg from './assets/logo.png';
import { supabase } from './supabaseClient';

const logoImg = defaultLogoImg;
const INITIAL_CLIENTS = [];

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

-- Enable RLS on clients
alter table public.clients enable row level security;

-- Create access policies for clients
create policy "Users can manage their own clients" 
  on public.clients for all 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- 2. Setup Storage policies for 'Tailorpro' bucket
-- (Make sure you have created a public bucket named 'Tailorpro' in your Supabase Storage dashboard)

create policy "Public read access" 
  on storage.objects for select 
  using (bucket_id = 'Tailorpro');

create policy "Authenticated upload access" 
  on storage.objects for insert 
  to authenticated 
  with check (bucket_id = 'Tailorpro');

create policy "Authenticated update access" 
  on storage.objects for update 
  to authenticated 
  using (bucket_id = 'Tailorpro');

create policy "Authenticated delete access" 
  on storage.objects for delete 
  to authenticated 
  using (bucket_id = 'Tailorpro');
`;

export default function App() {
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [activeTab, setActiveTab] = useState('clients');
  const [searchQuery, setSearchQuery] = useState('');
  
  // App authentication & Supabase status
  const [authStatus, setAuthStatus] = useState('splash'); // splash, login, signup, authenticated
  const [studioName, setStudioName] = useState('Classic Stitches Studio');
  const [studioLogo, setStudioLogo] = useState(''); // Holds brand logo URL uploaded by designer
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
  const [autoNext, setAutoNext] = useState(true);
  const autoNextTimeoutRef = useRef(null);

  const [tailorLock, setTailorLock] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPinUnlockPrompt, setShowPinUnlockPrompt] = useState(false);

  const [selectedGarment, setSelectedGarment] = useState('Kente Gown');
  const [selectedBoltWidth, setSelectedBoltWidth] = useState('60 Inches');
  const [patternNotes, setPatternNotes] = useState('');
  const [snappedFabric, setSnappedFabric] = useState(null);
  const [isSnapping, setIsSnapping] = useState(false);

  const [showNewConsultModal, setShowNewConsultModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientGarment, setNewClientGarment] = useState('Kente Gown');
  const [newClientTotalBilling, setNewClientTotalBilling] = useState('');
  const [newClientPaidDeposit, setNewClientPaidDeposit] = useState('');

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

  // Set viewMode to mobile on mount if on physical device or small screen
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('mobile');
    }
  }, []);

  // Sync clients when authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      syncClientsFromSupabase();
    }
  }, [authStatus]);

  const checkSupabaseSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setAuthStatus('authenticated');
        setLoginEmail(session.user.email);
        setStudioName(session.user.user_metadata?.studio_name || 'Classic Stitches Studio');
        setStudioLogo(session.user.user_metadata?.studio_logo || '');
        setWorkshopLockPin(session.user.user_metadata?.lock_pin || '1234');
        const role = session.user.user_metadata?.role || 'owner';
        setUserRole(role);
        if (role === 'tailor') {
          setTailorLock(true);
        }
        setSupabaseConnected(true);
      } else {
        setAuthStatus('login');
      }
    } catch (err) {
      console.warn("Session check failed, falling back to login screen.", err.message);
      setAuthStatus('login');
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
      setDbError(err.message);
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

  const measurementFields = [
    { key: 'chest', label: 'Chest', segment: 'UPPER BODY' },
    { key: 'shoulder', label: 'Shoulder', segment: 'UPPER BODY' },
    { key: 'sleeve', label: 'Sleeve Length', segment: 'UPPER BODY' },
    { key: 'waist', label: 'Waist', segment: 'LOWER BODY' },
    { key: 'hips', label: 'Hips', segment: 'LOWER BODY' },
    { key: 'length', label: 'Full Length', segment: 'LOWER BODY' },
  ];

  const activeFieldDetails = measurementFields.find(f => f.key === activeField);

  const startTape = (client) => {
    setSelectedClient(client);
    setTapeMeasurements({ ...client.measurements });
    setActiveField('chest');
    setActiveSegment('UPPER BODY');
    setCurrentScreen('digital-tape');
  };

  const startSpec = (client) => {
    setSelectedClient(client);
    setSelectedGarment(client.garmentType);
    setSelectedBoltWidth(client.boltWidth || '60 Inches');
    setPatternNotes(client.notes || '');
    setSnappedFabric(client.fabricSwatchUrl || null);
    setCurrentScreen('order-spec');
  };

  const handleNumpadPress = (val) => {
    let currentVal = tapeMeasurements[activeField] || '';

    if (val === '⌫') {
      currentVal = currentVal.slice(0, -1);
    } else if (val === '.') {
      if (!currentVal.includes('.')) {
        currentVal += '.';
      }
    } else {
      if (currentVal.length < 5) {
        currentVal += val;
      }
    }

    const updated = { ...tapeMeasurements, [activeField]: currentVal };
    setTapeMeasurements(updated);

    if (autoNext && currentVal.length >= 2 && val !== '⌫') {
      if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = setTimeout(() => {
        advanceToNextField();
      }, 600);
    }
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
      const updatedClients = clients.map(c => {
        if (c.id === selectedClient.id) {
          return {
            ...c,
            measurements: { ...tapeMeasurements },
            lastMeasured: 'Just now'
          };
        }
        return c;
      });
      setClients(updatedClients);

      if (supabaseConnected && !selectedClient.id.toString().startsWith('local-')) {
        try {
          await supabase
            .from('clients')
            .update({
              measurements: tapeMeasurements,
              last_measured: 'Just now'
            })
            .eq('id', selectedClient.id);
        } catch (e) {
          console.warn("Failed syncing measurements to Supabase", e.message);
        }
      }
    }
    setCurrentScreen('dashboard');
  };

  const calculateRequiredYardage = () => {
    const bust = parseFloat(tapeMeasurements.chest || (selectedClient && selectedClient.measurements.chest) || 36);
    const len = parseFloat(tapeMeasurements.length || (selectedClient && selectedClient.measurements.length) || 58);
    const width = selectedBoltWidth === '60 Inches' ? 60 : selectedBoltWidth === '45 Inches' ? 45 : 36;

    let basePanels = width === 60 ? 2 : width === 45 ? 3 : 4;
    let computed = ((len + 6) * basePanels) / 36;
    if (bust > 40) computed += 0.5;
    
    return (Math.ceil(computed * 2) / 2).toFixed(1);
  };

  const confirmSpecOrder = async () => {
    if (selectedClient) {
      const updatedClients = clients.map(c => {
        if (c.id === selectedClient.id) {
          return {
            ...c,
            garmentType: selectedGarment,
            boltWidth: selectedBoltWidth,
            notes: patternNotes,
            fabricSwatchUrl: snappedFabric
          };
        }
        return c;
      });
      setClients(updatedClients);

      if (supabaseConnected && !selectedClient.id.toString().startsWith('local-')) {
        try {
          await supabase
            .from('clients')
            .update({
              garment_type: selectedGarment,
              bolt_width: selectedBoltWidth,
              notes: patternNotes,
              fabric_swatch_url: snappedFabric
            })
            .eq('id', selectedClient.id);
        } catch (e) {
          console.warn("Failed syncing specifications to Supabase", e.message);
        }
      }
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
    const updated = clients.map(c => {
      if (c.id === clientId) {
        return { ...c, stage: newStage };
      }
      return c;
    });
    setClients(updated);

    if (supabaseConnected && !clientId.toString().startsWith('local-')) {
      try {
        await supabase
          .from('clients')
          .update({ stage: newStage })
          .eq('id', clientId);
      } catch (e) {
        console.warn("Failed syncing runway stages to Supabase", e.message);
      }
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
        const dbEntry = {
          user_id: user?.id,
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
        setStudioName(data.user.user_metadata?.studio_name || 'Classic Stitches Studio');
        setStudioLogo(data.user.user_metadata?.studio_logo || '');
        setWorkshopLockPin(data.user.user_metadata?.lock_pin || '1234');
        const role = data.user.user_metadata?.role || 'owner';
        setUserRole(role);
        if (role === 'tailor') {
          setTailorLock(true);
        }
        setAuthStatus('authenticated');
        setSupabaseConnected(true);
      }
    } catch (err) {
      setDbError(err.message);
      if (loginEmail === 'guest@tailorpro.com') {
        setStudioName('Classic Guest Studio');
        setAuthStatus('authenticated');
      }
    } finally {
      setDbSyncing(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setDbSyncing(true);
    setDbError(null);
    
    try {
      // 1. Perform regular Supabase signUp first to authenticate the session
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: {
            studio_name: studioName,
            designer_name: signUpName,
            studio_logo: '', // Keep empty initially to avoid passing large base64 dataURLs in auth body
            lock_pin: workshopLockPin,
            role: signUpRole
          }
        }
      });

      if (error) throw error;

      let finalLogoUrl = logoPreviewUrl || '';

      // 2. Now that the user session is authenticated, upload the logo if selected
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

          // Update user metadata with the uploaded public storage logo URL
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
        setUserRole(signUpRole);
        if (signUpRole === 'tailor') {
          setTailorLock(true);
        }
        alert("Verification mail sent! Welcome to Tailor Pro.");
        setAuthStatus('authenticated');
        setSupabaseConnected(true);
      }
    } catch (err) {
      setDbError(err.message);
    } finally {
      setDbSyncing(false);
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
          lock_pin: workshopLockPin
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

      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--secondary-color)' }}>
        💡 Demo login: <strong>guest@tailorpro.com</strong> (pwd: any)
      </div>

      <div className="auth-footer-links">
        <button onClick={() => setAuthStatus('signup')} className="auth-link">
          Don't have a studio account? Register here
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

          <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'desktop' ? '1.5fr 1fr' : '1.2fr 1fr', gap: '16px', margin: '12px 0', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {measurementFields.map(field => {
                const isActive = activeField === field.key;
                return (
                  <div 
                    key={field.key} 
                    onClick={() => {
                      setActiveField(field.key);
                      setActiveSegment(field.segment);
                    }}
                    className={isActive ? 'active-input-card' : 'inactive-input-card'}
                    style={isActive && hapticTrigger ? { transform: 'scale(0.98)', border: '2px solid #111111' } : {}}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--text-color)' : 'var(--secondary-color)' }}>
                      {field.label}
                    </span>
                    <span className="text-mono" style={{ fontSize: isActive ? '20px' : '16px' }}>
                      {tapeMeasurements[field.key] ? `${tapeMeasurements[field.key]} in` : 'Tap to enter'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="croquis-box" style={{ height: '100%', minHeight: '260px' }}>
              <svg width="120" height="240" viewBox="0 0 120 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Head & Neck */}
                <path d="M60 22 C64 22 67 19 67 14 C67 9 64 6 60 6 C56 6 53 9 53 14 C53 19 56 22 60 22 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                <path d="M57 22 L57 28 C57 32 63 32 63 28 L63 22" stroke="var(--secondary-color)" strokeWidth="1.2" />
                
                {/* Torso & Arms */}
                <path d="M42 34 C46 32 54 30 60 30 C66 30 74 32 78 34 C82 36 84 41 84 45 L80 90 C79 93 76 95 73 95 L68 95 C66 98 64 105 65 110 C66 115 69 125 70 135 C68 138 65 140 60 140 C55 140 52 138 50 135 C51 125 54 115 55 110 C56 105 54 98 52 95 L47 95 C44 95 41 93 40 90 L36 45 C36 41 38 36 42 34 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                
                {/* Legs */}
                <path d="M50 135 L44 225 C43 228 46 230 49 230 L53 230 L57 160 L60 160 L63 160 L67 230 L71 230 C74 230 77 228 76 225 L70 135" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />

                {/* Guides */}
                {activeField === 'chest' && <line x1="42" y1="55" x2="78" y2="55" stroke="var(--text-color)" strokeWidth="3" strokeDasharray="3 2" />}
                {activeField === 'shoulder' && <line x1="40" y1="33" x2="80" y2="33" stroke="var(--text-color)" strokeWidth="3" strokeDasharray="3 2" />}
                {activeField === 'sleeve' && <path d="M78 34 L80 90" stroke="var(--text-color)" strokeWidth="3" strokeDasharray="3 2" />}
                {activeField === 'waist' && <line x1="48" y1="95" x2="72" y2="95" stroke="var(--text-color)" strokeWidth="3" strokeDasharray="3 2" />}
                {activeField === 'hips' && <line x1="50" y1="125" x2="70" y2="125" stroke="var(--text-color)" strokeWidth="3" strokeDasharray="3 2" />}
                {activeField === 'length' && <line x1="60" y1="30" x2="60" y2="225" stroke="var(--text-color)" strokeWidth="3" strokeDasharray="4 2" />}
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '8px', color: 'var(--text-color)', textTransform: 'uppercase' }}>
                {activeFieldDetails?.label}
              </span>
            </div>
          </div>

          <div className="numpad-container" style={{ marginTop: 'auto' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => handleNumpadPress(num.toString())} className="numpad-button">{num}</button>
            ))}
            <button onClick={() => handleNumpadPress('.')} className="numpad-button">.</button>
            <button onClick={() => handleNumpadPress('0')} className="numpad-button">0</button>
            <button onClick={() => handleNumpadPress('⌫')} className="numpad-button numpad-action">⌫</button>
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

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div className="spec-grid" style={{ gridTemplateColumns: viewMode === 'desktop' ? '1.5fr 1fr' : '1.2fr 1fr' }}>
              <div className="croquis-box">
                <span style={{ fontSize: '11px', color: 'var(--secondary-color)', position: 'absolute', top: '8px' }}>Visual Croquis spec</span>
                
                {snappedFabric ? (
                  <img src={snappedFabric} alt="Fabric swatch" style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '8px', border: '1px solid var(--border-color)' }} />
                ) : (
                  <svg width="80" height="160" viewBox="0 0 120 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Head & Neck */}
                    <path d="M60 22 C64 22 67 19 67 14 C67 9 64 6 60 6 C56 6 53 9 53 14 C53 19 56 22 60 22 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                    <path d="M57 22 L57 28 C57 32 63 32 63 28 L63 22" stroke="var(--secondary-color)" strokeWidth="1.2" />
                    
                    {/* Mannequin Body */}
                    <path d="M42 34 C46 32 54 30 60 30 C66 30 74 32 78 34 C82 36 84 41 84 45 L80 90 C79 93 76 95 73 95 L68 95 C66 98 64 105 65 110 C66 115 69 125 70 135 C68 138 65 140 60 140 C55 140 52 138 50 135 C51 125 54 115 55 110 C56 105 54 98 52 95 L47 95 C44 95 41 93 40 90 L36 45 C36 41 38 36 42 34 Z" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />
                    <path d="M50 135 L44 225 C43 228 46 230 49 230 L53 230 L57 160 L60 160 L63 160 L67 230 L71 230 C74 230 77 228 76 225 L70 135" fill="var(--surface-color)" stroke="var(--secondary-color)" strokeWidth="1.2" />

                    {/* Garment overlays */}
                    {selectedGarment === 'Kente Gown' && (
                      <path d="M42 34 L78 34 L80 80 L76 135 L76 225 L44 225 L44 135 L40 80 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="2" fillOpacity="0.5" />
                    )}
                    {selectedGarment === '3-Piece Suit' && (
                      <>
                        <path d="M42 34 L78 34 L80 95 L40 95 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="2" fillOpacity="0.5"/>
                        <path d="M48 95 L44 225 L58 225 L58 150 L62 150 L62 225 L76 225 L72 95 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="1.5" fillOpacity="0.5" />
                      </>
                    )}
                    {selectedGarment === 'Kaftan' && (
                      <path d="M38 34 L82 34 L80 200 L40 200 Z" fill="var(--surface-color)" stroke="var(--text-color)" strokeWidth="2" fillOpacity="0.5" />
                    )}
                  </svg>
                )}
                <span style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '6px' }}>{selectedGarment}</span>
              </div>

              <div className="spec-controls">
                <div className="select-wrapper">
                  <label>Garment Type</label>
                  <input 
                    type="text" 
                    list="spec-garments-list" 
                    className="select-input" 
                    value={selectedGarment} 
                    onChange={(e) => setSelectedGarment(e.target.value)} 
                    placeholder="Kente Gown, Kaftan, Suit..."
                    required
                  />
                  <datalist id="spec-garments-list">
                    <option value="Kente Gown" />
                    <option value="3-Piece Suit" />
                    <option value="Kaftan" />
                  </datalist>
                </div>

                <div className="select-wrapper">
                  <label>Fabric Bolt Width</label>
                  <select className="select-input" value={selectedBoltWidth} onChange={(e) => setSelectedBoltWidth(e.target.value)}>
                    <option value="60 Inches">60 Inches Width</option>
                    <option value="45 Inches">45 Inches Width</option>
                    <option value="36 Inches">36 Inches Width</option>
                  </select>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-color)', display: 'block', marginBottom: '4px' }}>
                    Fabric Attachment
                  </span>
                  
                  {/* File Upload button instead of mock snap */}
                  <label className="numpad-button" style={{ height: '70px', display: 'flex', flexDirection: 'column', fontSize: '11px', gap: '4px', cursor: 'pointer', justifyContent: 'center', alignItems: 'center' }}>
                    {isSnapping ? (
                      <span>Uploading...</span>
                    ) : snappedFabric ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={16} /> <span>Attachment Added</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} />
                        <span>Choose File / Snap</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleFabricAttachmentUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>

            <div className="pulse-box">
              <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--secondary-color)', display: 'block', marginBottom: '6px' }}>
                Automated Yardage Calculator
              </span>
              <p style={{ fontSize: '12px', color: 'var(--secondary-color)', marginBottom: '8px' }}>
                Based on Chest: {selectedClient.measurements.chest}" and Length: {selectedClient.measurements.length}"
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '6px' }}>
                <span className="text-mono" style={{ fontSize: '28px', color: 'var(--text-color)' }}>{calculateRequiredYardage()}</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Yards Needed</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--secondary-color)', display: 'block', marginBottom: '6px' }}>
                Design Specifications & Pattern Notes
              </span>
              <textarea 
                value={patternNotes}
                onChange={(e) => setPatternNotes(e.target.value)}
                className="select-input" 
                rows={4}
                style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px', resize: 'none' }}
                placeholder="Enter instructions..."
              />
            </div>
          </div>
        </div>
      );
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
            {supabaseConnected && (
              <button 
                onClick={syncClientsFromSupabase} 
                disabled={dbSyncing} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-color)', fontWeight: 'bold' }}
              >
                <RefreshCw size={12} className={dbSyncing ? 'animate-spin' : ''} /> {dbSyncing ? 'Syncing...' : 'Sync'}
              </button>
            )}
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
                <div key={client.id} className="client-row">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="client-avatar">
                      {client.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="client-info">
                      <h3 style={{ fontSize: '14px' }}>{client.name}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--secondary-color)' }}>Last Measured: {client.lastMeasured}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => startTape(client)} style={{ border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '12px', fontSize: '12px', cursor: 'pointer', backgroundColor: 'var(--bg-color)', fontWeight: 'bold' }}>Tape</button>
                    <button onClick={() => startSpec(client)} style={{ border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '12px', fontSize: '12px', cursor: 'pointer', backgroundColor: 'var(--bg-color)', fontWeight: 'bold' }}>Spec</button>
                  </div>
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
                              style={{ padding: '2px 4px', fontSize: '10px', border: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-color)' }}
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
                              style={{ padding: '2px 4px', fontSize: '10px', border: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-color)', flex: 1 }}
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

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          <h1 style={{ fontFamily: 'var(--font-brand)', marginBottom: '12px' }}>LEDGER</h1>

          <div className="ledger-metrics-grid">
            <div className="ledger-metric-card">
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--secondary-color)', fontWeight: 600 }}>Total Billings</span>
              <span className="text-mono" style={{ fontSize: '15px' }}>GHS {totalBillingSum.toLocaleString()}</span>
            </div>
            <div className="ledger-metric-card">
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--secondary-color)', fontWeight: 600 }}>Received</span>
              <span className="text-mono" style={{ fontSize: '15px' }}>GHS {totalReceivedSum.toLocaleString()}</span>
            </div>
            <div className="ledger-metric-card due">
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#B45309', fontWeight: 600 }}>Outstanding</span>
              <span className="text-mono" style={{ fontSize: '15px', color: '#B45309' }}>GHS {totalBalanceDueSum.toLocaleString()}</span>
            </div>
          </div>

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: isBalanced ? '#047857' : '#B45309' }}>
                        {isBalanced ? '🟢 BALANCE CLEARED' : `🔴 DUE: GHS ${outstanding}`}
                      </span>
                      <button 
                        onClick={handleWhatsAppClick}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <MessageSquare size={12} /> WhatsApp Notify
                      </button>
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
                          <div className="lock-stat-card"><span className="lock-stat-label">Chest</span><span className="lock-stat-val text-mono">{client.measurements.chest} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Shoulder</span><span className="lock-stat-val text-mono">{client.measurements.shoulder} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Sleeve</span><span className="lock-stat-val text-mono">{client.measurements.sleeve} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Waist</span><span className="lock-stat-val text-mono">{client.measurements.waist} in</span></div>
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
                  <button className={`nav-tab ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => { setActiveTab('ledger'); setCurrentScreen('dashboard'); }}>
                    <FileText size={22} />
                    <span>Ledger</span>
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
                    <button onClick={() => { setActiveTab('ledger'); setCurrentScreen('dashboard'); }} className={`sidebar-tab ${activeTab === 'ledger' ? 'active' : ''}`}>
                      <FileText size={18} />
                      <span>Ledger & Billing</span>
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
                          <div className="lock-stat-card"><span className="lock-stat-label">Chest</span><span className="lock-stat-val text-mono">{client.measurements.chest} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Shoulder</span><span className="lock-stat-val text-mono">{client.measurements.shoulder} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Sleeve</span><span className="lock-stat-val text-mono">{client.measurements.sleeve} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Waist</span><span className="lock-stat-val text-mono">{client.measurements.waist} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Hips</span><span className="lock-stat-val text-mono">{client.measurements.hips} in</span></div>
                          <div className="lock-stat-card"><span className="lock-stat-label">Length</span><span className="lock-stat-val text-mono">{client.measurements.length} in</span></div>
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
    </div>
  );
}
