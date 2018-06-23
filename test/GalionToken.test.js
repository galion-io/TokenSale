const GalionTokenContract = artifacts.require('./GalionToken.sol');
const ETH = 1e+18;
const GLN = 1e+18;

contract('GalionTokenContract', function ([owner, contributor1]) {
  let contract;

  beforeEach('setup contract for each test', async function () {
    contract = await GalionTokenContract.new();
  });

  describe('Set-up', async function() {
    it('should deploy properly', async function () {
      assert.equal(await contract.owner(), owner);
    });

    it.skip('should send company/partners tokens');
    it.skip('should vest team tokens');
  });

  describe('Presale', async function() {
    it('should allow to add people to the whitelist', async function() {
      await contract.addWhitelistedAddressPresaleList([contributor1]);
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

    it('should not allow to start presale if buy price isn\'t set', async function() {
      await contract.addWhitelistedAddressPresaleList([contributor1]);

      try {
        await contract.startPreSale();
        assert.fail();
      } catch (error) {
        assert(error.toString().includes('revert'), error.toString());
      }
    });

    it('should allow to start presale if buy price is set', async function() {
      await contract.addWhitelistedAddressPresaleList([contributor1]);
      await contract.setBuyPrice(5000);
      await contract.startPreSale();
    });

    it('should not accept funds from people whitelisted for presale, before presale starts', async function() {
      await contract.addWhitelistedAddressPresaleList([contributor1]);
      await contract.setBuyPrice(5000);

      try {
        await contract.sendTransaction({ value: 1 * ETH, from: contributor1 });
        assert.fail();
      } catch (error) {
        assert(error.toString().includes('revert'), error.toString());
      }
    });

    it('should accept funds from people whitelisted for presale, and give them tokens, if presale is started', async function() {
      await contract.addWhitelistedAddressPresaleList([contributor1]);
      await contract.setBuyPrice(5000);
      await contract.startPreSale();
      await contract.sendTransaction({ value: 1 * ETH, from: contributor1 });

      const address = await contract.address
      assert.equal(web3.eth.getBalance(address).toNumber(), 1 * ETH)

      const contributorBalance = await contract.balanceOf(contributor1);
      assert.equal(contributorBalance.toNumber(), 6000 * GLN)
    });


    it('should not accept funds from people whitelisted for mainsale but not presale', async function() {
      await contract.addAddressesToMainsaleWhitelist([contributor1]);
      await contract.setBuyPrice(5000);
      await contract.startPreSale();

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
