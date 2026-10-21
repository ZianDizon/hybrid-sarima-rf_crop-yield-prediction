from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime
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
# 1. LIVE TRAINING ON STARTUP & ACAP DA RULES
# ---------------------------------------------------------
print("Reading dataset and training crop-specific Hybrid models...")
df = pd.read_csv("Rizal_Semestral_Trio_Data.csv")

# Updated exactly to match the Optimized Machine Learning Configurations
crop_configs = {
    "Cassava": {
        "features": ['RAINFALL', 'TMAX', 'TMIN', 'RH'],
        "order": (1, 1, 1), "seasonal": (0, 1, 1, 2), "depth": 2
    },
    "Ginger": {
        "features": ['RAINFALL', 'TMAX', 'TMIN', 'RH'],
        "order": (0, 0, 1), "seasonal": (1, 0, 0, 2), "depth": 4
    },
    "Camote": {
        "features": ['TMAX', 'TMIN', 'RH'],
        "order": (1, 0, 1), "seasonal": (1, 1, 0, 2), "depth": 3
    }
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

AGRONOMIC_RULES = {
    "Cassava": {
        "Above_Normal_Rainfall": {
            "varieties": ["Golden Yellow", "Lakan 1"],
            "interventions": [
                {"alert": "High Waterlogging Risk", "action": "Construct deep drainage canals to prevent tuber rot.",
                 "urgency": "Critical"},
                {"alert": "Water Management", "action": "Plant on elevated ridges/mounds rather than flat ground.",
                 "urgency": "High"},
                {"alert": "Harvest Adjustment",
                 "action": "Harvest early if continuous heavy rain is forecasted before maturity.",
                 "urgency": "Moderate"}
            ]
        },
        "Below_Normal_Rainfall": {
            "varieties": ["Rayong 5", "Datu 1"],
            "interventions": [
                {"alert": "Osmotic Stress", "action": "Apply organic mulching to retain soil moisture.",
                 "urgency": "High"},
                {"alert": "Soil Management",
                 "action": "Practice shallow cultivation to break capillary pores and reduce evaporation.",
                 "urgency": "Moderate"},
                {"alert": "Planting Schedule", "action": "Delay planting until the stable onset of the monsoon.",
                 "urgency": "Normal"}
            ]
        }
    },
    "Camote": {
        "Above_Normal_Rainfall": {
            "varieties": ["Inmitlog", "Taiwan", "Ube-ube"],
            "interventions": [
                {"alert": "Aeration Required",
                 "action": "Construct raised beds (at least 30-40cm high) to improve soil aeration.",
                 "urgency": "High"},
                {"alert": "Field Sanitation",
                 "action": "Clear field borders of weeds to prevent water stagnation and pest breeding.",
                 "urgency": "Moderate"},
                {"alert": "Fertilizer Adjustment",
                 "action": "Avoid applying nitrogen-heavy fertilizers which promote vines over tubers in wet conditions.",
                 "urgency": "Normal"}
            ]
        },
        "Below_Normal_Rainfall": {
            "varieties": ["VSP 6", "PSB SP 17", "Superako"],
            "interventions": [
                {"alert": "Water Scarcity",
                 "action": "Utilize drip irrigation or alternate-furrow irrigation if water is scarce.",
                 "urgency": "Critical"},
                {"alert": "Moisture Retention", "action": "Apply crop residues as mulch immediately after planting.",
                 "urgency": "High"},
                {"alert": "Soil Conditioning",
                 "action": "Incorporate organic matter during land prep to improve water-holding capacity.",
                 "urgency": "Moderate"}
            ]
        }
    },
    "Ginger": {
        "Above_Normal_Rainfall": {
            "varieties": ["Imugan", "Native"],
            "interventions": [
                {"alert": "Severe Rot Risk",
                 "action": "Plant on raised beds and ensure strict field drainage (Ginger is highly susceptible to rhizome rot).",
                 "urgency": "Critical"},
                {"alert": "Fungal Prevention",
                 "action": "Apply Trichoderma-based fungicides to soil to prevent fungal infections from waterlogging.",
                 "urgency": "High"},
                {"alert": "Spacing Adjustment",
                 "action": "Avoid dense planting to allow air circulation and reduce humidity at the base.",
                 "urgency": "Moderate"}
            ]
        },
        "Below_Normal_Rainfall": {
            "varieties": ["Hawaiian", "Imugan"],
            "interventions": [
                {"alert": "Heat Protection",
                 "action": "Apply thick organic mulch (coconut leaves or rice straw) to protect shallow rhizomes from heat.",
                 "urgency": "High"},
                {"alert": "Shading Required",
                 "action": "Provide artificial shading (e.g., intercropping with taller crops like maize or cassava).",
                 "urgency": "Moderate"},
                {"alert": "Irrigation Alert",
                 "action": "Ensure consistent light irrigation; ginger rhizomes will crack under severe drought.",
                 "urgency": "Critical"}
            ]
        }
    }
}


def get_dynamic_forecast_target():
    current_year = datetime.now().year
    current_month = datetime.now().month

    target_semester = "S2" if current_month >= 7 else "S1"
    target_year = current_year

    base_year = 2024
    base_sem = 2

    year_diff = target_year - base_year
    steps = year_diff * 2

    if target_semester == "S1" and base_sem == 2:
        steps -= 1
    elif target_semester == "S2" and base_sem == 1:
        steps += 1

    return target_year, target_semester, max(1, steps)


class ForecastRequest(BaseModel):
    crop: str
    rainfall: float
    tmax: float
    tmin: float
    rh: float


def generate_acap_recommendations(crop: str, rainfall: float):
    condition = "Above_Normal_Rainfall" if rainfall > 1200 else "Below_Normal_Rainfall"
    return AGRONOMIC_RULES.get(crop, {}).get(condition, {})


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

    target_year, target_semester, steps_ahead = get_dynamic_forecast_target()
    config = crop_configs[target_crop]

    # Corrected .iloc[-1] to [-1] for NumPy arrays
    baseline_yield = sarima_models[target_crop].forecast(steps=steps_ahead)[-1]

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

    # Metrics updated based on the actual 70/30 split results
    metrics = {
        "Cassava": {"R2": "87.53%", "RMSE": "0.84", "MAE": "0.69"},
        "Ginger": {"R2": "0.28%", "RMSE": "2.63", "MAE": "2.01"},
        "Camote": {"R2": "56.50%", "RMSE": "3.53", "MAE": "2.62"}
    }

    recommendations = generate_acap_recommendations(target_crop, request.rainfall)

    return {
        "crop": target_crop,
        "target_semester_label": f"{target_year} {target_semester}",
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

    crop_df = df[df['Crop'].str.contains(target_crop, case=False, na=False)].sort_values(['Year', 'Semester'])
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
    baselines = {"Cassava": 11.5, "Ginger": 4.2, "Camote": 11.8}
    _, _, steps_ahead = get_dynamic_forecast_target()

    for crop in ["Cassava", "Ginger", "Camote"]:
        config = crop_configs[crop]

        # Corrected .iloc[-1] to [-1] for NumPy arrays
        baseline_yield = sarima_models[crop].forecast(steps=steps_ahead)[-1]

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

        health_percentage = (final_yield / baselines[crop]) * 100

        results.append({
            "crop": crop,
            "projected_yield": round(final_yield, 2),
            "health_score": round(health_percentage, 1)
        })

    ranked_crops = sorted(results, key=lambda x: x['health_score'], reverse=True)
    return {"ranking": ranked_crops}