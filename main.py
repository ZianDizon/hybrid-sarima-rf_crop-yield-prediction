from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.ensemble import RandomForestRegressor
import warnings

warnings.filterwarnings('ignore')

app = FastAPI(title="Hybrid SARIMA-RF Agrometeorological API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# 1. LIVE TRAINING ON STARTUP
# ---------------------------------------------------------
print("Reading dataset and training crop-specific Hybrid models...")
df = pd.read_csv("Rizal_Semestral_Trio_Data.csv")

crop_configs = {
    "Cassava": {"features": ['TMAX', 'TMIN', 'RH'], "order": (1, 1, 1), "seasonal": (1, 1, 0, 2), "depth": 2},
    "Ginger": {"features": ['RAINFALL', 'TMAX', 'TMIN', 'RH'], "order": (1, 0, 0), "seasonal": (1, 0, 0, 2),
               "depth": 4},
    "Camote": {"features": ['TMAX', 'TMIN', 'RH'], "order": (0, 0, 1), "seasonal": (0, 1, 1, 2), "depth": 3}
}

sarima_models = {}
rf_models = {}

for crop, config in crop_configs.items():
    crop_df = df[df['Crop'].str.contains(crop, case=False, na=False)].sort_values(['Year', 'Semester']).reset_index(
        drop=True)
    y = crop_df['Yield_MT_per_Ha'].values
    X = crop_df[config['features']].values

    sarima = SARIMAX(y, order=config['order'], seasonal_order=config['seasonal'],
                     enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
    sarima_models[crop] = sarima

    preds = sarima.predict(start=0, end=len(y) - 1)
    residuals = y - preds

    rf = RandomForestRegressor(n_estimators=100, max_depth=config['depth'], random_state=42)
    rf.fit(X, residuals)
    rf_models[crop] = rf

print("All models trained successfully! System is ready for live inference.")


class ForecastRequest(BaseModel):
    crop: str
    rainfall: float
    tmax: float
    tmin: float
    rh: float


def generate_recommendations(crop: str, rainfall: float, tmax: float):
    interventions = []
    if rainfall > 1500:
        interventions.append({
            "alert": "High Waterlogging Risk",
            "action": "Immediate field drainage adjustments required. Elevate planting ridges to prevent tuber/rhizome rot.",
            "urgency": "Critical"
        })
    elif rainfall < 600:
        interventions.append({
            "alert": "Osmotic Stress / Soil Hardening",
            "action": "Apply straw mulching to conserve soil moisture. Schedule supplementary irrigation during early establishment.",
            "urgency": "High"
        })

    if tmax > 33.0:
        interventions.append({
            "alert": "Extreme Heat Stress",
            "action": "Shift harvesting schedules to early morning to prevent immediate post-harvest desiccation.",
            "urgency": "Moderate"
        })

    if not interventions:
        interventions.append({
            "alert": "Optimal Conditions",
            "action": "Maintain standard seasonal planting and harvesting calendars.",
            "urgency": "Normal"
        })
    return interventions


# ---------------------------------------------------------
# 2. FORECASTING ENDPOINT
# ---------------------------------------------------------
@app.post("/api/forecast")
def get_forecast(request: ForecastRequest):
    target_crop = "Cassava"
    if "Ginger" in request.crop:
        target_crop = "Ginger"
    elif "Camote" in request.crop:
        target_crop = "Camote"

    config = crop_configs[target_crop]
    baseline_yield = sarima_models[target_crop].forecast(steps=1)[0]

    user_inputs = {
        'RAINFALL': request.rainfall,
        'TMAX': request.tmax,
        'TMIN': request.tmin,
        'RH': request.rh
    }
    input_features = np.array([[user_inputs[feat] for feat in config['features']]])

    residual_correction = rf_models[target_crop].predict(input_features)[0]
    final_yield = baseline_yield + residual_correction
    if final_yield < 0: final_yield = 0.0

    metrics = {
        "Cassava": {"R2": "90.4%", "RMSE": "0.71", "MAE": "0.54"},
        "Ginger": {"R2": "13.5%", "RMSE": "2.63", "MAE": "2.15"},
        "Camote": {"R2": "-33.9%", "RMSE": "4.89", "MAE": "3.24"}
    }

    recommendations = generate_recommendations(target_crop, request.rainfall, request.tmax)

    return {
        "crop": target_crop,
        "projected_yield_mt_ha": round(final_yield, 2),
        "model_metrics": metrics[target_crop],
        "recommendations": recommendations
    }


# ---------------------------------------------------------
# 3. LIVE CSV HISTORY ENDPOINT
# ---------------------------------------------------------
@app.get("/api/history/{crop_name}")
def get_history(crop_name: str):
    target_crop = "Cassava"
    if "Ginger" in crop_name:
        target_crop = "Ginger"
    elif "Camote" in crop_name:
        target_crop = "Camote"

    # Read directly from the CSV DataFrame loaded in memory
    crop_df = df[df['Crop'].str.contains(target_crop, case=False, na=False)].sort_values(['Year', 'Semester'])

    # Grab the last 8 semesters for a clean chart
    recent_df = crop_df.tail(8)

    history = []
    for _, row in recent_df.iterrows():
        history.append({
            "semester": f"{int(row['Year'])} {row['Semester']}",
            "actual": round(float(row['Yield_MT_per_Ha']), 2)
        })

    return {"history": history}


# ---------------------------------------------------------
# 4. CROP RECOMMENDATION ENDPOINT
# ---------------------------------------------------------
class RecommendRequest(BaseModel):
    rainfall: float
    tmax: float


@app.post("/api/recommend")
def get_recommendation(request: RecommendRequest):
    results = []

    # Historical baselines to calculate how well the crop is surviving the weather
    baselines = {"Cassava": 11.5, "Ginger": 4.2, "Camote": 11.8}

    for crop in ["Cassava", "Ginger", "Camote"]:
        config = crop_configs[crop]
        baseline_yield = sarima_models[crop].forecast(steps=1)[0]

        user_inputs = {
            'RAINFALL': request.rainfall,
            'TMAX': request.tmax,
            'TMIN': 22.0,
            'RH': 85.0
        }
        input_features = np.array([[user_inputs[feat] for feat in config['features']]])

        residual_correction = rf_models[crop].predict(input_features)[0]
        final_yield = baseline_yield + residual_correction
        if final_yield < 0: final_yield = 0.0

        # Calculate survival rate (Projected Yield vs Normal Historical Yield)
        health_percentage = (final_yield / baselines[crop]) * 100

        results.append({
            "crop": crop,
            "projected_yield": round(final_yield, 2),
            "health_score": round(health_percentage, 1)
        })

    # Sort crops by health score (highest survival rate first)
    ranked_crops = sorted(results, key=lambda x: x['health_score'], reverse=True)

    return {"ranking": ranked_crops}