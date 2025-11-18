import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd

if __name__ == "__main__":
    directory = "/Users/sam/Library/CloudStorage/OneDrive-Personal/Programming/Projects/STEM Fair Stock Market Simulator/python-workshop"
    symbol_name = "CMYX"
    df = pd.read_csv(f'{directory}/{symbol_name}.csv')
    df['date'] = df['date'].astype("datetime64[s]")
    df = df.set_index('date')
    # df[['open', 'high', 'low', 'close']].plot()
    # plt.show()
    mc = mpf.make_marketcolors(up='green', down='red',
                               edge='inherit', wick='inherit',
                               volume='in', inherit=True)
    s = mpf.make_mpf_style(marketcolors=mc, gridcolor='gray')
    mpf.plot(df, type='candle', volume=True, style=s)