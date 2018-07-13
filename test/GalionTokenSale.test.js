const GalionTokenSaleContract = artifacts.require('./contracts/GalionTokenSale.sol');
const GalionTokenContract = artifacts.require('./contracts/GalionToken.sol');
const TokenTimelockContract = artifacts.require('./contracts/OpenZeppelin/TokenTimelock.sol');

const ETH = 1e+18;
const GLN = 1e+18;
const BONUS = 1.2;
const BUYPRICE = 1000000;
const INDIVIDUAL_CAP = 100;
const COMPANY_ADDRESS = "0x849F14948588d2bDe7a3ff68DE9269b2160483C1";
const FOUNDER_1_ADDRESS = "0x4933916d10ab8225a33f3a8bae7cf1a8aa316068";

contract('GalionToken', function ([owner, whitelistedInPresale, whitelistedInPause, whitelistedInSafeMainSale, whitelistedInMainsale, notWhitelisted, contributor]) {
    let contract;
    let token;
    let timelock;

    var setContractToPausePhase = async function () {
        await contract.setBuyPrice(BUYPRICE);
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
            // contribute 100 eth to the contract to be over the soft cap
            await contract.sendTransaction({
                value: 100 * ETH,
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
            params: [(3600 * 24 * 14) + 1],
            id: 12345
        }, function (err, result) {});

        await contract.setPhase(4);
    }

    beforeEach('setup contract for each test', async function () {
        contract = await GalionTokenSaleContract.new();
        token = await GalionTokenContract.at(await contract.token());
        timelock = await TokenTimelockContract.at(await contract.teamLockAddress1());
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

        it('should send 30% of max supply (96M GLN) to company wallet', async function () {
            assert.equal(
                (await token.balanceOf('0x849F14948588d2bDe7a3ff68DE9269b2160483C1')),
                0.3 * 320 * 1e6 * 1e18
            );
        });

        it('should vest 2% of max supply (6.4M GLN) for each 5 team member & create timelocks', async function () {
            assert.equal(
                (await token.balanceOf(await contract.teamLockAddress1())),
                0.02 * 320 * 1e6 * 1e18
            );
            assert.equal(
                (await token.balanceOf(await contract.teamLockAddress2())),
                0.02 * 320 * 1e6 * 1e18
            );
            assert.equal(
                (await token.balanceOf(await contract.teamLockAddress3())),
                0.02 * 320 * 1e6 * 1e18
            );
            assert.equal(
                (await token.balanceOf(await contract.teamLockAddress4())),
                0.02 * 320 * 1e6 * 1e18
            );
            assert.equal(
                (await token.balanceOf(await contract.teamLockAddress5())),
                0.02 * 320 * 1e6 * 1e18
            );
        });

        it('should deploy with the phase equals to 0', async function () {
            assert.equal(await contract.getCurrentPhase(), 0);
        });
    });

    describe('Presale', async function () {
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

        it('should not accept funds from people not whitelisted', async function () {
            try {
                await contract.sendTransaction({
                    value: 1e+18,
                    from: notWhitelisted
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
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

        it('should not allow contributions < 1 ETH during presale', async function () {
            await contract.setBuyPrice(5000);

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
            await contract.setBuyPrice(BUYPRICE);
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), 1 * ETH);

            assert.equal(await token.balanceOf(whitelistedInPresale), contributingEth * BUYPRICE * BONUS * GLN)
        });

        it('should not allow to mint more tokens than presale hardcap', async function () {
            // buy price set to 2 000 000 means that 80 eth are enough to reach the presale cap even without the bonus
            buyPrice = 2000000;
            await contract.setBuyPrice(buyPrice);
            try {
                await contract.sendTransaction({
                    value: 85 * ETH,
                    from: whitelistedInPresale
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should allow to mint exactly the presale hard cap, considering the bonus', async function () {
            // buy price set to 2 000 000 means that 66,66666... eth are enough to reach almost exactly the presale cap
            buyPrice = 2000000;
            contributingEth = 66.6666;
            await contract.setBuyPrice(buyPrice);

            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });
            assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH)
            assert.equal(await token.balanceOf(whitelistedInPresale), contributingEth * buyPrice * BONUS * GLN)
        });
    });

    describe('Owner only functions', async function () {
        it('should not be able to set the buy price if not the owner', async function () {
            try {
                await contract.setBuyPrice(5000, {
                    from: contributor
                });
                assert.fail();
            } catch (error) {
                assert(error.toString().includes('revert'), error.toString());
            }
        });

        it('should not be able to set the presale bonus if not the owner', async function () {
            try {
                await contract.setPreSaleBonus(130, {
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
            await contract.sendTransaction({
                value: (INDIVIDUAL_CAP - 1) * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address),  (INDIVIDUAL_CAP - 1) * ETH)
            assert.equal((await token.balanceOf(whitelistedInPresale)),  (INDIVIDUAL_CAP - 1) * BUYPRICE * GLN);
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
            assert.equal((await token.balanceOf(whitelistedInPresale)), (INDIVIDUAL_CAP + 10) * BUYPRICE * GLN);
        });

        it('should not allow to mint more tokens than hardcap', async function () {
            await setContractToSafeMainSale();
            // the setup of 1 000 000 token per ETH means that the hardcap (192 000 000 token) is reached after 192 eth contribution
            // the individual cap is 100 eth so we need two contributor to reach the hardcap
            // that's why we are using two contributors : whitelistedInPause and whitelistedInPresale
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
            // the setup of 1 000 000 token per ETH means that the hardcap (192 000 000 token) is reached after 192 eth contribution
            // the individual cap is 100 eth so we need two contributor to reach the hardcap
            // that's why we are using two contributors : whitelistedInPause and whitelistedInPresale
            await contract.sendTransaction({
                value: 100 * ETH,
                from: whitelistedInPause
            });

            await contract.sendTransaction({
                value: 92 * ETH,
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
            const contributingEth = 10;
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInMainsale
            });

            assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH)

            assert.equal((await token.balanceOf(whitelistedInMainsale)), contributingEth * BUYPRICE * GLN);
        });

        it('should allow people in the presale whitelist to participate', async function () {
            await setContractToMainSale();
            const contributingEth = 10;
            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH)

            assert.equal((await token.balanceOf(whitelistedInPresale)), contributingEth * BUYPRICE * GLN);
        });

        it('should not allow contributions after 2 weeks', async function () {
            await setContractToMainSale();

            // set the time in 2 weeks and 1 sec
            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 24 * 14) + 1],
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

            // contribute 100 eth to the contract to be over the soft cap
            await contract.sendTransaction({
                value: 100 * ETH,
                from: whitelistedInPresale
            });

            web3.currentProvider.sendAsync({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [(3600 * 24 * 14) + 1],
                id: 12345
            }, function (err, result) {

            });

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

            // contribute 192 which is enough to reach exactly the hard cap of 192 000 000 tokens with a buy price of 1 000 000
            const contributingEth = 192;

            await contract.sendTransaction({
                value: contributingEth * ETH,
                from: whitelistedInPresale
            });

            assert.equal(await contract.getCurrentPhase(), 4);
        });

        it('should not be able to activate token if mainsale is not over', async function () {
            await setContractToMainSale();

            const contributingEth = 100;

            await contract.sendTransaction({
                value: contributingEth * ETH,
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
                params: [(3600 * 24 * 14) + 1],
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
    });

    describe('Softcap & Refund', async function () {
        it('should not allow people to claim refund during the presale', async function () {
            await contract.setBuyPrice(BUYPRICE);

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
            await contract.setBuyPrice(BUYPRICE);

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