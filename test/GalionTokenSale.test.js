const GalionTokenSaleContract = artifacts.require('./GalionTokenSale.sol');
const GalionTokenContract = artifacts.require('./GalionToken.sol');
const ETH = 1e+18;
const GLN = 1e+18;

contract('GalionToken', function ([owner, contributor1]) {
  let contract;
  let token;

  beforeEach('setup contract for each test', async function () {
    contract = await GalionTokenSaleContract.new();
    token = await GalionTokenContract.at(await contract.token());
  });

  describe('Set-up', async function() {
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

    it('should send 30% of max supply (96M GLN) to company wallet', async function() {
      assert.equal(
        (await token.balanceOf('0x849F14948588d2bDe7a3ff68DE9269b2160483C1')).toNumber(),
        0.3 * 320 * 1e6 * 1e18
      );
    });

    it('should vest 2% of max supply (6.4M GLN) for each 5 team member & create timelocks', async function() {
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
  });

  describe('Presale', async function() {
    it('should allow to add people to the whitelist', async function() {
      await contract.addToWhitelistForPresale([contributor1]);
      let whitelisted = await contract.checkWhitelistedForPresale(contributor1);
      assert.equal(whitelisted, true);
    });

    it('should not accept funds from people not whitelisted', async function() {
      try {
        await contract.sendTransaction({ value: 1e+18, from: contributor1 });
        assert.fail();
      } catch (error) {
        assert(error.toString().includes('revert'), error.toString());
      }
    });

    it('should not allow to mint tokens if buy price isn\'t set', async function() {
      await contract.addToWhitelistForPresale([contributor1]);

      try {
        await contract.sendTransaction({ value: 1 * ETH, from: contributor1 });
        assert.fail();
      } catch (error) {
        assert(error.toString().includes('revert'), error.toString());
      }
    });

    it('should not allow contributions < 1 ETH during presale', async function() {
      await contract.addToWhitelistForPresale([contributor1]);
      await contract.setBuyPrice(5000);

      try {
        await contract.sendTransaction({ value: 0.8 * ETH, from: contributor1 });
        assert.fail();
      } catch (error) {
        assert(error.toString().includes('revert'), error.toString());
      }
    });

    it('should allow to mint tokens if buy price is set', async function() {
      await contract.addToWhitelistForPresale([contributor1]);
      await contract.setBuyPrice(5000);
      await contract.sendTransaction({ value: 1 * ETH, from: contributor1 });

      const address = await contract.address
      assert.equal(web3.eth.getBalance(address).toNumber(), 1 * ETH)

      const contributorBalance = await token.balanceOf(contributor1);
      assert.equal(contributorBalance.toNumber(), 6000 * GLN)
    });


    it('should not accept funds from people whitelisted for mainsale but not presale', async function() {
      await contract.addToWhitelistForMainsale([contributor1]);
      await contract.setBuyPrice(5000);

      try {
        await contract.sendTransaction({ value: 1 * ETH, from: contributor1 });
        assert.fail();
      } catch (error) {
        assert(error.toString().includes('revert'), error.toString());
      }
    });
  });

  describe('Mainsale', async function() {
    it.skip('should allow to add people to the whitelist');
    it.skip('should not accept funds from people whitelisted for mainsale as long as mainsale isn\'t open');
  });

  describe('Softcap', async function() {
    it.skip('should keep ether on the contract as long as softcap isn\'t reached');
    it.skip('should allow people to claim refund as long as softcap isn\'t reached');
    it.skip('should not allow owner to claim ether on the contract as long as softcap isn\'t reached');
  });

  describe('Hardcap', async function() {
    it.skip('should not allow further contributions once hardcap is reached');
  });

  describe('Vesting', async function() {
    it.skip('should allow company to transfer tokens right from the start (for bounty, etc)');
    it.skip('shouldn\'t allow team members to claim vested tokens');
    it.skip('should allow team members to claim half of their vested tokens after 6 months');
    it.skip('should allow team members to claim all their vested tokens after 12 months');
  });
});
