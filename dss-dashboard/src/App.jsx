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
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:mb-4">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">FORECASTING DASHBOARD</h1>
          <p className="text-lg text-gray-700 font-medium mt-1">Agrometeorological Forecasting & Crop Recommendation</p>

          {/* NEW: Official Document Location Badge (Highly visible on print) */}
          {submittedParams.location && (
            <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-md font-bold text-sm shadow-sm">
              <span>📍 Target Location:</span>
              <span className="uppercase tracking-wide">{submittedParams.location}</span>
            </div>
          )}
        </div>
        <div className="flex gap-4 print:hidden">
          <button onClick={handlePrint} className="text-base font-bold text-blue-800 bg-blue-100 px-5 py-2.5 rounded shadow-sm hover:bg-blue-200 transition flex items-center gap-2">
            🖨️ Export LGU Report
          </button>
          <div className="text-base font-bold text-green-800 bg-green-100 px-4 py-2.5 rounded border border-green-400 flex items-center">
            🟢 Scenario Planning Mode
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Controls Section */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 print:hidden">
          <h2 className="text-2xl font-black mb-6 text-gray-900 border-b-2 border-gray-100 pb-3">Simulation Parameters</h2>

          <label className="block mb-2 font-bold text-gray-800 text-base uppercase tracking-wide">
            Target Crop <span className="text-gray-600 italic normal-case font-normal ml-1">(Piling Pananim)</span>
          </label>
          <select
            className="w-full p-3 text-base border-2 border-gray-300 rounded-lg mb-8 bg-gray-50 focus:border-green-500 focus:ring-0 outline-none cursor-pointer font-medium"
            value={crop}
            onChange={handleCropChange}
          >
            <option value="Cassava">Cassava (Kamoteng Kahoy)</option>
            <option value="Ginger">Ginger (Luya)</option>
            <option value="Camote">Camote (Sweet Potato)</option>
          </select>

          <h3 className="font-extrabold text-lg text-gray-900 mb-4 border-b-2 border-gray-100 pb-2">Farm Specifications</h3>

          {/* NEW: Location Input Field */}
          <div className="mb-6">
            <label className="block mb-2 font-bold text-gray-800 text-sm uppercase tracking-wide">
              Farm Name / Location <span className="text-gray-600 italic normal-case font-normal block mt-1">(Pangalan o Lugar ng Sakahan)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Brgy. Ampid, San Mateo"
              className="w-full p-3 text-base font-medium border-2 border-gray-300 rounded-lg bg-gray-50 outline-none focus:border-green-500"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="mb-8">
            <label className="block mb-2 font-bold text-gray-800 text-sm uppercase tracking-wide">
              Target Area <span className="text-gray-600 italic normal-case font-normal block mt-1">(Laki ng Sakahan sa Ektarya)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                className="w-32 p-3 text-base font-medium border-2 border-gray-300 rounded-lg bg-gray-50 outline-none focus:border-green-500"
                value={farmSize}
                onChange={handleLimitedInput(setFarmSize, 6)}
              />
              <span className="font-bold text-gray-600">Hectares (ha)</span>
            </div>
          </div>

          <h3 className="font-extrabold text-lg text-gray-900 mb-4 border-b-2 border-gray-100 pb-2">Weather Telemetry</h3>

          <div className="mb-6">
            <label className="block mb-2 font-bold text-gray-800 text-base flex justify-between items-end">
              <span>Semestral Rainfall (mm)</span>
              <span className="text-gray-600 italic text-sm font-normal">Naipong Ulan</span>
            </label>
            <div className="flex items-center gap-4 mb-2">
              <input
                type="range" min="300" max="6000" step="10"
                className="w-full accent-blue-600 h-2 cursor-pointer flex-grow"
                value={Number(rainfall) || 0}
                onChange={handleLimitedInput(setRainfall, 4)}
              />
              <input
                type="number"
                className="w-24 p-2 text-base font-black text-blue-700 border-2 border-gray-300 rounded-lg outline-none focus:border-blue-500 text-center"
                value={rainfall}
                onChange={handleLimitedInput(setRainfall, 4)}
              />
            </div>
          </div>

          <div className="mb-8">
            <label className="block mb-2 font-bold text-gray-800 text-base flex justify-between items-end">
              <span>Average Max Temp (°C)</span>
              <span className="text-gray-600 italic text-sm font-normal">Sukdulang Init</span>
            </label>
            <div className="flex items-center gap-4 mb-2">
              <input
                type="range" min="28.0" max="60.0" step="0.5"
                className="w-full accent-orange-500 h-2 cursor-pointer flex-grow"
                value={Number(tmax) || 0}
                onChange={handleLimitedInput(setTmax, 4)}
              />
              <input
                type="number"
                className="w-24 p-2 text-base font-black text-orange-700 border-2 border-gray-300 rounded-lg outline-none focus:border-orange-500 text-center"
                value={tmax}
                onChange={handleLimitedInput(setTmax, 4)}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 font-bold text-sm rounded">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleForecast}
            disabled={isLoading}
            className={`w-full font-extrabold text-lg py-4 rounded-xl transition shadow-lg flex justify-center items-center gap-2 ${isLoading ? 'bg-gray-400 cursor-not-allowed text-gray-100' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'}`}
          >
            {isLoading ? '⚙️ Processing AI Model...' : 'Run Scenario Projection'}
          </button>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2 space-y-6">

          {/* AI CROP RECOMMENDATION ENGINE */}
          {recommendation && (
            <div className="bg-gradient-to-r from-green-800 to-green-600 p-6 rounded-xl shadow-lg border border-green-900 text-white print:break-inside-avoid print:shadow-none print:border-gray-400">
              <div className="text-sm font-extrabold uppercase tracking-widest mb-1 text-green-200">Crop Suitability Engine</div>
              <h2 className="text-2xl font-black mb-4">Top Recommendation: {recommendation[0].crop} 🏆</h2>
              <p className="text-sm text-green-100 mb-4 leading-relaxed">
                Based on your forecasted weather (<strong className="bg-green-900/40 text-white px-2 py-0.5 rounded shadow-inner">{submittedParams.rainfall}mm rain, {submittedParams.tmax}°C</strong>), the system evaluated all crops against their historical baselines. <strong className="text-white">{recommendation[0].crop}</strong> is projected to retain the highest yield health (<strong className="bg-green-900/40 text-white px-2 py-0.5 rounded shadow-inner">{recommendation[0].health_score}% of normal capacity</strong>) under these specific conditions.
              </p>

              <div className="grid grid-cols-3 gap-4">
                {recommendation.map((item, index) => (
                  <div key={item.crop} className={`p-3 rounded-lg border ${index === 0 ? 'bg-white text-green-900 border-green-300' : 'bg-green-700/50 border-green-500 text-white'} print:border-gray-400 print:text-black print:bg-white`}>
                    <div className="text-xs font-bold uppercase opacity-80 print:text-gray-600">Rank #{index + 1}</div>
                    <div className="text-lg font-black">{item.crop}</div>
                    <div className="text-sm font-medium mt-1 print:text-gray-800">{item.health_score}% Yield Health</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIONABLE AGRONOMIC INTERVENTIONS */}
          {result && (
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 border-l-8 border-l-yellow-400 print:break-inside-avoid print:border-l-gray-300">
              <h2 className="text-xl font-extrabold mb-5 text-gray-900">Actionable Agronomic Interventions for {crop}</h2>
              <ul className="space-y-4">
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex flex-col bg-gray-50 p-4 rounded-lg border border-gray-200 print:border-none print:p-0">
                    <span className={`text-sm font-black uppercase tracking-wide mb-2 print:text-black ${rec.urgency === 'Critical' ? 'text-red-700' : (rec.urgency === 'High' ? 'text-orange-600' : 'text-yellow-700')}`}>
                      {rec.urgency === 'Critical' ? '🚨' : '⚠️'} {rec.alert} ({rec.urgency})
                    </span>
                    <span className="text-gray-800 text-base font-medium leading-relaxed">{rec.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TARGET CROP METRICS */}
          {result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:break-inside-avoid">
              <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200 border-l-8 border-l-blue-500 print:border-gray-300">
                <div className="text-sm text-gray-700 font-extrabold uppercase tracking-wide mb-1">Projected {crop} Yield Rate</div>
                <div className="text-4xl font-black text-gray-900">{result.projected_yield_mt_ha} <span className="text-xl text-gray-600 font-bold">MT/ha</span></div>
              </div>

              <div className="bg-gray-900 p-5 rounded-xl shadow-md border border-gray-800 print:bg-white print:border-gray-300 print:border-l-8 print:border-l-green-500">
                <div className="text-sm text-gray-400 font-extrabold uppercase tracking-wide mb-1 print:text-gray-700">Total Est. Harvest</div>
                <div className="text-4xl font-black text-green-400 print:text-gray-900">{totalHarvestMT} <span className="text-xl text-gray-500 font-bold print:text-gray-600">MT</span></div>
              </div>
            </div>
          )}

          {/* ACADEMIC VALIDATION */}
          {result && (
            <div className="flex flex-wrap gap-4 text-base bg-blue-50 p-4 rounded-lg border-2 border-blue-200 text-blue-900 font-bold print:hidden print:break-inside-avoid">
              <span>Thesis Validation:</span>
              <span className="bg-white px-2 py-0.5 rounded shadow-sm text-blue-800">R²: {result.model_metrics.R2}</span>
              <span className="bg-white px-2 py-0.5 rounded shadow-sm text-blue-800">RMSE: {result.model_metrics.RMSE}</span>
              <span className="bg-white px-2 py-0.5 rounded shadow-sm text-blue-800">MAE: {result.model_metrics.MAE}</span>
            </div>
          )}

          {/* DYNAMIC CHART */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 print:break-inside-avoid print:border-gray-300">
            <h2 className="text-xl font-extrabold mb-6 text-gray-900">Historical vs. Projected Trajectory ({crop})</h2>
            <div style={{ width: '100%', height: '350px' }} className="print:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1d5db" />
                  <XAxis dataKey="semester" tick={{fill: '#374151', fontSize: 14, fontWeight: 600}} tickMargin={10} />
                  <YAxis tick={{fill: '#374151', fontSize: 14, fontWeight: 600}} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '14px', fontWeight: 'bold' }}/>
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 'bold' }}/>
                  <Line type="monotone" dataKey="actual" stroke="#374151" strokeWidth={4} name="Actual (PSA)" dot={{r: 6}} activeDot={{r: 8}} />
                  <Line type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={4} strokeDasharray="6 6" name="Hybrid Forecast" dot={{r: 6}} activeDot={{r: 8}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}