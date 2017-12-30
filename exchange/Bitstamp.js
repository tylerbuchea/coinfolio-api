import WebSocket from "websocket";
import ReconnectingWebsocket from "reconnecting-websocket";
import headersFactory from "headersfactory";
import EventEmitter from "events";
import _ from "lodash";
import { to } from "await-to-js";
import Pusher from "pusher-js";

import ApiClient from "./ApiClient";
import { convertPeriod, sleep } from "../utils/period";
import redis from "../db/redis";
import Interface from "../utils/interface";

const BASE_URL = "https://www.bitstamp.net/api/v2";
const WS_URL = "wss://www.bitstamp.net";
const CRYPTO_CURRENCY_PAIRS = {
  // 'BTC-EUR': 'btceur',
  // 'EUR-USD': 'eurusd',
  // 'XRP-USD': 'xrpusd',
  // 'XRP-EUR': 'xrpeur',
  // 'XRP-BTC': 'xrpbtc',
  // 'BTC-USD': 'btcusd',
  "LTC-USD": "ltcusd",
  // 'LTC-EUR': 'ltceur',
  // 'LTC-BTC': 'ltcbtc',
  "ETH-USD": "ethusd"
  // 'ETH-EUR': 'etheur',
  // 'ETH-BTC': 'ethbtc',
  // 'BCH-USD': 'bchusd',
  // 'BCH-EUR': 'bcheur',
  // 'BCH-BTC': 'bchbtc',
};

export default class Bitstamp extends EventEmitter {
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

  pullWebSocket = () => {
    const pusher = new Pusher("de504dc5763aeef9ff52", { cluster: "mt1" });
    // pusher.allChannels().forEach(channel => console.log(channel.name));
    const channel = pusher.subscribe("live_trades");
    channel.bind("trade", data => {
      console.log("bistamp-data", data);
    });

    // const options = { constructor: WebSocket.w3cwebsocket };
    // this.websocket = new ReconnectingWebsocket(WS_URL, null, options);

    // this.websocket.addEventListener('open', () => {
    //   this.websocket.send(
    //     JSON.stringify({
    //       type: 'subscribe',
    //       product_ids: CRYPTO_CURRENCY_PAIRS,
    //     })
    //   );
    // });

    // this.websocket.addEventListener('message', message => {
    //   const data = JSON.parse(message.data);
    //   if (data.type === 'match') {
    //     const cryptoCurrency = data.product_id.split('-')[0];
    //     const price = parseFloat(data.price);
    //     if (price) {
    //       this.emit('message', { cryptoCurrency, price });
    //     }
    //   }
    // });
  };

  connect = () => {
    // this.pull(); // for long pulling from REST Api
    // this.pullWebSocket();
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
  name: "bitstamp",
  currencies: {
    url: options => "https://www.bitstamp.net/api/v2/currencies",
    headers: options => headersFactory()("get"),
    mutateResponseBody: (responseBody, options) =>
      responseBody.data.map(item => item.id)
  },
  prices: {
    url: ({ currencyPair }) => {
      const pair = CRYPTO_CURRENCY_PAIRS[currencyPair];
      return `https://www.bitstamp.net/api/v2/ticker/${pair}`;
    },
    headers: options => {
      const headers = headersFactory()("get");
      return headers;
    },
    mutateResponseBody: (responseBody, { currencyPair }) => ({
      price: responseBody.last,
      base: currencyPair.split("-")[0],
      currency: currencyPair.split("-")[1],
      exchange: "bitstamp"
    })
  }
};
