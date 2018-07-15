const GalionTokenSaleContract = artifacts.require('./contracts/GalionTokenSale.sol');
const GalionTokenContract = artifacts.require('./contracts/GalionToken.sol');
const TokenTimelockContract = artifacts.require('./contracts/OpenZeppelin/TokenTimelock.sol');

const ETH = 1e+18;
const GLN = 1e+18;
const BONUS = 0.3;
// setting the eth price to 95 000 $ will set the hard cap to 100 eth which will be easy to test
const ETH_PRICE = 95000;
const INDIVIDUAL_CAP = 60;
const COMPANY_ADDRESS = "0x849F14948588d2bDe7a3ff68DE9269b2160483C1";
const ADVISORY_ADDRESS = "0x5a2a667f7A416D4660a7464c6C555F0Ecb328e2a";
const FOUNDER_1_ADDRESS = "0x4933916d10ab8225a33f3a8bae7cf1a8aa316068";

contract('GalionToken', function ([owner, whitelistedInPresale, whitelistedInPause, whitelistedInSafeMainSale, whitelistedInMainsale, notWhitelisted, contributor]) {
    let contract;
    let token;
    let timelock;

    var setContractToPausePhase = async function () {
        // during the presale, can only set the ether price once, does not set is if buy price already set
        if (await contract.baseBuyPrice() == 0) {
            await contract.setEthPrice(ETH_PRICE);
        }
        await contract.setPhase(1);
        await contract.addToWhitelist([whitelistedInPause]);
    }

    var setContractToSafeMainSale = async function () {
        await setContractToPausePhase();
        await contract.setIndividualWeiCap(INDIVIDUAL_CAP * ETH);
        await contract.setPhase(2);
        await contract.addToWhitelist([whitelistedInSafeMainSale]);
    }

    var setContractToMainSale = async function () {
        await setContractToSafeMainSale();
        // set the time in 12 hours and 1 sec
        web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [(3600 * 12) + 1],
            id: 12345
        }, function (err, result) {});
        await contract.setPhase(3);
        await contract.addToWhitelist([whitelistedInMainsale]);
    }

    var setContractToTGEOver = async function (softCapReached) {
        await setContractToMainSale();

        if (softCapReached) {
            // contribute 30 eth to the contract to be over the soft cap
            await contract.sendTransaction({
                value: 50 * ETH,
                from: whitelistedInPresale
            });
        } else {
            // contribute 10 eth to the contract to be under the soft cap
            await contract.sendTransaction({
                value: 10 * ETH,
                from: whitelistedInPresale
            });
        }
        // set the time in 12 hours and 1 sec
        web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [(3600 * 24 * 21) + 1],
            id: 12345
        }, function (err, result) {});

        await contract.setPhase(4);
    }

    beforeEach('setup contract for each test', async function () {
        contract = await GalionTokenSaleContract.new();
        token = await GalionTokenContract.at(await contract.token());
        // contributor "whitelistedInPresale" is whitelisted for each tests
        await contract.addToWhitelist([whitelistedInPresale]);
    });

    describe('Set-up', async function () {
        it('should deploy sale contract properly', async function () {
            assert.equal(await contract.owner(), owner);
        });

        it('should deploy token contract properly', async function () {
            assert.equal(await token.owner(), await contract.address);
        });

        it('should deploy with supply equals to 0', async function () {
            assert.equal(await token.totalSupply(), 0);
        });

        it('should have 18 decimals', async function () {
            assert.equal(await token.decimals(), 18);
        });

        it('should have "GLN" symbol', async function () {
            assert.equal(await token.symbol(), 'GLN');
        });

        it('should have "Galion Token" name', async function () {
            assert.equal(await token.name(), 'Galion Token');
        });

        it('should not be tradable at first (not activated)', async function () {
            assert.equal(await token.activated(), false);
        });



        it('should deploy with the phase equals to 0', async function () {
            assert.equal(await contract.getCurrentPhase(), 0);
        });
    });

    describe('Owner only functions', async function () {
        it('should not be able to set the buy price if not the owner', async function () {
            try {
                await contract.setEthPrice(5000, {
                    from: contributor
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not be able to activate the token if not the owner', async function () {
            await setContractToTGEOver(softCapReached = true);

            try {
                await contract.activateToken({
                    from: contributor
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not be able to set the individual wei cap if not the owner', async function () {
            await contract.setPhase(1);
            try {
                await contract.setIndividualWeiCap(1 * ETH, {
                    from: contributor
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not be able to set the phase if not the owner', async function () {
            try {
                await contract.setPhase(1, {
                    from: contributor
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not be able to whitelist an address price if not the owner', async function () {
            try {
                await contract.addToWhitelist([notWhitelisted], {
                    from: contributor
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
                assert.equal(await contract.checkWhitelisted(notWhitelisted), false);
            }
        });

        it('should not be able to remove from whitelist if not the owner', async function () {
            try {
                await contract.removeFromWhitelist([whitelistedInPresale], {
                    from: contributor
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
                assert.equal(await contract.checkWhitelisted(whitelistedInPresale), true);
            }
        });
    });

    describe('Presale', async function () {
        it('Timelock address for a contributor must be address(0) until he contributes', async function () {
            var addr = await contract.getTimelockContractAddress([contributor]);
            assert.equal(addr, '0x0000000000000000000000000000000000000000');
        });

        it('SHould be able to set the eth price in dollar', async function () {
            await contract.setEthPrice(ETH_PRICE);
            var weiHardCap = await contract.weiHardCap();
            // the hardcap is the amount of wei needed to raise 9 500 000 $
            assert.equal(weiHardCap, (9500000 / ETH_PRICE) * ETH);
            // the soft cap is 26% of the hardcap
            assert.equal(await contract.weiSoftCap(), weiHardCap * 0.26);
            // the presale cap is 80% of the hardcap
            assert.equal(await contract.weiPresaleCap(), weiHardCap * 0.8);
            // the tokenBuyPrice is set using the value 0.05$ / token
            assert.equal(await contract.baseBuyPrice(), ETH_PRICE / 0.05);
        });

        it('Should not be able to set the eth price two times', async function () {
            await contract.setEthPrice(ETH_PRICE);
            try {

                await contract.setEthPrice(10);
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('Should not be able to set the eth price to 0', async function () {
            try {

                await contract.setEthPrice(0);
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow to add people to the whitelist', async function () {
            await contract.addToWhitelist([contributor]);
            assert.equal(await contract.checkWhitelisted(contributor), true);
        });

        it('should allow to remove people from the whitelist', async function () {
            await contract.addToWhitelist([contributor]);
            assert.equal(await contract.checkWhitelisted(contributor), true);

            await contract.removeFromWhitelist([contributor]);
            assert.equal(await contract.checkWhitelisted(contributor), false);
        });

        it('should not allow to mint tokens if buy price isn\'t set', async function () {
            try {
                await contract.sendTransaction({
                    value: 1 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not accept funds from people not whitelisted', async function () {
            await contract.setEthPrice(ETH_PRICE);

            try {
                await contract.sendTransaction({
                    value: 10 * ETH,
                    from: notWhitelisted
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow contributions < 1 ETH during presale', async function () {
            await contract.setEthPrice(ETH_PRICE);

            try {
                await contract.sendTransaction({
                    value: 0.8 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow to mint tokens if buy price is set', async function () {
            contributingEth = 1;
            await contract.setEthPrice(ETH_PRICE);
            var buyPrice = await contract.baseBuyPrice();
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), 1 * ETH);

            assert.equal(await token.balanceOf(whitelistedInPresale), contributingEth * buyPrice * GLN);
        });

        it('should create a timelock contract for bonus tokens', async function () {
            contributingEth = 1;
            await contract.setEthPrice(ETH_PRICE);
            var buyPrice = await contract.baseBuyPrice();
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH);
            assert.equal(await token.balanceOf(whitelistedInPresale), contributingEth * buyPrice * GLN);

            var tokenAddr = await contract.getTimelockContractAddress(whitelistedInPresale);

            assert.equal(await token.balanceOf(tokenAddr), contributingEth * buyPrice * GLN * BONUS);
        });

        it('should not create two timelock contracts for the same contributor', async function () {
            contributingEth = 1;
            await contract.setEthPrice(ETH_PRICE);
            var buyPrice = await contract.baseBuyPrice();
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH);
            assert.equal(await token.balanceOf(whitelistedInPresale), contributingEth * buyPrice * GLN);

            // token addr is get after the first contribution not the second one
            var tokenAddr = await contract.getTimelockContractAddress(whitelistedInPresale);

            contributingEthSecondTime = 2;
            await contract.sendTransaction({
                value: contributingEthSecondTime * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), (contributingEth + contributingEthSecondTime) * ETH);
            assert.equal(await token.balanceOf(tokenAddr), (contributingEth + contributingEthSecondTime) * buyPrice * GLN * BONUS);
        });

        it('should not allow to mint more tokens than presale hardcap', async function () {
            await contract.setEthPrice(ETH_PRICE);
            try {
                await contract.sendTransaction({
                    value: 81 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow to mint exactly the presale hard cap, considering the bonus', async function () {
            await contract.setEthPrice(ETH_PRICE);
            var buyPrice = await contract.baseBuyPrice();
            var weiToContributeToReachPresaleHardCap = 80 * ETH;
            await contract.sendTransaction({
                value: weiToContributeToReachPresaleHardCap,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), weiToContributeToReachPresaleHardCap);
            assert.equal(await token.balanceOf(whitelistedInPresale), weiToContributeToReachPresaleHardCap * buyPrice);
        });

        it('should not allow to contribute after the hardcap is reached in the presale, considering the bonus', async function () {
            await contract.setEthPrice(ETH_PRICE);
            var weiToContributeToReachPresaleHardCap = 80 * ETH;
            await contract.sendTransaction({
                value: weiToContributeToReachPresaleHardCap,
                from: whitelistedInPresale
            });

            try {
                await contract.sendTransaction({
                    value: 10 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow to contribute after the hardcap is reached in the presale if the phase is now the sale', async function () {
            await contract.setEthPrice(ETH_PRICE);
            var buyPrice = await contract.baseBuyPrice();
            var weiToContributeToReachPresaleHardCap = 80 * ETH;
            await contract.sendTransaction({
                value: weiToContributeToReachPresaleHardCap,
                from: whitelistedInPresale
            });

            // set the contract in the main sale phase
            await contract.setPhase(1);
            await contract.addToWhitelist([whitelistedInPause]);
            await contract.setIndividualWeiCap(INDIVIDUAL_CAP * ETH);
            await contract.setPhase(2);

            var weiContributedDuringTheSale = 10 * ETH;
            await contract.sendTransaction({
                value: weiContributedDuringTheSale,
                from: whitelistedInPause
            });

            assert.equal(web3.eth.getBalance(await contract.address), weiToContributeToReachPresaleHardCap + (weiContributedDuringTheSale));
            assert.equal(await token.balanceOf(whitelistedInPause), weiContributedDuringTheSale * buyPrice);
        });
    });

    describe('Pause phase', async function () {

        it('should be able to pause the sale', async function () {
            await contract.setPhase(1);
            assert.equal(await contract.getCurrentPhase(), 1);
        });

        it('should no be able to contribute during the pause', async function () {
            await setContractToPausePhase();

            try {
                await contract.sendTransaction({
                    value: 10 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should be able to set the individual cap', async function () {
            await setContractToPausePhase();
            await contract.setIndividualWeiCap(1 * ETH);
            assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
        });

        it('Should be able to set the eth price multiple times', async function () {
            await setContractToPausePhase();
            await contract.setEthPrice(10);
            await contract.setEthPrice(50);
            await contract.setEthPrice(100);

            await contract.setEthPrice(ETH_PRICE);
            var weiHardCap = await contract.weiHardCap();
            // the hardcap is the amount of wei needed to raise 9 500 000 $
            assert.equal(weiHardCap, (9500000 / ETH_PRICE) * ETH);
            // the soft cap is 26% of the hardcap
            assert.equal(await contract.weiSoftCap(), weiHardCap * 0.26);
            // the presale cap is 80% of the hardcap
            assert.equal(await contract.weiPresaleCap(), weiHardCap * 0.8);
            // the tokenBuyPrice is set using the value 0.05$ / token
            assert.equal(await contract.baseBuyPrice(), ETH_PRICE / 0.05);
        });

        it('Should not be able to set the eth price to 0', async function () {
            await setContractToPausePhase();
            try {

                await contract.setEthPrice(0);
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });
    });

    describe('Safe Mainsale', async function () {
        it('should not be able to start before individual cap is set', async function () {
            await setContractToPausePhase();
            try {
                await contract.setPhase(2);
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });
        it('should be able to set individual cap & start safe mainsale', async function () {
            await setContractToSafeMainSale();
            assert.equal(await contract.getCurrentPhase(), 2);
        });

        it('should not be able to contribute more than individual cap in the first 12 hours', async function () {
            await setContractToSafeMainSale();

            try {
                await contract.sendTransaction({
                    value: (INDIVIDUAL_CAP + 1) * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should be able to contribute less than individual cap in the first 12 hours', async function () {
            await setContractToSafeMainSale();
            var buyPrice = await contract.baseBuyPrice();
            await contract.sendTransaction({
                value: (INDIVIDUAL_CAP - 1) * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), (INDIVIDUAL_CAP - 1) * ETH)
            assert.equal((await token.balanceOf(whitelistedInPresale)), (INDIVIDUAL_CAP - 1) * buyPrice * GLN);
        });

        it('a valid contribution after the 12 hours should change the phase from 2 to 3', async function () {
            const contributingEth = 1;
            await setContractToSafeMainSale();

            // set the time in 12 hours and 1 sec
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 12) + 1],
                id: 12345
            }, function (err, result) {});

            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(await contract.getCurrentPhase(), 3);
        });

        it('should be able to contribute more than individual cap after 12 hours', async function () {
            await setContractToSafeMainSale();
            var buyPrice = await contract.baseBuyPrice();
            // set the time in 12 hours and 1 sec
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 12) + 1],
                id: 12345
            }, function (err, result) {

            });

            await contract.sendTransaction({
                value: (INDIVIDUAL_CAP + 10) * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), (INDIVIDUAL_CAP + 10) * ETH)
            assert.equal((await token.balanceOf(whitelistedInPresale)), (INDIVIDUAL_CAP + 10) * buyPrice * GLN);
        });

        it('should not allow to mint more tokens than hardcap', async function () {
            await setContractToSafeMainSale();

            // the individual wei cap is 60, the hardcap is 100, we will use 2 accounts to go over the hardcap
            await contract.sendTransaction({
                value: INDIVIDUAL_CAP * ETH,
                from: whitelistedInPause
            });

            try {
                await contract.sendTransaction({
                    value: INDIVIDUAL_CAP * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should end if hardcap is reached', async function () {
            await setContractToSafeMainSale();

            // the individual wei cap is 60, the hardcap is 100, we will use 2 accounts to reach hardcap exactly
            await contract.sendTransaction({
                value: INDIVIDUAL_CAP * ETH,
                from: whitelistedInPause
            });

            var weiRaised = await contract.weiRaised();
            var hardcap = await contract.weiHardCap();

            await contract.sendTransaction({
                value: hardcap - weiRaised,
                from: whitelistedInPresale
            });

            assert.equal(await contract.getCurrentPhase(), 4);
        });
    });

    describe('Mainsale', async function () {
        it('should not be able to start the main sale using the set phase function during the presale', async function () {
            await setContractToSafeMainSale();

            try {
                await contract.setPhase(3);
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow to add people to the whitelist during the main sale', async function () {
            await setContractToMainSale();
            assert.equal(await contract.checkWhitelisted(whitelistedInMainsale), true);
        });

        it('should allow to remove people from the whitelist during the main sale', async function () {
            await setContractToMainSale();

            await contract.removeFromWhitelist([whitelistedInPresale]);
            assert.equal(await contract.checkWhitelisted(whitelistedInPresale), false);
        });

        it('should allow people in the whitelist to participate', async function () {
            await setContractToMainSale();
            var buyPrice = await contract.baseBuyPrice();
            const contributingEth = 10;
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInMainsale
            });

            assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH)

            assert.equal((await token.balanceOf(whitelistedInMainsale)), contributingEth * buyPrice * GLN);
        });

        it('should allow people in the presale whitelist to participate', async function () {
            await setContractToMainSale();
            var buyPrice = await contract.baseBuyPrice();
            const contributingEth = 10;
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH);

            assert.equal((await token.balanceOf(whitelistedInPresale)), contributingEth * buyPrice * GLN);
        });

        it('should not allow contributions after 2 weeks', async function () {
            await setContractToMainSale();

            // set the time in 2 weeks and 1 sec
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 24 * 21) + 1],
                id: 12345
            }, function (err, result) {});

            try {
                await contract.sendTransaction({
                    value: 10 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow owner to claim ether on the contract as long as the sale is not finished even if the soft cap is reached and the sale is over', async function () {
            await setContractToMainSale();

            // reach the soft cap
            await contract.sendTransaction({
                value: await contract.weiSoftCap(),
                from: whitelistedInPresale
            });

            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 24 * 21) + 1],
                id: 12345
            }, function (err, result) {});

            try {
                await contract.withdraw();
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow to mint more tokens than hardcap', async function () {
            await setContractToMainSale();

            try {
                await contract.sendTransaction({
                    value: 1000 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should end if hardcap is reached', async function () {
            await setContractToMainSale();

            await contract.sendTransaction({
                value: await contract.weiHardCap(),
                from: whitelistedInPresale
            });

            assert.equal(await contract.getCurrentPhase(), 4);
        });

        it('should not be able to activate token if mainsale is not over', async function () {
            await setContractToMainSale();

            await contract.sendTransaction({
                value: 15 * ETH,
                from: whitelistedInPause
            });

            try {
                await contract.activateToken();
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }

        });
    });

    describe('After TGE is finished', async function () {
        it('should be able to end the main sale after 2 weeks', async function () {
            await setContractToMainSale();
            // set the time in 2 weeks and 1 sec
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 24 * 21) + 1],
                id: 12345
            }, function (err, result) {});

            await contract.setPhase(4);
            assert.equal(await contract.getCurrentPhase(), 4);
        });

        it('should not accept any contributions anymore', async function () {
            await setContractToTGEOver(true);

            try {
                await contract.sendTransaction({
                    value: 10 * ETH,
                    from: whitelistedInMainsale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should be able to activate token if the soft cap is reached', async function () {
            await setContractToTGEOver(true);

            await contract.activateToken();
            assert.equal(await token.activated(), true);
        });

        it('should not be able to activate token if the soft cap is not reached', async function () {
            await setContractToTGEOver(false);

            try {
                await contract.activateToken();
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow token transfers if token is not activated', async function () {
            // setting true means the soft cap is reached and the whitelistedInPresale contributor has tokens
            await setContractToTGEOver(true);

            try {
                await token.transfer(notWhitelisted, 1000 * GLN, {
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }

        });

        it('should allow token transfers if token is activated', async function () {
            // setting true means the soft cap is reached and the whitelistedInPresale contributor has tokens
            await setContractToTGEOver(true);

            await contract.activateToken();

            await token.transfer(notWhitelisted, 1000 * GLN, {
                from: whitelistedInPresale
            });

            assert.equal((await token.balanceOf(notWhitelisted)), 1000 * GLN);
        });

        it('should allow to withdraw ether if the soft cap is reached', async function () {
            // setting true means the soft cap is reached and the whitelistedInPresale contributor has tokens
            await setContractToTGEOver(true);

            var companyFundsBefore = web3.eth.getBalance(COMPANY_ADDRESS);
            var weiRaised = await contract.weiRaised();

            await contract.withdraw();

            assert.equal(web3.eth.getBalance(COMPANY_ADDRESS).toNumber(), weiRaised.add(companyFundsBefore));
        });

        it('should not allow to withdraw ether if the soft cap is not reached', async function () {
            // setting true means the soft cap is reached and the whitelistedInPresale contributor has tokens
            await setContractToTGEOver(false);

            try {
                await contract.withdraw();
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });


        it('should send 20% of supply to company wallet', async function () {
            await setContractToTGEOver(true);

            await contract.activateToken();

            var percentForCompany = 0.2 * await token.totalSupply();

            assert.equal((await token.balanceOf(COMPANY_ADDRESS)).toNumber(), percentForCompany);
        });

        it('should send 10% of supply to advisory wallet', async function () {
            await setContractToTGEOver(true);

            await contract.activateToken();

            var percentForAdvisory = 0.1 * await token.totalSupply();

            assert.equal((await token.balanceOf(ADVISORY_ADDRESS)).toNumber(), percentForAdvisory);
        });

        it('should vest 2% of max supply for each 5 team member & create timelocks', async function () {
            await setContractToTGEOver(true);

            await contract.activateToken();

            var percentForFounder = 0.02 * await token.totalSupply();

            assert.equal((await token.balanceOf(await contract.teamLockAddress1())).toNumber(), percentForFounder);
            assert.equal((await token.balanceOf(await contract.teamLockAddress2())).toNumber(), percentForFounder);
            assert.equal((await token.balanceOf(await contract.teamLockAddress3())).toNumber(), percentForFounder);
            assert.equal((await token.balanceOf(await contract.teamLockAddress4())).toNumber(), percentForFounder);
            assert.equal((await token.balanceOf(await contract.teamLockAddress5())).toNumber(), percentForFounder);
        });
    });

    describe('Softcap & Refund', async function () {
        it('should not allow people to claim refund during the presale', async function () {
            await contract.setEthPrice(ETH_PRICE);

            const contributingEth = 1;

            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            // try to get refund
            try {
                await contract.refund(whitelistedInPresale, {
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow people to claim refund during the pause', async function () {
            await contract.setEthPrice(ETH_PRICE);

            const contributingEth = 1;

            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            await setContractToPausePhase();

            // try to get refund
            try {
                await contract.refund(whitelistedInPresale, {
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }

        });

        it('should not allow people to claim refund during the safe sale', async function () {
            await setContractToSafeMainSale();

            await contract.sendTransaction({
                value: 1 * ETH,
                from: whitelistedInPresale
            });

            // try to get refund
            try {
                await contract.refund(whitelistedInPresale, {
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow people to claim refund during the main sale', async function () {
            await setContractToMainSale();

            await contract.sendTransaction({
                value: 1 * ETH,
                from: whitelistedInPresale
            });

            // try to get refund
            try {
                await contract.refund(whitelistedInPresale, {
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow people to claim refund after the sale is over, and softcap is not reached', async function () {
            // setContractToTGEOver(false) will have whitelistedInPresale contribute 10 ETH but not enough to reach the soft cap
            await setContractToTGEOver(false);

            const contractBalanceAfterContributing = web3.eth.getBalance(await contract.address).toNumber();
            assert.equal(contractBalanceAfterContributing, 10 * ETH);

            const contributorBalanceAfterContributing = web3.eth.getBalance(whitelistedInPresale).toNumber();

            // get refund, notWhitelisted ask for whitelistedInPresale, this way no fees is paid by whitelistedInPresale which would make auto testing difficult otherwise
            // so, because whitelistedInPresale sent 10 ETH, his balance should be "contributorBalanceAfterContributing" + 10
            await contract.refund(whitelistedInPresale, {
                from: notWhitelisted
            });

            assert.equal(web3.eth.getBalance(whitelistedInPresale), contributorBalanceAfterContributing + 10 * ETH);
            assert.equal(web3.eth.getBalance(await contract.address), contractBalanceAfterContributing - 10 * ETH);
        });

        it('should not allow people to claim refund multiple times after the sale is over, and softcap is not reached', async function () {
            // setContractToTGEOver(false) will have whitelistedInPresale contribute 10 ETH but not enough to reach the soft cap
            await setContractToTGEOver(false);

            const contractBalanceAfterContributing = web3.eth.getBalance(await contract.address).toNumber();
            assert.equal(contractBalanceAfterContributing, 10 * ETH);

            const contributorBalanceAfterContributing = web3.eth.getBalance(whitelistedInPresale).toNumber();

            // get refund, notWhitelisted ask for whitelistedInPresale, this way no fees is paid by whitelistedInPresale which would make auto testing difficult otherwise
            // so, because whitelistedInPresale sent 10 ETH, his balance should be "contributorBalanceAfterContributing" + 10
            await contract.refund(whitelistedInPresale, {
                from: notWhitelisted
            });

            assert.equal(web3.eth.getBalance(whitelistedInPresale), contributorBalanceAfterContributing + 10 * ETH);
            assert.equal(web3.eth.getBalance(await contract.address), contractBalanceAfterContributing - 10 * ETH);
            // try to get refund
            try {
                await contract.refund(whitelistedInPresale, {
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow non contributor people to claim refund after the sale is over, and softcap is not reached', async function () {
            // setContractToTGEOver(false) will have whitelistedInPresale contribute 10 ETH but not enough to reach the soft cap
            await setContractToTGEOver(false);

            // try to get refund for notWhitelisted who never contributed
            try {
                await contract.refund(notWhitelisted, {
                    from: notWhitelisted
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not allow people to claim refund after the sale is over if the softcap is reached', async function () {
            await setContractToTGEOver(true);

            try {
                await contract.refund(whitelistedInPresale, {
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });
    });

    describe('Vesting', async function () {
        it('shouldn\'t allow team members to claim vested tokens before 1 year even if the token is transferable', async function () {
            await setContractToTGEOver(true);
            await contract.activateToken();

            // try to release vested tokens just after activation
            try {
                await timelock.release();
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow team members to claim all their vested tokens after 1 year', async function () {
            await setContractToTGEOver(true);
            await contract.activateToken();

            // set the time in 1 year
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 24 * 365) + 1],
                id: 12345
            }, function (err, result) {});

            var addrFounder = await timelock.beneficiary();

            await timelock.release();

            assert.equal((await token.balanceOf(addrFounder)), 6400000 * GLN);
        });
    });
});