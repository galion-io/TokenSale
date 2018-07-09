# Galion token sale smart contracts

## How to test

Make sure you have testrpc installed, then start it.
```
$> npm install -g ganache-cli
$> ganache-cli -e 100000000
```

Make sure you have an up-to-date truffle & solidity compiler installed
```
$> npm uninstall -g truffle
$> npm uninstall -g solc

$> npm install -g truffle
```

Install dependencies
```
$> npm install
```

Run tests :
```
$> truffle test test/GalionTokenSale.test.js
```
