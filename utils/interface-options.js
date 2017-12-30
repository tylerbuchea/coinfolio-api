const headersFactory = require("headersfactory");

const InterfaceOptions = {
  bittrex: {
    name: "bittrex",
    currencies: {
      url: options => "https://bittrex.com/api/v1.1/public/getcurrencies",
      headers: options => headersFactory()("get"),
      mutateResponseBody: (responseBody, options) => responseBody
    },
    prices: {
      url: ({ currencyPair }) => {
        return `https://bittrex.com/api/v1.1/public/getticker?market=${currencyPair}`;
      },
      headers: options => headersFactory()("get"),
      mutateResponseBody: (responseBody, { currencyPair }) => {
        const [base, currency] = currencyPair.split("-");
        return {
          base,
          currency,
          amount: responseBody.result.Last
        };
      }
    }
  },
  changelly: {
    name: "changelly",
    apiKey: "",
    currencies: {
      url: options => "https://api.changelly.com",
      headers: ({ currencyPair }) => {
        const [from, to] = currencyPair.split("-");
        const data = {
          id: "1",
          jsonrpc: "2.0",
          method: "getCurrenciesFull",
          params: {}
        };
        return headersFactory()("post", data);
      },
      mutateResponseBody: (responseBody, options) => responseBody
    },
    prices: {
      url: options => "https://api.changelly.com",
      headers: ({ currencyPair }) => {
        const [from, to] = currencyPair.split("-");
        const data = {
          id: "1",
          jsonrpc: "2.0",
          method: "getExchangeAmount",
          params: {
            from: "eth",
            to: "btc",
            amount: "1"
          }
        };
        return headersFactory()("post", data);
      },
      mutateResponseBody: (responseBody, options) => responseBody
    }
  },
  coinbase: {
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
      mutateResponseBody: (responseBody, options) => responseBody.data
    }
  },
  gdax: {
    name: "gdax",
    currencies: {
      url: option => "https://api-public.sandbox.gdax.com/products",
      headers: options => headersFactory()("get"),
      mutateResponseBody: (responseBody, options) =>
        responseBody.map(item => item.id)
    },
    prices: {
      url: ({ currencyPair }) => {
        return `https://api-public.sandbox.gdax.com/products/${currencyPair}/ticker`;
      },
      headers: options => headersFactory()("get"),
      mutateResponseBody: (responseBody, { currencyPair }) => {
        const [base, currency] = currencyPair.split("-");
        return {
          amount: responseBody.bid,
          base,
          currency
        };
      }
    }
  }
};

module.exports = InterfaceOptions;
