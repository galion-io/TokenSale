const GalionTokenContract = artifacts.require('./GalionToken.sol');
const ETH = 1e+18;

contract('GalionTokenContract', function ([owner]) {
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
    it.skip('should allow to add people to the whitelist');
    it.skip('should not accept funds from people not whitelisted');
    it.skip('should not accept funds from people whitelisted for mainsale but not presale');
    it.skip('should accept funds from people whitelisted for presale');
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
