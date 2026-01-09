import pandas as pd
import json
import ast

symbol = "UOPP"
input_dir = "/Users/sam/Library/CloudStorage/OneDrive-Personal/Programming/Projects/STEM Fair Stock Market Simulator/python-workshop"
output_dir = "/Users/sam/Library/CloudStorage/OneDrive-Personal/Programming/Projects/STEM Fair Stock Market Simulator/assets"

df = pd.read_csv(f'{input_dir}/{symbol}.csv')
df['isInEvent'] = False
df['price_path'] = df['price_path'].apply(ast.literal_eval)
candles_list = df.to_dict(orient="records")

final_json = {"symbol": symbol, "candles": candles_list}

with open(f'{output_dir}/{symbol}.json', 'w') as f:
    json.dump(final_json, f, indent=4)