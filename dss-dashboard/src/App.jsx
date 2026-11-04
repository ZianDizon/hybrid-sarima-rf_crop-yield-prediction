import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BadgeCheck, BarChart3, Box, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, CloudRain, Droplets, FileDown, Moon, Sprout, Sun, Thermometer, Wheat, X } from 'lucide-react';

const fallbackHistory = {
  Cassava: [
    { semester: '2023 S1', actual: 11.2 }, { semester: '2023 S2', actual: 11.5 },
    { semester: '2024 S1', actual: 11.4 }, { semester: '2024 S2', actual: 11.5 }
  ],
  Ginger: [
    { semester: '2023 S1', actual: 4.1 }, { semester: '2023 S2', actual: 4.3 },
    { semester: '2024 S1', actual: 4.0 }, { semester: '2024 S2', actual: 4.2 }
  ],
  Camote: [
    { semester: '2023 S1', actual: 2.5 }, { semester: '2023 S2', actual: 2.6 },
    { semester: '2024 S1', actual: 12.1 }, { semester: '2024 S2', actual: 11.8 }
  ]
};

const cropProfiles = {
  Cassava: { commonName: 'Cassava', botanicalName: 'Manihot esculenta' },
  Ginger: { commonName: 'Ginger', botanicalName: 'Zingiber officinale' },
  Camote: { commonName: 'Sweet Potato', botanicalName: 'Ipomoea batatas' }
};

const suitabilityPractices = [
  'Use healthy planting materials and locally suitable varieties.',
  'Maintain appropriate soil moisture and good drainage.',
  'Monitor regularly for pests and disease.'
];

