const GalionTokenSaleContract = artifacts.require('./contracts/GalionTokenSale.sol');
const GalionTokenContract = artifacts.require('./contracts/GalionToken.sol');
const ETH = 1e+18;
const GLN = 1e+18;
const BONUS = 1.2;
const COMPANY_ADDRESS = "0x849F14948588d2bDe7a3ff68DE9269b2160483C1";

contract('GalionToken', function ([owner, contributor1, contributor2]) {
	let contract;
	let token;

	beforeEach('setup contract for each test', async function () {
		contract = await GalionTokenSaleContract.new();
		token = await GalionTokenContract.at(await contract.token());
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
				(await token.balanceOf('0x849F14948588d2bDe7a3ff68DE9269b2160483C1')).toNumber(),
				0.3 * 320 * 1e6 * 1e18
			);
		});

		it('should vest 2% of max supply (6.4M GLN) for each 5 team member & create timelocks', async function () {
			assert.equal(
				(await token.balanceOf(await contract.teamLockAddress1())).toNumber(),
				0.02 * 320 * 1e6 * 1e18
			);
			assert.equal(
				(await token.balanceOf(await contract.teamLockAddress2())).toNumber(),
				0.02 * 320 * 1e6 * 1e18
			);
			assert.equal(
				(await token.balanceOf(await contract.teamLockAddress3())).toNumber(),
				0.02 * 320 * 1e6 * 1e18
			);
			assert.equal(
				(await token.balanceOf(await contract.teamLockAddress4())).toNumber(),
				0.02 * 320 * 1e6 * 1e18
			);
			assert.equal(
				(await token.balanceOf(await contract.teamLockAddress5())).toNumber(),
				0.02 * 320 * 1e6 * 1e18
			);
		});

		it('should deploy with the phase equals to 0', async function () {
			assert.equal(await contract.getCurrentPhase(), 0);
		});
	});

	describe('Presale', async function () {
		it('should allow to add people to the whitelist', async function () {
			await contract.addToWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), true);
		});

		it('should allow to remove people from the whitelist', async function () {
			await contract.addToWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), true);

			await contract.removeFromWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), false);
		});

		it('should not accept funds from people not whitelisted', async function () {
			try {
				await contract.sendTransaction({
					value: 1e+18,
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should not allow to mint tokens if buy price isn\'t set', async function () {
			await contract.addToWhitelist([contributor1]);

			try {
				await contract.sendTransaction({
					value: 1 * ETH,
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should not allow contributions < 1 ETH during presale', async function () {
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(5000);

			try {
				await contract.sendTransaction({
					value: 0.8 * ETH,
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should allow to mint tokens if buy price is set', async function () {
			buyPrice = 2000000;
			contributingEth = 1;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);
			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});

			const address = await contract.address
			assert.equal(web3.eth.getBalance(address).toNumber(), 1 * ETH)

			const contributorBalance = await token.balanceOf(contributor1);
			assert.equal(contributorBalance.toNumber(), contributingEth * buyPrice * BONUS * GLN)
		});

		it('should not allow to mint more tokens than presale hardcap', async function () {
			// buy price set to 2 000 000 means that 80 eth are enough to reach the presale cap even without the bonus
			buyPrice = 2000000;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			try {
				await contract.sendTransaction({
					value: 85 * ETH,
					from: contributor1
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
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});
			const address = await contract.address
			assert.equal(web3.eth.getBalance(address).toNumber(), contributingEth * ETH)

			const contributorBalance = await token.balanceOf(contributor1);
			assert.equal(contributorBalance.toNumber(), contributingEth * buyPrice * BONUS * GLN)

		});
	});

	describe('Owner only functions', async function () {
		it('should not be able to set the buy price if not the owner', async function () {
			try {
				await contract.setBuyPrice(5000, {
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should not be able to set the presale bonus if not the owner', async function () {
			try {
				await contract.setPreSaleBonus(130, {
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should not be able to activate the token if not the owner', async function () {
			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			// set the time in 12 hours and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 12) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.setPhase(3);
			assert.equal(await contract.getCurrentPhase(), 3);

			// set the time in 2 weeks and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 24 * 14) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.setPhase(4);
			assert.equal(await contract.getCurrentPhase(), 4);

			try {
				await contract.activateToken({
					from: contributor1
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
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should not be able to set the phase if not the owner', async function () {
			try {
				await contract.setPhase(1, {
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should not be able to whitelist an address price if not the owner', async function () {
			try {
				await contract.addToWhitelist([contributor2], {
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
				assert.equal(await contract.checkWhitelisted(contributor2), false);
			}
		});

		it('should not be able to remove from whitelist if not the owner', async function () {
			await contract.addToWhitelist([contributor2]);
			assert.equal(await contract.checkWhitelisted(contributor2), true);

			try {
				await contract.removeFromWhitelist([contributor2], {
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
				assert.equal(await contract.checkWhitelisted(contributor2), true);
			}
		});
	});

	describe('Pause phase', async function () {

		it('should be able to pause the sale', async function () {
			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
		});

		it('should no be able to contribute during the pause', async function () {
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(5000);

			await contract.setPhase(1);

			try {
				await contract.sendTransaction({
					value: contributingEth * ETH,
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should be able to set the individual cap', async function () {
			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1 * ETH);
			assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
		});
	});

	describe('Safe Mainsale', async function () {
		it('should not be able to start before individual cap is set', async function () {
			await contract.setPhase(1);

			try {
				await contract.setPhase(2);
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});
		it('should be able to set individual cap & start safe mainsale', async function () {
			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);
		});

		it('should not be able to contribute more than individual cap in the first 12 hours', async function () {
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(5000);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			try {
				await contract.sendTransaction({
					value: 2 * ETH,
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should be able to contribute less than individual cap in the first 12 hours', async function () {
			const contributingEth = 0.5;
			const buyPrice = 5000;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);


			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});

			assert.equal(web3.eth.getBalance(await contract.address).toNumber(), contributingEth * ETH)
			assert.equal((await token.balanceOf(contributor1)).toNumber(), contributingEth * buyPrice * GLN);
		});

		it('a valid contribution after the 12 hours should change the phase from 2 to 3', async function () {
			const contributingEth = 0.5;
			const buyPrice = 5000;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			// set the time in 12 hours and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 12) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});

			assert.equal(await contract.getCurrentPhase(), 3);
		});

		it('should be able to contribute more than individual cap after 12 hours', async function () {
			const contributingEth = 10;
			const buyPrice = 5000;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			// set the time in 12 hours and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 12) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});

			assert.equal(web3.eth.getBalance(await contract.address).toNumber(), contributingEth * ETH)
			assert.equal((await token.balanceOf(contributor1)).toNumber(), contributingEth * buyPrice * GLN);
		});

		it('should not allow to mint more tokens than hardcap', async function () {
			const contributingEth = 100;
			const buyPrice = 2000000;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1000 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1000 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			try {
				await contract.sendTransaction({
					value: contributingEth * ETH,
					from: contributor1
				});
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should end if hardcap is reached', async function () {
			const contributingEth = 192;
			const buyPrice = 1000000;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1000 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1000 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});

			assert.equal(web3.eth.getBalance(await contract.address).toNumber(), contributingEth * ETH)
			assert.equal((await token.balanceOf(contributor1)).toNumber(), contributingEth * buyPrice * GLN);

			assert.equal(await contract.getCurrentPhase(), 4);
		});
	});

	describe('Mainsale', async function () {
		it('should not be able to start the main sale using the set phase function during the presale', async function () {
			const buyPrice = 1000000;
			await contract.addToWhitelist([contributor1]);
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1000 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1000 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			try {
				await contract.setPhase(3);
				assert.fail();
			} catch (error) {
				assert(error.toString().includes('revert'), error.toString());
			}
		});

		it('should allow to add people to the whitelist during the main sale', async function () {
			// this block set the contract in the main sale with a buy price of 1 000 000 GLN = 1 ETH
			// allowing to reach the hardcap with 192 ETH

			const buyPrice = 1000000;
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1000 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1000 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			// set the time in 12 hours and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 12) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.setPhase(3);
			assert.equal(await contract.getCurrentPhase(), 3);
			// end of the "put the contract in the main sale" block

			await contract.addToWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), true);
		});

		it('should allow to remove people from the whitelist during the main sale', async function () {
			await contract.addToWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), true);

			// this block set the contract in the main sale with a buy price of 1 000 000 GLN = 1 ETH
			// allowing to reach the hardcap with 192 ETH

			const buyPrice = 1000000;
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1000 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1000 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			// set the time in 12 hours and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 12) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.setPhase(3);
			assert.equal(await contract.getCurrentPhase(), 3);
			// end of the "put the contract in the main sale" block

			await contract.removeFromWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), false);
		});

		it('should allow people in the whitelist to participate', async function () {
			// this block set the contract in the main sale with a buy price of 1 000 000 GLN = 1 ETH
			// allowing to reach the hardcap with 192 ETH

			const buyPrice = 1000000;
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1000 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1000 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			// set the time in 12 hours and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 12) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.setPhase(3);
			assert.equal(await contract.getCurrentPhase(), 3);
			// end of the "put the contract in the main sale" block

			await contract.addToWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), true);
			
			const contributingEth = 10;

			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});

			assert.equal(web3.eth.getBalance(await contract.address), contributingEth * ETH)

			assert.equal((await token.balanceOf(contributor1)), contributingEth * buyPrice * GLN);
		});

		it('should allow people in the presale whitelist to participate', async function () {
			// add the contributor1 in the whitelist during the presale
			await contract.addToWhitelist([contributor1]);
			assert.equal(await contract.checkWhitelisted(contributor1), true);

			// this block set the contract in the main sale with a buy price of 1 000 000 GLN = 1 ETH
			// allowing to reach the hardcap with 192 ETH

			const buyPrice = 1000000;
			await contract.setBuyPrice(buyPrice);

			await contract.setPhase(1);
			assert.equal(await contract.getCurrentPhase(), 1);
			await contract.setIndividualWeiCap(1000 * ETH);

			assert.equal(await contract.getIndividualWeiCap(), 1000 * ETH);
			await contract.setPhase(2);
			assert.equal(await contract.getCurrentPhase(), 2);

			// set the time in 12 hours and 1 sec
			web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				method: "evm_increaseTime",
				params: [(3600 * 12) + 1],
				id: 12345
			}, function (err, result) {

			});

			await contract.setPhase(3);
			assert.equal(await contract.getCurrentPhase(), 3);
			// end of the "put the contract in the main sale" block

			
			const contributingEth = 10;

			await contract.sendTransaction({
				value: contributingEth * ETH,
				from: contributor1
			});

			assert.equal(web3.eth.getBalance(await contract.address).toNumber(), contributingEth * ETH)

			assert.equal((await token.balanceOf(contributor1)).toNumber(), contributingEth * buyPrice * GLN);
		});

		it.skip('should now allow contributions after 2 weeks');
		it.skip('should not allow owner to claim ether on the contract as long as the sale isn\'t finished');
		it.skip('should not allow to mint more tokens than hardcap');
		it.skip('should end if hardcap is reached');
		it.skip('should not be able to activate token if mainsale is not over');
	});

	describe('After TGE is finished', async function () {
		it.skip('should not accept any contributions anymore');
		it.skip('should be able to activate token');
		it.skip('should not allow token transfers if token is not activated');
		it.skip('should allow token transfers if token is activated');
	});

	describe('Softcap & Refund', async function () {
		it.skip('should not allow people to claim refund if sale is not over');
		it.skip('should allow people to claim refund after the sale is over, and softcap is not reached');
		it.skip('should not allow people to claim refund after the sale is over, and softcap is reached');
	});

	describe('Vesting', async function () {
		it.skip('shouldn\'t allow team members to claim vested tokens before 1 year');
		it.skip('should allow team members to claim all their vested tokens after 1 year');
	});
});