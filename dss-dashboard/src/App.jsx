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
  const [crop, setCrop] = useState('Cassava');
  const [rainfall, setRainfall] = useState('1200');
  const [tmax, setTmax] = useState('31.5');
  const [farmSize, setFarmSize] = useState('1.5');
  const [location, setLocation] = useState(''); // NEW: Location state

  const [result, setResult] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

  // NEW: Added location to the locked snapshot so the report header doesn't change while typing
  const [submittedParams, setSubmittedParams] = useState({ rainfall: '1200', tmax: '31.5', location: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [historicalData, setHistoricalData] = useState([]);

  useEffect(() => {
    try {
      window.localStorage.setItem('crop-outlook-theme', theme);
    } catch {
      // The selected theme still applies for this session if storage is unavailable.
    }
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
      setErrorMsg('⚠️ Pakiusap: Ilagay ang lahat ng kinakailangang numero bago mag-proseso.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

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

      setResult(dataForecast);
      setRecommendation(dataRec.ranking);
      setSubmittedParams({ rainfall, tmax, location });

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
    displayChartData.push({ semester: '2025 S1 (Proj)', forecast: result.projected_yield_mt_ha });
  }

  return (
    <div className="dashboard-shell" data-theme={theme}>
      <header className="dashboard-header print:mb-4">
        <div className="brand-block">
          <span className="brand-eyebrow">RIZAL AGRICULTURE</span>
          <h1 className="dashboard-title">Crop outlook</h1>
          <p className="dashboard-subtitle">Yield forecasting and crop recommendations</p>

          {submittedParams.location && (
            <div className="location-chip">
              <span>Farm location</span>
              <span>{submittedParams.location}</span>
            </div>
          )}
        </div>
        <div className="dashboard-actions print:hidden">
          <button onClick={handlePrint} className="export-button">
            Export report
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'dark'}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
              </svg>
            )}
          </button>
          <div className="dashboard-status">
            <span className="status-dot" aria-hidden="true" />
            Scenario planning
          </div>
        </div>
      </header>

      <div className="dashboard-layout">

        <aside className="control-panel print:hidden">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Scenario</span>
              <h2>Inputs</h2>
            </div>
          </div>

          <label className="field-label">
            Target crop <span className="field-hint">Piling pananim</span>
          </label>
          <select
            className="form-control crop-select"
            value={crop}
            onChange={handleCropChange}
          >
            <option value="Cassava">Cassava (Kamoteng Kahoy)</option>
            <option value="Ginger">Ginger (Luya)</option>
            <option value="Camote">Camote (Sweet Potato)</option>
          </select>

          <h3 className="section-title">Farm details</h3>

          <div className="input-group">
            <label className="field-label">
              Farm name or location <span className="field-hint">Pangalan o lugar ng sakahan</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Brgy. Ampid, San Mateo"
              className="form-control"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="input-group area-group">
            <label className="field-label">
              Farm area <span className="field-hint">Laki ng sakahan sa ektarya</span>
            </label>
            <div className="area-row">
              <input
                type="number"
                className="form-control area-input"
                value={farmSize}
                onChange={handleLimitedInput(setFarmSize, 6)}
              />
              <span className="unit-label">hectares</span>
            </div>
          </div>

          <h3 className="section-title weather-title">Seasonal weather</h3>

          <div className="input-group">
            <label className="field-label field-label-row">
              <span>Semestral Rainfall (mm)</span>
              <span className="field-hint">Naipong ulan</span>
            </label>
            <div className="slider-row">
              <input
                type="range" min="300" max="6000" step="10"
                className="range-control rainfall-range"
                value={Number(rainfall) || 0}
                onChange={handleLimitedInput(setRainfall, 4)}
              />
              <input
                type="number"
                className="form-control number-control"
                value={rainfall}
                onChange={handleLimitedInput(setRainfall, 4)}
              />
            </div>
          </div>

          <div className="input-group temperature-group">
            <label className="field-label field-label-row">
              <span>Average Max Temp (°C)</span>
              <span className="field-hint">Sukdulang init</span>
            </label>
            <div className="slider-row">
              <input
                type="range" min="28.0" max="60.0" step="0.5"
                className="range-control temperature-range"
                value={Number(tmax) || 0}
                onChange={handleLimitedInput(setTmax, 4)}
              />
              <input
                type="number"
                className="form-control number-control"
                value={tmax}
                onChange={handleLimitedInput(setTmax, 4)}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="inline-error">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleForecast}
            disabled={isLoading}
            className={`forecast-button ${isLoading ? 'is-loading' : ''}`}
          >
            {isLoading ? 'Calculating forecast...' : 'Run forecast'}
          </button>
        </aside>

        <main className="results-column">

          {/* AI CROP RECOMMENDATION ENGINE */}
          {recommendation && (
            <div className="recommendation-panel print:break-inside-avoid">
              <div className="section-kicker">Crop suitability</div>
              <h2>Best fit: {recommendation[0].crop}</h2>
              <p>
                At {submittedParams.rainfall} mm rainfall and {submittedParams.tmax}°C, {recommendation[0].crop} is projected to retain {recommendation[0].health_score}% of normal yield capacity.
              </p>

              <div className="ranking-list">
                {recommendation.map((item, index) => (
                  <div key={item.crop} className={`ranking-item ${index === 0 ? 'is-top' : ''}`}>
                    <div className="ranking-label">Rank {index + 1}</div>
                    <div className="ranking-crop">{item.crop}</div>
                    <div className="ranking-score">{item.health_score}% yield health</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIONABLE AGRONOMIC INTERVENTIONS */}
          {result && (
            <div className="interventions-panel print:break-inside-avoid">
              <h2>Field recommendations for {crop}</h2>
              <ul>
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} className="recommendation-row">
                    <div className={`recommendation-heading urgency-${rec.urgency.toLowerCase()}`}>
                      <span className="recommendation-icon" aria-hidden="true">
                        {rec.urgency === 'Normal' ? (
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M20 11.1V12a8 8 0 1 1-4.75-7.32" />
                            <path d="m8.5 11.5 3 3L21 5" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z" />
                            <path d="M12 9v4m0 4h.01" />
                          </svg>
                        )}
                      </span>
                      <span className="recommendation-alert">{rec.alert}</span>
                      <span className="urgency-badge">{rec.urgency}</span>
                    </div>
                    <span className="recommendation-action">{rec.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TARGET CROP METRICS */}
          {result && (
            <div className="metric-grid print:break-inside-avoid">
              <div className="metric-panel">
                <div className="metric-label">Projected yield · {crop}</div>
                <div className="metric-value">{result.projected_yield_mt_ha} <span>MT/ha</span></div>
              </div>

              <div className="metric-panel metric-panel-accent">
                <div className="metric-label">Estimated harvest · {farmSize} ha</div>
                <div className="metric-value">{totalHarvestMT} <span>MT</span></div>
              </div>
            </div>
          )}

          {/* ACADEMIC VALIDATION */}
          {result && (
            <div className="validation-strip print:hidden print:break-inside-avoid">
              <span className="validation-title">Model metrics</span>
              <span>R² <strong>{result.model_metrics.R2}</strong></span>
              <span>RMSE <strong>{result.model_metrics.RMSE}</strong></span>
              <span>MAE <strong>{result.model_metrics.MAE}</strong></span>
            </div>
          )}

          {/* DYNAMIC CHART */}
          <div className="chart-panel print:break-inside-avoid">
            <div className="chart-heading">
              <div>
                <span className="section-kicker">Yield history</span>
                <h2>Seasonal trajectory</h2>
              </div>
              <span className="chart-crop">{crop}</span>
            </div>
            <div className="chart-container print:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1d5db" />
                  <XAxis dataKey="semester" tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }} tickMargin={10} />
                  <YAxis tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '14px', fontWeight: 'bold' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="actual" stroke="#374151" strokeWidth={4} name="Actual (PSA)" dot={{ r: 6 }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={4} strokeDasharray="6 6" name="Hybrid Forecast" dot={{ r: 6 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}