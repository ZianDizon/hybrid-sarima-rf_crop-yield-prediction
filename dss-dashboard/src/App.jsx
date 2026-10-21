import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  useEffect(() => {
    try {
      window.localStorage.setItem('crop-outlook-theme', theme);
    } catch {}
    document.body.style.backgroundColor = theme === 'dark' ? '#111827' : '#f9fafb';
    document.body.style.color = theme === 'dark' ? '#f3f4f6' : '#111827';
  }, [theme]);

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

      setResult(dataForecast);
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
        
        .tab-btn {
          padding: 8px 16px; font-weight: 600; font-size: 14px; border-bottom: 2px solid transparent;
          background: none; border-top: none; border-left: none; border-right: none;
          color: ${textMuted}; cursor: pointer; transition: all 0.2s;
        }
        .tab-btn.active { color: #10b981; border-bottom-color: #10b981; }
        .tab-btn:hover:not(.active) { color: ${textColor}; }
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
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${borderColor}`, background: 'transparent', color: textColor, cursor: 'pointer' }}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>

          <button
            onClick={handlePrint}
            disabled={!result}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: result ? '#10b981' : '#9ca3af',
              color: 'white',
              fontWeight: 600,
              cursor: result ? 'pointer' : 'not-allowed',
              opacity: result ? 1 : 0.6
            }}
          >
            Export Report
          </button>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR INPUTS */}
        <aside className="print-hidden" style={{ width: '320px', flex: 'none', backgroundColor: bgCard, borderRight: `1px solid ${borderColor}`, padding: '24px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Simulation Inputs</h2>

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
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="print-force-light-bg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden', position: 'relative' }}>

          {/* TABS NAVIGATION */}
          <nav className="print-hidden" style={{ flex: 'none', display: 'flex', gap: '16px', borderBottom: `1px solid ${borderColor}`, marginBottom: '20px' }}>
            <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              Forecast & Metrics
            </button>
            <button className={`tab-btn ${activeTab === 'interventions' ? 'active' : ''}`} onClick={() => setActiveTab('interventions')}>
              Agronomic Interventions
            </button>
            <button className={`tab-btn ${activeTab === 'suitability' ? 'active' : ''}`} onClick={() => setActiveTab('suitability')}>
              Crop Suitability
            </button>
          </nav>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>

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

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div className="print-force-gray-bg" style={{ flex: 1, padding: '12px', background: theme === 'dark' ? '#374151' : '#f3f4f6', borderRadius: '8px' }}>
                    <div className="print-force-text-muted" style={{ fontSize: '13px', color: textMuted, fontWeight: 600 }}>Projected Yield (MT/ha)</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981' }}>{result.projected_yield_mt_ha}</div>
                  </div>
                  <div className="print-force-gray-bg" style={{ flex: 1, padding: '12px', background: theme === 'dark' ? '#374151' : '#f3f4f6', borderRadius: '8px' }}>
                    <div className="print-force-text-muted" style={{ fontSize: '13px', color: textMuted, fontWeight: 600 }}>Estimated Total Harvest ({farmSize} ha)</div>
                    <div className="print-force-text-dark" style={{ fontSize: '28px', fontWeight: 800, color: textColor }}>{totalHarvestMT} <span style={{ fontSize: '14px' }}>MT</span></div>
                  </div>
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
                  Based on {submittedParams.rainfall} mm rainfall and {submittedParams.tmax}°C, <strong className="print-force-text-dark" style={{color: textColor}}>{recommendation[0].crop}</strong> is the most optimal choice.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {recommendation.map((item, index) => (
                    <div key={item.crop} className="print-force-border" style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: index === 0 ? '2px solid #059669' : `1px solid ${borderColor}`,
                      background: index === 0 ? '#10b981' : 'transparent',
                      color: index === 0 ? '#ffffff' : textColor,
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                    }}>
                      <div className={index === 0 ? "" : "print-force-text-muted"} style={{ fontSize: '11px', fontWeight: 700, color: index === 0 ? '#ecfdf5' : textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Rank {index + 1}</div>
                      <div className={index === 0 ? "" : "print-force-text-dark"} style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>{item.crop}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: index === 0 ? '#ecfdf5' : '#10b981' }}>{item.health_score}% Yield Health</div>
                    </div>
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
        </main>
      </div>
    </div>
  );
}