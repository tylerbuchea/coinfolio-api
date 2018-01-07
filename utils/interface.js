const { to } = require("await-to-js");
const fetch = require("node-fetch");
const headersFactory = require("headersfactory");

function Interface(exchangeOptions) {
  return endpoint => ({
    async get(options = null) {
      const { headers, mutateResponseBody, url } = exchangeOptions[endpoint];

      const [error1, response] = await to(
        fetch(url(options), headers(options))
      );
      if (error1) {
        throw error1;
      }

      const [error2, responseBody] = await to(response.json());
      if (error2) {
        throw error2;
      }
      // checkResponseBody(responseBody, options); // for 200s with error responses, etc.

      const mutatedData = mutateResponseBody(responseBody, options);

      return mutatedData;
    }
  });
}

module.exports = Interface;
