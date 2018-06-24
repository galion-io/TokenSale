require('babel-register')
require('babel-polyfill')

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 4 * 1e6,
      gasPrice: 1
    }
  }
};