export default function Dashboard() {
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('crop-outlook-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // Inputs
  const [crop, setCrop] = useState('Cassava');
  const [rainfall, setRainfall] = useState('1200');
  const [tmax, setTmax] = useState('31.5');
  const [farmSize, setFarmSize] = useState('1.5');
  const [location, setLocation] = useState('');

  // Results
  const [result, setResult] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [selectedSuitability, setSelectedSuitability] = useState(null);
  const [submittedParams, setSubmittedParams] = useState({
    rainfall: '1200',
    tmax: '31.5',
    location: '',
    timestamp: ''
  });

  // System States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [historicalData, setHistoricalData] = useState([]);

  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');
  const [inputsCollapsed, setInputsCollapsed] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem('crop-outlook-theme', theme);
    } catch { }
    document.body.style.backgroundColor = theme === 'dark' ? '#111827' : '#f9fafb';
    document.body.style.color = theme === 'dark' ? '#f3f4f6' : '#111827';
  }, [theme]);

  useEffect(() => {
    if (!selectedSuitability) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedSuitability(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSuitability]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/history/${crop}`);
        if (!res.ok) throw new Error("Backend endpoint not ready");
        const data = await res.json();
        if (data && data.history && data.history.length > 0) {
          setHistoricalData(data.history);
        } else {
          throw new Error("Backend returned empty timeline");
        }
      } catch (error) {
        setHistoricalData(fallbackHistory[crop]);
      }
    };
    fetchHistory();
  }, [crop]);

  const handleCropChange = (e) => {
    setCrop(e.target.value);
    setResult(null);
    setRecommendation(null);
  };

  const handleUseRecommendedCrop = () => {
    if (!selectedSuitability) return;
    setCrop(selectedSuitability.crop);
    setResult(null);
    setRecommendation(null);
    setSelectedSuitability(null);
    setActiveTab('overview');
  };

  const handleLimitedInput = (setter, maxLength) => (e) => {
    const val = e.target.value;
    if (val.length <= maxLength) setter(val);
  };

  const handleForecast = async () => {
    if (rainfall === '' || tmax === '' || farmSize === '') {
      setErrorMsg('⚠️ Please fill in all required numbers.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      const resForecast = await fetch('http://localhost:8000/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop, rainfall: Number(rainfall), tmax: Number(tmax), tmin: 22.0, rh: 85.0 })
      });
      const dataForecast = await resForecast.json();

      const forecastRecommendations = Array.isArray(dataForecast.recommendations)
        ? { interventions: dataForecast.recommendations }
        : dataForecast.recommendations || {};
      const normalizedForecast = {
        ...dataForecast,
        target_semester_label: dataForecast.target_semester_label || 'Upcoming semester',
        recommendations: {
          recommended_varieties: forecastRecommendations.recommended_varieties || [],
          interventions: forecastRecommendations.interventions || []
        }
      };

      const resRec = await fetch('http://localhost:8000/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rainfall: Number(rainfall), tmax: Number(tmax) })
      });
      const dataRec = await resRec.json();

      const currentTime = new Date().toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      setResult(normalizedForecast);
      setRecommendation(dataRec.ranking);
      setSubmittedParams({ rainfall, tmax, location, timestamp: currentTime });
      setActiveTab('overview');

    } catch (error) {
      console.error("Backend connection error", error);
      setErrorMsg('⚠️ Backend API is not responding. Ensure main.py is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const totalHarvestMT = result ? (result.projected_yield_mt_ha * (Number(farmSize) || 0)).toFixed(2) : 0;
  const displayChartData = historicalData ? historicalData.map(item => ({ ...item })) : [];

  if (result) {
    if (displayChartData.length > 0) {
      const lastIndex = displayChartData.length - 1;
      displayChartData[lastIndex].forecast = displayChartData[lastIndex].actual;
    }
    displayChartData.push({ semester: `${result.target_semester_label} (Proj)`, forecast: result.projected_yield_mt_ha });
  }

  const bgCard = theme === 'dark' ? '#1f2937' : '#ffffff';
  const borderColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  const textColor = theme === 'dark' ? '#f3f4f6' : '#111827';
  const textMuted = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const selectedCropProfile = selectedSuitability ? cropProfiles[selectedSuitability.crop] : null;
  const selectedHealthScore = selectedSuitability ? Number(selectedSuitability.health_score) : 0;
  const scoreBarWidth = Math.min(Math.max(selectedHealthScore, 0), 100);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        
        @media screen {
          .screen-hidden { display: none !important; }
          .screen-inline { display: inline !important; }
          .screen-block { display: block !important; }
        }

        @media print {
          @page { margin: 10mm; size: portrait; } 
          
          body { 
            padding: 0 !important; 
            background: white !important; 
            color: black !important;
            height: auto !important;
            overflow: visible !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          
          .print-hidden { display: none !important; }
          .print-inline { display: inline !important; }
          .print-block { display: block !important; margin-bottom: 12px !important; }
          .print-avoid-break { page-break-inside: avoid; }
          
          /* FORCE LIGHT MODE OVERRIDES FOR PRINTING */
          .print-force-light-bg { background: #ffffff !important; color: #111827 !important; }
          .print-force-gray-bg { background: #f3f4f6 !important; color: #111827 !important; }
          .print-force-border { border: 1px solid #d1d5db !important; }
          .print-force-text-dark { color: #111827 !important; }
          .print-force-text-muted { color: #6b7280 !important; }
          
          .border-card { 
            border: 1px solid #d1d5db !important; 
            padding: 12px !important; 
            border-radius: 6px !important; 
            margin-bottom: 12px !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          h2 { font-size: 14px !important; margin-bottom: 8px !important; color: #111827 !important; }
          p, span, div { line-height: 1.3 !important; }
        }

        .input-field {
          width: 100%; padding: 8px 12px; border: 1px solid ${borderColor}; border-radius: 6px;
          background: ${theme === 'dark' ? '#374151' : '#f9fafb'};
          color: ${textColor}; margin-top: 4px;
        }

        .dashboard-body {
          flex: 1; min-height: 0; display: flex; align-items: flex-start; gap: 20px;
          padding: 24px; overflow: auto; background: ${theme === 'dark' ? '#111827' : '#f3f6f3'};
        }
        .simulation-panel {
          width: 300px; flex: 0 0 300px; max-height: 100%; overflow-y: auto;
          padding: 20px; border: 1px solid ${borderColor}; border-radius: 12px;
          background: ${bgCard}; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
          transition: width 240ms cubic-bezier(0.2, 0.8, 0.2, 1), flex-basis 240ms cubic-bezier(0.2, 0.8, 0.2, 1), padding 180ms ease;
        }
        .simulation-panel.is-collapsed {
          width: 60px; flex-basis: 60px; padding: 12px; overflow: visible;
        }
        .simulation-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; overflow: hidden; }
        .simulation-panel-heading h2 {
          max-width: 220px; overflow: hidden; white-space: nowrap; opacity: 1; transform: translateX(0);
          transition: max-width 220ms ease, opacity 140ms ease, transform 180ms ease;
        }
        .simulation-panel.is-collapsed .simulation-panel-heading { justify-content: center; }
        .simulation-panel.is-collapsed .simulation-panel-heading h2 { max-width: 0; opacity: 0; transform: translateX(-8px); }
        .simulation-panel-toggle svg { animation: toggle-icon-in 160ms ease both; }
        @keyframes toggle-icon-in {
          from { opacity: 0; transform: translateX(-3px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .simulation-panel, .simulation-panel-heading h2 { transition: none; }
          .simulation-panel-toggle svg { animation: none; }
        }
        .dashboard-main {
          flex: 1; min-width: 0; min-height: 0; height: 100%; display: flex; flex-direction: column;
          overflow: hidden; position: relative;
        }
        @media (max-width: 900px) {
          .dashboard-body { flex-direction: column; }
          .simulation-panel { width: 100%; flex-basis: auto; max-height: none; }
          .simulation-panel.is-collapsed { width: 100%; flex-basis: auto; padding: 12px 16px; }
          .simulation-panel.is-collapsed .simulation-panel-heading { justify-content: space-between; }
          .simulation-panel.is-collapsed .simulation-panel-heading h2 { max-width: 220px; opacity: 1; transform: translateX(0); }
          .dashboard-main { width: 100%; height: 65vh; flex: none; }
        }
        
        .dashboard-tabs {
          display: flex; align-items: center; gap: 4px; width: 100%; padding: 5px;
          margin-bottom: 20px; overflow-x: auto; border: 1px solid ${borderColor};
          border-radius: 10px; background: ${theme === 'dark' ? '#111827' : '#f1f5f2'};
        }
        .dashboard-tab {
          display: flex; flex: 1 1 0; align-items: center; justify-content: center; gap: 8px;
          min-height: 40px; padding: 8px 14px; border: 1px solid transparent; border-radius: 7px;
          background: transparent; color: ${textMuted}; font-size: 13px; font-weight: 650;
          white-space: nowrap; cursor: pointer; transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
        }
        .dashboard-tab.active {
          border-color: ${theme === 'dark' ? '#065f46' : '#d1fae5'};
          background: ${theme === 'dark' ? '#064e3b' : '#ffffff'};
          color: ${theme === 'dark' ? '#a7f3d0' : '#047857'};
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }
        .dashboard-tab:hover:not(.active) {
          background: ${theme === 'dark' ? '#1f2937' : '#e7eee9'}; color: ${textColor};
        }
        @media (max-width: 720px) {
          .dashboard-tabs { justify-content: flex-start; }
          .dashboard-tab { flex: 0 0 auto; }
        }
        .suitability-option { transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease; }
        .suitability-option:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1); }
      `}</style>

      {/* HEADER */}
      <header className="print-force-light-bg print-force-border" style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: bgCard, borderBottom: `1px solid ${borderColor}` }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Rizal Agriculture</div>
          <h1 className="print-force-text-dark" style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0' }}>
            Crop Yield Prediction and Recommendation <span className="print-hidden">Dashboard</span><span className="screen-hidden print-inline">Report</span>
          </h1>

          <div className="print-force-text-muted" style={{ fontSize: '13px', color: textMuted, display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
            {submittedParams.location && (
              <span>Farm Location: <strong className="print-force-text-dark" style={{ color: textColor }}>{submittedParams.location}</strong></span>
            )}
            {submittedParams.timestamp && (
              <span>Generated on: <strong className="print-force-text-dark" style={{ color: textColor }}>{submittedParams.timestamp}</strong></span>
            )}
          </div>
        </div>

        <div className="print-hidden" style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ minHeight: '40px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: theme === 'dark' ? '#1f2937' : '#ffffff', color: textColor, fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 140ms ease, border-color 140ms ease' }}
          >
            {theme === 'dark' ? <Sun size={16} color="#d97706" aria-hidden="true" /> : <Moon size={16} color="#4b5563" aria-hidden="true" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div className="dashboard-body">

        {/* SIMULATION INPUTS PANEL */}
        {activeTab === 'overview' && (
          <section className={`simulation-panel print-hidden ${inputsCollapsed ? 'is-collapsed' : ''}`} aria-label="Simulation Inputs">
            <div className="simulation-panel-heading" style={{ justifyContent: inputsCollapsed ? 'center' : 'space-between', marginBottom: inputsCollapsed ? 0 : '20px' }}>
              <h2 id="simulation-inputs-heading" style={{ fontSize: '18px', fontWeight: 700 }}>Simulation Inputs</h2>
              <button
                type="button"
                className="simulation-panel-toggle"
                aria-label={inputsCollapsed ? 'Expand simulation inputs' : 'Collapse simulation inputs'}
                aria-expanded={!inputsCollapsed}
                aria-controls="simulation-inputs-fields"
                title={inputsCollapsed ? 'Expand inputs' : 'Collapse inputs'}
                onClick={() => setInputsCollapsed(!inputsCollapsed)}
                style={{ width: '34px', height: '34px', flex: 'none', display: 'grid', placeItems: 'center', border: `1px solid ${borderColor}`, borderRadius: '50%', background: theme === 'dark' ? '#111827' : '#f9fafb', color: textMuted, cursor: 'pointer' }}
              >
                {inputsCollapsed ? <ChevronRight size={17} aria-hidden="true" /> : <ChevronLeft size={17} aria-hidden="true" />}
              </button>
            </div>

            {!inputsCollapsed && <div id="simulation-inputs-fields">
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>Target Crop</label>
                <select className="input-field" value={crop} onChange={handleCropChange}>
                  <option value="Cassava">Cassava (Kamoteng Kahoy)</option>
                  <option value="Ginger">Ginger (Luya)</option>
                  <option value="Camote">Camote (Sweet Potato)</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>Farm Name / Location</label>
                <input type="text" placeholder="e.g. Brgy. Ampid, San Mateo" className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>Farm Area (Hectares)</label>
                <input type="number" className="input-field" value={farmSize} onChange={handleLimitedInput(setFarmSize, 6)} />
              </div>

              {/* RAINFALL INPUT + HELPER NOTE */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>Semestral Rainfall (mm)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input type="range" min="300" max="6000" step="10" value={Number(rainfall) || 0} onChange={handleLimitedInput(setRainfall, 4)} style={{ flex: 1 }} />
                  <input type="number" className="input-field" value={rainfall} onChange={handleLimitedInput(setRainfall, 4)} style={{ width: '80px', marginTop: 0 }} />
                </div>
                <div style={{ fontSize: '11px', color: textMuted, marginTop: '8px', lineHeight: '1.4' }}>
                  <strong>Tip:</strong> Rizal's 30-year normal semestral rainfall is ~1,200mm. Multiply this by PAGASA's seasonal % forecast.
                </div>
              </div>

              {/* TEMPERATURE INPUT + HELPER NOTE */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600 }}>Average Max Temp (°C)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input type="range" min="28.0" max="60.0" step="0.5" value={Number(tmax) || 0} onChange={handleLimitedInput(setTmax, 4)} style={{ flex: 1 }} />
                  <input type="number" className="input-field" value={tmax} onChange={handleLimitedInput(setTmax, 4)} style={{ width: '80px', marginTop: 0 }} />
                </div>
                <div style={{ fontSize: '11px', color: textMuted, marginTop: '8px', lineHeight: '1.4' }}>
                  <strong>Tip:</strong> Rizal's normal average max temperature is ~32°C.
                </div>
              </div>

              {errorMsg && <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px', padding: '8px', background: '#fef2f2', borderRadius: '6px' }}>{errorMsg}</div>}

              <button onClick={handleForecast} disabled={isLoading} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: 'none', background: isLoading ? '#9ca3af' : '#111827', color: 'white', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                {isLoading ? 'Processing...' : 'Run Forecast'}
              </button>
            </div>}
          </section>
        )}

        {/* MAIN CONTENT AREA */}
        <main className="dashboard-main print-force-light-bg">

          {/* TABS NAVIGATION */}
          <nav className="dashboard-tabs print-hidden" aria-label="Dashboard sections" style={{ flex: 'none' }}>
            <button className={`dashboard-tab ${activeTab === 'overview' ? 'active' : ''}`} aria-current={activeTab === 'overview' ? 'page' : undefined} onClick={() => setActiveTab('overview')}>
              <BarChart3 size={16} aria-hidden="true" />
              Forecast & Metrics
            </button>
            <button className={`dashboard-tab ${activeTab === 'interventions' ? 'active' : ''}`} aria-current={activeTab === 'interventions' ? 'page' : undefined} onClick={() => setActiveTab('interventions')}>
              <ClipboardList size={16} aria-hidden="true" />
              Agronomic Interventions
            </button>
            <button className={`dashboard-tab ${activeTab === 'suitability' ? 'active' : ''}`} aria-current={activeTab === 'suitability' ? 'page' : undefined} onClick={() => setActiveTab('suitability')}>
              <Sprout size={16} aria-hidden="true" />
              Crop Suitability
            </button>
          </nav>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '76px' }}>

            {!result && !isLoading && (
              <div className="print-hidden" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
                Configure scenarios on the left panel and click 'Run Forecast' to generate the report.
              </div>
            )}

            {/* TAB 1: OVERVIEW */}
            {result && (
              <div className={`border-card print-block print-avoid-break print-force-light-bg print-force-border ${activeTab === 'overview' ? 'screen-block' : 'screen-hidden'}`} style={{ background: bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${borderColor}`, marginBottom: '20px' }}>

                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                  Yield Forecast for <span style={{ color: '#10b981', padding: '2px 8px', background: 'rgba(16,185,129,0.1)', borderRadius: '4px' }}>{crop}</span> ({result.target_semester_label})
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '8px', marginBottom: '16px' }}>
                  <article className="print-force-light-bg print-force-border" style={{ minWidth: 0, minHeight: '144px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '12px', background: bgCard, color: textColor }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Wheat size={18} color="#18c77a" aria-hidden="true" />
                      <span style={{ padding: '4px 8px', borderRadius: '999px', background: theme === 'dark' ? '#064e3b' : '#dcfce7', color: theme === 'dark' ? '#a7f3d0' : '#166534', fontSize: '11px', fontWeight: 700 }}>Predicted</span>
                    </div>
                    <div>
                      <div style={{ color: textMuted, fontSize: '13px' }}>Projected Yield</div>
                      <div style={{ marginTop: '6px', color: '#18c77a', fontSize: '25px', fontWeight: 700, lineHeight: 1.1 }}>{result.projected_yield_mt_ha}</div>
                      <div style={{ marginTop: '5px', color: textMuted, fontSize: '13px' }}>Metric tons / hectare</div>
                    </div>
                  </article>
                  <article className="print-force-light-bg print-force-border" style={{ minWidth: 0, minHeight: '144px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '12px', background: bgCard, color: textColor }}>
                    <Box size={18} color="#3b82f6" aria-hidden="true" />
                    <div>
                      <div style={{ color: textMuted, fontSize: '13px' }}>Estimated Harvest</div>
                      <div style={{ marginTop: '6px', color: textColor, fontSize: '25px', fontWeight: 700, lineHeight: 1.1 }}>{totalHarvestMT}</div>
                      <div style={{ marginTop: '5px', color: textMuted, fontSize: '13px' }}>Metric tons total</div>
                    </div>
                  </article>
                </div>

                <div className="print-hidden" style={{ marginBottom: '16px', display: 'flex', gap: '16px', fontSize: '13px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: theme === 'dark' ? '#a7f3d0' : '#065f46' }}>
                  <strong>Model Accuracy:</strong>
                  <span>R²: {result.model_metrics.R2}</span> |
                  <span>RMSE: {result.model_metrics.RMSE}</span> |
                  <span>MAE: {result.model_metrics.MAE}</span>
                </div>

                <div className="print-hidden" style={{ height: '280px', width: '100%', marginTop: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: textMuted }}>Seasonal Trajectory</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={borderColor} />
                      <XAxis dataKey="semester" tick={{ fill: textMuted, fontSize: 12 }} />
                      <YAxis tick={{ fill: textMuted, fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: bgCard, borderColor: borderColor, color: textColor }} />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="actual" stroke={textMuted} strokeWidth={3} name="Actual (PSA)" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" name="Hybrid Forecast" dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* TAB 2: INTERVENTIONS */}
            {result && (
              <div className={`border-card print-block print-avoid-break print-force-light-bg print-force-border ${activeTab === 'interventions' ? 'screen-block' : 'screen-hidden'}`} style={{ background: bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${borderColor}`, marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Field Recommendations for {crop}</h2>

                {result.recommendations.recommended_varieties && result.recommendations.recommended_varieties.length > 0 && (
                  <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px' }}>
                    <strong style={{ color: theme === 'dark' ? '#a7f3d0' : '#065f46' }}>Recommended PSB/NSIC Varieties: </strong>
                    <span className="print-force-text-dark" style={{ color: textColor }}>{result.recommendations.recommended_varieties.join(", ")}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {result.recommendations.interventions.map((rec, idx) => (
                    <div key={idx} className="print-force-border" style={{ padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong className="print-force-text-dark" style={{ fontSize: '14px', color: rec.urgency === 'Critical' ? '#ef4444' : textColor }}>{rec.alert}</strong>
                        <span className="print-force-gray-bg" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: rec.urgency === 'Critical' ? '#fef2f2' : theme === 'dark' ? '#374151' : '#f3f4f6', color: rec.urgency === 'Critical' ? '#ef4444' : textMuted }}>
                          {rec.urgency}
                        </span>
                      </div>
                      <p className="print-force-text-muted" style={{ color: textMuted, lineHeight: '1.4', fontSize: '13px' }}>{rec.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: CROP SUITABILITY */}
            {recommendation && (
              <div className={`border-card print-block print-avoid-break print-force-light-bg print-force-border ${activeTab === 'suitability' ? 'screen-block' : 'screen-hidden'}`} style={{ background: bgCard, padding: '20px', borderRadius: '12px', border: `1px solid ${borderColor}` }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Alternative Crop Suitability</h2>
                <p className="print-force-text-muted" style={{ color: textMuted, marginBottom: '16px', fontSize: '13px' }}>
                  Based on {submittedParams.rainfall} mm rainfall and {submittedParams.tmax}°C, <strong className="print-force-text-dark" style={{ color: textColor }}>{recommendation[0].crop}</strong> is the most optimal choice.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {recommendation.map((item, index) => (
                    <button
                      key={item.crop}
                      type="button"
                      className="suitability-option print-force-border"
                      aria-label={`View ${item.crop} crop suitability details`}
                      onClick={() => setSelectedSuitability({ ...item, rank: index + 1 })}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        minHeight: '116px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '14px',
                        border: `1px solid ${index === 0 ? '#10b981' : borderColor}`,
                        borderRadius: '8px',
                        background: index === 0 ? theme === 'dark' ? '#123a2d' : '#ecfdf5' : bgCard,
                        color: textColor,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: index === 0 ? '#059669' : textMuted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Rank #{index + 1}{index === 0 ? ' · Most suitable' : ''}</span>
                        <Sprout size={17} color={index === 0 ? '#059669' : '#10b981'} aria-hidden="true" />
                      </div>
                      <div style={{ width: '100%' }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>{item.crop}</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: index === 0 ? theme === 'dark' ? '#6ee7b7' : '#047857' : '#10b981' }}>{item.health_score}% Yield Health</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* OFFICIAL DISCLAIMER (Displays only when a result exists) */}
            {result && (
              <div className="print-block print-force-gray-bg" style={{ marginTop: '24px', padding: '16px', background: theme === 'dark' ? '#374151' : '#f3f4f6', borderRadius: '8px', fontSize: '11px', color: textMuted, lineHeight: '1.5' }}>
                <strong className="print-force-text-dark" style={{ color: textColor }}>Disclaimer:</strong> This Crop Outlook Decision Support System (DSS) provides predictive agrometeorological projections generated from a Hybrid SARIMA-RF algorithm using historical data. Yield outcomes are estimates and may vary based on actual farm execution, pest outbreaks, and hyper-local soil conditions. This report should be used in conjunction with official <strong>PAGASA climate bulletins</strong> and <strong>Department of Agriculture (DA-ACAP) advisories</strong>.
              </div>
            )}

          </div>
          {activeTab === 'overview' && (
            <button
              type="button"
              className="print-hidden"
              aria-label="Export report"
              title="Export report"
              onClick={handlePrint}
              disabled={!result}
              style={{
                position: 'absolute',
                right: '28px',
                bottom: '28px',
                width: '48px',
                height: '48px',
                display: 'grid',
                placeItems: 'center',
                border: `1px solid ${result ? '#059669' : borderColor}`,
                borderRadius: '50%',
                background: result ? '#059669' : theme === 'dark' ? '#374151' : '#e5e7eb',
                color: result ? '#ffffff' : textMuted,
                boxShadow: result ? '0 6px 16px rgba(5, 150, 105, 0.24)' : 'none',
                cursor: result ? 'pointer' : 'not-allowed',
                opacity: result ? 1 : 0.7
              }}
            >
              <FileDown size={20} aria-hidden="true" />
            </button>
          )}
        </main>
      </div>
      {selectedSuitability && selectedCropProfile && (
        <div
          className="print-hidden"
          role="presentation"
          onClick={() => setSelectedSuitability(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '16px', background: theme === 'dark' ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.4)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="suitability-dialog-title"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(100%, 680px)', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${borderColor}`, borderRadius: '12px', background: bgCard, color: textColor, boxShadow: '0 24px 70px rgba(15, 23, 42, 0.24)' }}
          >
            <div style={{ padding: '20px 20px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '999px', background: theme === 'dark' ? '#064e3b' : '#dcfce7', color: theme === 'dark' ? '#a7f3d0' : '#166534', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Rank #{selectedSuitability.rank}{selectedSuitability.rank === 1 ? ' · Most suitable' : ''}
                  </div>
                  <h2 id="suitability-dialog-title" style={{ marginTop: '8px', fontSize: '23px', fontWeight: 800 }}>{selectedSuitability.crop}</h2>
                  <p style={{ marginTop: '3px', color: textMuted, fontSize: '13px' }}>
                    {selectedCropProfile.commonName} · <i>{selectedCropProfile.botanicalName}</i>
                  </p>
                </div>
                <div style={{ display: 'grid', placeItems: 'center', flex: 'none', width: '44px', height: '44px', borderRadius: '10px', background: theme === 'dark' ? '#123a2d' : '#e5f7ef', color: '#059669' }}>
                  <Sprout size={21} aria-hidden="true" />
                </div>
                <button type="button" aria-label="Close crop suitability details" autoFocus onClick={() => setSelectedSuitability(null)} style={{ position: 'absolute', right: 'max(calc((100vw - 680px) / 2 + 18px), 28px)', top: 'max(calc((100vh - 90vh) / 2 + 18px), 28px)', display: 'grid', placeItems: 'center', width: '32px', height: '32px', border: `1px solid ${borderColor}`, borderRadius: '6px', background: bgCard, color: textMuted, cursor: 'pointer' }}>
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ color: textMuted, fontSize: '13px', fontWeight: 600 }}>Yield Health Score</span>
                  <span style={{ color: '#059669', fontSize: '22px', fontWeight: 800 }}>{selectedHealthScore.toFixed(1)}%</span>
                </div>
                <div style={{ height: '8px', overflow: 'hidden', borderRadius: '999px', background: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
                  <div style={{ width: `${scoreBarWidth}%`, height: '100%', borderRadius: 'inherit', background: '#10b981' }} />
                </div>
                <p style={{ marginTop: '7px', color: textMuted, fontSize: '12px' }}>Relative suitability index, not a probability of a successful harvest.</p>
              </div>

              <section style={{ marginTop: '22px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 750 }}>Suitability Assessment</h3>
                <p style={{ marginTop: '5px', color: textMuted, fontSize: '13px' }}>Based on the supplied farm conditions:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '8px', marginTop: '10px' }}>
                  <div style={{ padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '8px', background: theme === 'dark' ? '#111827' : '#f9fafb' }}>
                    <CloudRain size={16} color="#2563eb" aria-hidden="true" />
                    <div style={{ marginTop: '5px', color: textMuted, fontSize: '12px' }}>Rainfall</div>
                    <strong style={{ display: 'block', marginTop: '2px', fontSize: '14px' }}>{Number(submittedParams.rainfall).toLocaleString()} mm</strong>
                  </div>
                  <div style={{ padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '8px', background: theme === 'dark' ? '#111827' : '#f9fafb' }}>
                    <Thermometer size={16} color="#d97706" aria-hidden="true" />
                    <div style={{ marginTop: '5px', color: textMuted, fontSize: '12px' }}>Temperature</div>
                    <strong style={{ display: 'block', marginTop: '2px', fontSize: '14px' }}>{submittedParams.tmax}°C</strong>
                  </div>
                </div>
              </section>

              <section style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${borderColor}` }}>
                <h3 style={{ fontSize: '15px', fontWeight: 750 }}>Why is this crop recommended?</h3>
                <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                    <CheckCircle2 size={16} color="#10b981" style={{ flex: 'none', marginTop: '2px' }} aria-hidden="true" />
                    <div>
                      <strong style={{ fontSize: '13px' }}>Suitable climate conditions</strong>
                      <p style={{ marginTop: '3px', color: textMuted, fontSize: '13px', lineHeight: 1.45 }}>The current rainfall and temperature inputs contribute to this crop's suitability score.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                    <CheckCircle2 size={16} color="#10b981" style={{ flex: 'none', marginTop: '2px' }} aria-hidden="true" />
                    <div>
                      <strong style={{ fontSize: '13px' }}>Relative growing advantage</strong>
                      <p style={{ marginTop: '3px', color: textMuted, fontSize: '13px', lineHeight: 1.45 }}>Ranked #{selectedSuitability.rank} of {recommendation.length} evaluated crops for these conditions.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${borderColor}` }}>
                <h3 style={{ fontSize: '15px', fontWeight: 750 }}>Agronomic Recommendations</h3>
                <div style={{ display: 'grid', gap: '11px', marginTop: '12px' }}>
                  {suitabilityPractices.map((practice, index) => (
                    <div key={practice} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                      {index === 0 ? <Sprout size={15} color="#059669" aria-hidden="true" /> : index === 1 ? <Droplets size={15} color="#2563eb" aria-hidden="true" /> : <BadgeCheck size={15} color="#059669" aria-hidden="true" />}
                      <span style={{ color: textMuted, fontSize: '13px', lineHeight: 1.4 }}>{practice}</span>
                    </div>
                  ))}
                </div>
              </section>

              <button type="button" onClick={handleUseRecommendedCrop} style={{ width: '100%', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px', border: 'none', borderRadius: '8px', background: '#059669', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
                <CheckCircle2 size={16} aria-hidden="true" />
                Use {selectedSuitability.crop} for forecast
              </button>
              <p style={{ marginTop: '9px', color: textMuted, fontSize: '11px', lineHeight: 1.4 }}>General field practices only. Validate recommendations against local soil conditions and agricultural guidance.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}