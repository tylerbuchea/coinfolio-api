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
  "LTC-USD": "XLTCZUSD" // Litecoin
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
      console.error(error);
    } else {
      const oldData = _.cloneDeep(this.data);
      this.data = _.differenceWith(data, oldData, _.isEqual);
      if (this.data.length) this.emit("message", this.data);
    }
    setTimeout(this.pull, 1000);
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
