import os
import random
import string

import click
import numpy as np
import pandas as pd

# Code from https://www.quantstart.com/articles/geometric-brownian-motion-simulation-with-python/

class GeometricBrownianMotionAssetSimulator:
    """
    This callable class will generate a daily
    open-high-low-close-volume (OHLCV) based DataFrame to simulate
    asset pricing paths with Geometric Brownian Motion for pricing
    and a Pareto distribution for volume.

    It will output the results to a CSV with a randomly generated
    ticker smbol.

    For now the tool is hardcoded to generate business day daily
    data between two dates, inclusive.

    Note that the pricing and volume data is completely uncorrelated,
    which is not likely to be the case in real asset paths.

    Parameters
    ----------
    start_date : `str`
        The starting date in YYYY-MM-DD format.
    end_date : `str`
        The ending date in YYYY-MM-DD format.
    output_dir : `str`
        The full path to the output directory for the CSV.
    symbol_length : `int`
        The length of the ticker symbol to use.
    init_price : `float`
        The initial price of the asset.
    mu : `float`
        The mean 'drift' of the asset.
    sigma : `float`
        The 'volatility' of the asset.
    pareto_shape : `float`
        The parameter used to govern the Pareto distribution
        shape for the generation of volume data.
    """

    def __init__(
        self,
        start_date,
        end_date,
        output_dir,
        symbol_length,
        init_price,
        mu,
        sigma,
        pareto_shape,
        points_per_candle,
        symbol = ""
    ):
        self.start_date = start_date
        self.end_date = end_date
        self.output_dir = output_dir
        self.symbol_length = symbol_length
        self.init_price = init_price
        self.mu = mu
        self.sigma = sigma
        self.pareto_shape = pareto_shape
        self.points_per_candle = points_per_candle
        self.symbol = symbol
        
    def __call__(self):
        """
        The entrypoint for generating the asset OHLCV frame. Firstly this
        generates a symbol and an empty frame. It then populates this
        frame with some simulated GBM data. The asset volume is then appended
        to this data and finally it is saved to disk as a CSV.
        """
        if self.symbol == "":
            symbol = self._generate_random_symbol()
        else:
            symbol = self.symbol
        data = self._create_empty_frame()
        path = self._create_geometric_brownian_motion(data)
        self._append_path_to_data(data, path)
        self._append_volume_to_data(data)
        self._output_frame_to_dir(symbol, data)
        
    def _generate_random_symbol(self):
        """
        Generates a random ticker symbol string composed of
        uppercase ASCII characters to use in the CSV output filename.

        Returns
        -------
        `str`
            The random ticker string composed of uppercase letters.
        """
        return ''.join(
            random.choices(
                string.ascii_uppercase,
                k=self.symbol_length
            )
        )
    
    def _create_empty_frame(self):
        """
        Creates the empty Pandas DataFrame with a date column using
        business days between two dates. Each of the price/volume
        columns are set to zero.

        Returns
        -------
        `pd.DataFrame`
            The empty OHLCV DataFrame for subsequent population.
        """
        date_range = pd.date_range(
            self.start_date,
            self.end_date,
            freq='B'
        )

        zeros = pd.Series(np.zeros(len(date_range)))

        return pd.DataFrame(
            {
                'date': date_range,
                'open': zeros,
                'high': zeros,
                'low': zeros,
                'close': zeros,
                'volume': zeros
            }
        )[['date', 'open', 'high', 'low', 'close', 'volume']]
        
    def _create_geometric_brownian_motion(self, data):
        """
        Calculates an asset price path using the analytical solution
        to the Geometric Brownian Motion stochastic differential
        equation (SDE).

        This divides the usual timestep by four so that the pricing
        series is four times as long, to account for the need to have
        an open, high, low and close price for each day. These prices
        are subsequently correctly bounded in a further method.

        Parameters
        ----------
        data : `pd.DataFrame`
            The DataFrame needed to calculate length of the time series.

        Returns
        -------
        `np.ndarray`
            The asset price path (four times as long to include OHLC).
        """
        n = len(data)
        T = n / 252.0 # Number of Business days in a year
        dt = T / (self.points_per_candle * n) # The time skip (each day). Using points_per_candle because thats how many points are in each day
        
        # Generate the asset path using vectorization
        asset_path = np.exp(
            (self.mu - self.sigma**2 / 2) * dt +
            self.sigma * np.random.normal(0, np.sqrt(dt), size=(self.points_per_candle*n))
        )
        
        return self.init_price * asset_path.cumprod()
    
    def _append_path_to_data(self, data, path):
        """
        Correctly accounts for the max/min calculations required
        to generate a correct high and low price for a particular
        day's pricing.

        The open price takes every fourth value, while the close
        price takes every fourth value offset by 3 (last value in
        every block of four).

        The high and low prices are calculated by taking the max
        (resp. min) of all four prices within a day and then
        adjusting these values as necessary.

        This is all carried out in place so the frame is not returned
        via the method.

        Parameters
        ----------
        data : `pd.DataFrame`
            The price/volume DataFrame to modify in place.
        path : `np.ndarray`
            The original NumPy array of the asset price path.
        """
        
        data['open'] = path[0::self.points_per_candle]
        data['close'] = path[self.points_per_candle-1::self.points_per_candle]
        
        path_reshaped = path.reshape(len(data), self.points_per_candle)
        
        data['high'] = np.max(path_reshaped, axis=1)
        data['low'] = np.min(path_reshaped, axis=1)
        
        # Store full price paths
        data['price_path'] = [row.tolist() for row in path_reshaped]
        
    def _append_volume_to_data(self, data):
        """
        Utilises a Pareto distribution to simulate non-negative
        volume data. Note that this is not correlated to the
        underlying asset price, as would likely be the case for
        real data, but it is a reasonably effective approximation.

        Parameters
        ----------
        data : `pd.DataFrame`
            The DataFrame to append volume data to, in place.
        """
        data['volume'] = np.array(
            list(
                map(
                    int,
                    np.random.pareto(
                        self.pareto_shape,
                        size=len(data)
                    ) * 1000000.0
                )
            )
        )
        
    def _output_frame_to_dir(self, symbol, data):
        """
        Output the fully-populated DataFrame to disk into the
        desired output directory, ensuring to trim all pricing
        values to two decimal places.

        Parameters
        ----------
        symbol : `str`
            The ticker symbol to name the file with.
        data : `pd.DataFrame`
            The DataFrame containing the generated OHLCV data.
        """
        output_file = os.path.join(self.output_dir, '%s.csv' % symbol)
        data.to_csv(output_file, index=False, float_format='%.2f')
        
if __name__ == "__main__":
    # num_assets = 5
    # random_seed = 41
    
    start_date = '2024-06-01'
    end_date = '2025-08-31'
    output_dir = '/Users/sam/Library/CloudStorage/OneDrive-Personal/Programming/Projects/STEM Fair Stock Market Simulator/python-workshop'
    symbol_length = 4
    init_price = 100.0
    mu = 0.05
    sigma = 0.5
    pareto_shape = 1.5
    points_per_candle = 20;
    
    gbm = GeometricBrownianMotionAssetSimulator(
        start_date,
        end_date,
        output_dir,
        symbol_length,
        init_price,
        mu,
        sigma,
        pareto_shape,
        points_per_candle
    )
    
    gbm.__call__()