import EventEmitter from "events";
import Gdax from "./Gdax";
import Poloniex from "./Poloniex";
import Kraken from "./Kraken";
import Coinbase from "./Coinbase";
import Bitstamp from "./Bitstamp";
import CoinmarketCap from "./CoinmarketCap";
import _ from "lodash";

import { cryptoCurrencyMap } from "../utils/prices";
import { VALID_PERIODS } from "../utils/period";
import redis from "../db/redis";

class Exchange extends EventEmitter {
  constructor() {
    super();
    this.gdax = new Gdax();
    this.coinbase = new Coinbase();
    this.bitstamp = new Bitstamp();
    this.poloniex = new Poloniex();
    this.kraken = new Kraken();
    this.coinmarketcap = new CoinmarketCap();
    this.cache = { initial: {} };
  }

  connect = () => {
    this.gdax.connect();
    this.gdax.on("message", data => {
      this.updateCacheAndEmit(data);
    });

    this.poloniex.connect();
    this.poloniex.on("message", data => {
      const currency = data.cryptoCurrency;
      if (!cryptoCurrencyMap[currency].hasNativeCurrency) {
        data.price = this.convert(data.price, currency, this.prices);
      }
      this.updateCacheAndEmit(data);
    });

    this.kraken.connect();
    this.kraken.on("message", data => {
      this.updateCacheAndEmit(data);
    });

    this.coinbase.connect();
    this.coinbase.on("message", data => {
      this.updateCacheAndEmit(data);
    });

    this.bitstamp.connect();
    this.bitstamp.on("message", data => {
      this.updateCacheAndEmit(data);
    });
  };

  getMarketData = async () => {
    const marketData = {};
    const cmcData = await this.coinmarketcap.getMarketData();
    for (let market of cmcData) {
      marketData[market.symbol] = {
        marketCap: parseFloat(market["market_cap_usd"]),
        "24hVolume": parseFloat(market["24h_volume_usd"]),
        availableSupply: parseFloat(market["available_supply"]),
        totalSupply: parseFloat(market["total_supply"])
      };
    }

    return marketData;
  };

  getPrices = async period => {
    let prices = {};

    const [poloPrices, gdaxPrices] = await Promise.all([
      this.poloniex.getPrices(period),
      this.gdax.getPrices(period)
    ]);

    for (let currency in cryptoCurrencyMap) {
      switch (cryptoCurrencyMap[currency].exchange) {
        case "gdax":
          prices[currency] = gdaxPrices[currency];
          break;
        case "poloniex":
          prices[currency] = poloPrices[currency];
          break;
      }
    }

    for (let currency in cryptoCurrencyMap) {
      if (cryptoCurrencyMap[currency].hasNativeCurrency) {
        continue;
      }

      const converted = [];
      prices[currency].forEach(rate => {
        converted.push(this.convert(rate, currency, prices));
      });

      prices[currency] = converted;
    }
    this.prices = this.formatPrices(prices);

    return this.prices;
  };

  updateCache = data => {
    const cache = _.clone(this.cache);
    const exchangePrices = _.merge(cache.initial, {
      ...data.reduce((currator = {}, current) => {
        currator[current.exchange] = currator[current.exchange] || {};
        currator[current.exchange][current.base] = {
          amount: current.amount
        };
        return currator;
      }, {})
    });

    this.cache = { initial: exchangePrices };
  };

  updateCacheAndEmit = async data => {
    let emitted = false;

    // Just emit the other exchanges that we don't use
    // for populating the graphs
    // Maybe we'll add a day only chart for each exchange in the future
    // api-prices-day-[exchange]
    if (Array.isArray(data)) {
      this.updateCache(data);
      this.emit("message", data);
      emitted = true;
      return;
    } else {
      const formattedData = [
        {
          amount: data.price,
          base: data.cryptoCurrency,
          exchange: data.exchange
        }
      ];
      this.updateCache(formattedData);
      this.emit("message", formattedData);
    }

    for (let period of VALID_PERIODS) {
      const key = `api-prices-${period}`;
      try {
        const prices = JSON.parse(await redis.getAsync(key));
        if (!prices) return;

        const updatePrices = prices[data.cryptoCurrency];
        if (!updatePrices) return;

        if (updatePrices.slice(-1)[0] !== data.price) {
          const index = updatePrices.length - 1;
          updatePrices[index] = data.price;
          prices[data.cryptoCurrency] = updatePrices;
          await redis.setAsync(key, JSON.stringify(prices));
          if (!emitted) {
            this.emit("message", data);
            emitted = true;
          }
        }
      } catch (e) {
        console.log("Websocket cache update failed.");
        console.log(e);
      }
    }
  };

  updateAllCache = async period => {
    try {
      const [prices, markets] = await Promise.all([
        this.getPrices(period),
        this.getMarketData()
      ]);

      await redis.setAsync(`api-prices-${period}`, JSON.stringify(prices));
      await redis.setAsync("api-markets", JSON.stringify(markets));
    } catch (e) {
      console.log("Cache update failed.");
      console.log(e);
    }
  };

  formatPrices = prices => {
    for (let currency in prices) {
      let formatted = [];
      for (let rate of prices[currency]) {
        formatted.push(parseFloat(rate));
      }
      prices[currency] = formatted;
    }
    return prices;
  };

  convert = (amount, currency, prices) => {
    const intCurrency = cryptoCurrencyMap[currency].intermediateCurrency;
    // Use the last rate
    const intRate = prices[intCurrency].slice(-1)[0];
    return intRate * amount;
  };
}

export default Exchange;
