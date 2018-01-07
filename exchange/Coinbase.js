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

const BASE_URL = "https://api.coinbase.com/v2";
const CRYPTO_CURRENCY_PAIRS = {
  "BTC-USD": "BTC-USD", // Bitcoin
  "ETH-USD": "ETH-USD", // Ethereum
  "BCH-USD": "BCH-USD", // Bitcoin Cash
  "LTC-USD": "LTC-USD" // Litecoin
};

export default class Coinbase extends EventEmitter {
  constructor() {
    super();
    this.apiClient = new ApiClient({ baseUrl: BASE_URL });
    this.interface = Interface(interfaceOptions);
    this.data = [];
  }

  pull = async () => {
    const [error, data] = await to(this.getTicker());
    if (error) {
      console.error("Coinbase Error retrying price update", error);
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
  name: "coinbase",
  currencies: {
    url: options => "https://api.coinbase.com/v2/currencies",
    headers: options => headersFactory()("get"),
    mutateResponseBody: (responseBody, options) =>
      responseBody.data.map(item => item.id)
  },
  prices: {
    url: ({ currencyPair }) => {
      return `https://api.coinbase.com/v2/prices/${currencyPair}/spot`;
    },
    headers: options => {
      const headers = headersFactory()("get");
      headers.headers["CB-VERSION"] = "2017-10-29";
      return headers;
    },
    mutateResponseBody: (responseBody, options) => ({
      ...responseBody.data,
      exchange: "coinbase"
    })
  }
};
