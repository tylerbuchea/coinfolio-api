import WebSocket from "websocket";
import ReconnectingWebsocket from "reconnecting-websocket";
import headersFactory from "headersfactory";
import EventEmitter from "events";
import _ from "lodash";
import { to } from "await-to-js";

import ApiClient from "./ApiClient";
import { convertPeriod, sleep } from "../utils/period";
import redis from "../db/redis";
import Interface from "../utils/interface";

const BASE_URL = "https://api.kraken.com/0/public";
const CRYPTO_CURRENCY_PAIRS = {
  "BTC-USD": "XXBTZUSD", // Bitcoin
  "ETH-USD": "XETHZUSD", // Ethereum
  "BCH-USD": "BCHUSD", // Bitcoin Cash
  "LTC-USD": "XLTCZUSD", // Litecoin
  "XRP-USD": "XXRPZUSD", // Ripple Coin
  // BCHEUR: 'BCHEUR',
  // BCHUSD: 'BCHUSD',
  // BCHXBT: 'BCHXBT',
  // DASHEUR: 'DASHEUR',
  "DASH-USD": "DASHUSD",
  // DASHXBT: 'DASHXBT',
  // EOSETH: 'EOSETH',
  // EOSXBT: 'EOSXBT',
  // GNOETH: 'GNOETH',
  // GNOXBT: 'GNOXBT',
  // USDTZUSD: 'USDTZUSD',
  // XETCXETH: 'XETCXETH',
  // XETCXXBT: 'XETCXXBT',
  // XETCZEUR: 'XETCZEUR',
  "ETC-USD": "XETCZUSD",
  // XETHXXBT: 'XETHXXBT',
  // 'XETHXXBT.d': 'XETHXXBT.d',
  // XETHZCAD: 'XETHZCAD',
  // 'XETHZCAD.d': 'XETHZCAD.d',
  // XETHZEUR: 'XETHZEUR',
  // 'XETHZEUR.d': 'XETHZEUR.d',
  // XETHZGBP: 'XETHZGBP',
  // 'XETHZGBP.d': 'XETHZGBP.d',
  // XETHZJPY: 'XETHZJPY',
  // 'XETHZJPY.d': 'XETHZJPY.d',
  // XETHZUSD: 'XETHZUSD',
  // 'XETHZUSD.d': 'XETHZUSD.d',
  // XICNXETH: 'XICNXETH',
  // XICNXXBT: 'XICNXXBT',
  // XLTCXXBT: 'XLTCXXBT',
  // XLTCZEUR: 'XLTCZEUR',
  // XLTCZUSD: 'XLTCZUSD',
  // XMLNXETH: 'XMLNXETH',
  // XMLNXXBT: 'XMLNXXBT',
  // XREPXETH: 'XREPXETH',
  // XREPXXBT: 'XREPXXBT',
  // XREPZEUR: 'XREPZEUR',
  // XXBTZCAD: 'XXBTZCAD',
  // 'XXBTZCAD.d': 'XXBTZCAD.d',
  // XXBTZEUR: 'XXBTZEUR',
  // 'XXBTZEUR.d': 'XXBTZEUR.d',
  // XXBTZGBP: 'XXBTZGBP',
  // 'XXBTZGBP.d': 'XXBTZGBP.d',
  // XXBTZJPY: 'XXBTZJPY',
  // 'XXBTZJPY.d': 'XXBTZJPY.d',
  // XXBTZUSD: 'XXBTZUSD',
  // 'XXBTZUSD.d': 'XXBTZUSD.d',
  // XXDGXXBT: 'XXDGXXBT',
  // XXLMXXBT: 'XXLMXXBT',
  // XXMRXXBT: 'XXMRXXBT',
  // XXMRZEUR: 'XXMRZEUR',
  "XMR-USD": "XXMRZUSD",
  // XXRPXXBT: 'XXRPXXBT',
  // XXRPZEUR: 'XXRPZEUR',
  // XXRPZUSD: 'XXRPZUSD',
  // XZECXXBT: 'XZECXXBT',
  // XZECZEUR: 'XZECZEUR',
  "ZEC-USD": "XZECZUSD"
};

export default class Kraken extends EventEmitter {
  constructor() {
    super();
    this.apiClient = new ApiClient({ baseUrl: BASE_URL });
    this.interface = Interface(interfaceOptions);
    this.data = [];
  }

  pull = async () => {
    const [error, data] = await to(this.getTicker());
    if (error) {
      console.error("Kraken Error retrying price update", error);
    } else {
      const oldData = _.cloneDeep(this.data);
      this.data = _.differenceWith(data, oldData, _.isEqual);
      if (this.data.length) this.emit("message", this.data);
    }
    setTimeout(this.pull, 2000);
  };

  connect = () => {
    this.pull();
  };

  getTicker = async () => {
    const [errors, data] = await to(
      Promise.all([
        ...Object.keys(CRYPTO_CURRENCY_PAIRS).map(currencyPair =>
          this.interface("prices").get({ currencyPair })
        )
      ])
    );
    if (errors) throw errors;

    return data;
  };
}

const interfaceOptions = {
  name: "kraken",
  currencies: {
    url: options => "https://api.kraken.com/0/public/AssetPairs",
    headers: options => headersFactory()("get"),
    mutateResponseBody: (responseBody, options) => {
      return Object.keys(responseBody.result);
    }
  },
  prices: {
    url: ({ currencyPair }) => {
      const pair = CRYPTO_CURRENCY_PAIRS[currencyPair];
      return `https://api.kraken.com/0/public/Ticker?pair=${pair}`;
    },
    headers: options => headersFactory()("get"),
    mutateResponseBody: (responseBody, { currencyPair }) => {
      const [base, currency] = currencyPair.split("-");
      return {
        exchange: "kraken",
        base,
        currency,
        amount: responseBody.result[Object.keys(responseBody.result)[0]].b[0]
      };
    }
  },
  time: {
    url: options => "https://api.kraken.com/0/public/Time",
    headers: options => headersFactory()("get"),
    mutateResponseBody: (responseBody, options) => responseBody
  }
};
