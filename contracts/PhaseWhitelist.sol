pragma solidity ^0.4.24;

import "./OpenZeppelin/Ownable.sol";
import "./OpenZeppelin/SafeMath.sol";

// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
contract PhaseWhitelist is Ownable {
    using SafeMath for uint256;

    // Whitelisted addresses (who passed the KYC process)
    // 0 : not whitelisted (default)
    // > 0 : whitelisted
    mapping(address => uint8) private whitelist;

    // store the amount contributed by each contributors
    // used in case of refund in the claim function
    // also used for the individual cap
    mapping(address => uint256) internal contributed;
    // individual wei cap during safe sale, must be set before calling the"setSaleStartBlock" and used to allow
    // every whitelisted user to have a share
    uint256 public individualWeiCap = 0;

    // Indicator of the crowdsale phase (0 = presale, 1 = pause, 2 = safe mainsale, 3 = mainsale, 4 = TGE over)
    uint8 public phase = 0;
    uint256 public safeMainsaleEnd = 0;
    uint256 public mainsaleEnd = 0;

    // Modifier to check that the user is whitelisted
    modifier whitelisted() {
        require(whitelist[msg.sender] > 0);
        _;
    }

    // the sale if ON if the phase is 0 = presale
    // or if the phase is 2 or 3 (safe main sale and main sale) and the time is before the mainsale end
    modifier saleIsOn() {
        require(phase == 0 || ((phase == 2 || phase == 3) && block.timestamp <= mainsaleEnd));
        _;
    }

    function setPhase(uint8 nextPhase) public onlyOwner {
        require(nextPhase == phase + 1);

        // cannot change the phase from safe sale to main sale using this function
        // the safe sale to main safe switch is made in the buyGLN function
        // without this test, we could ignore the safe main sale
        require(phase != 2);

        // if the next phase is the end of the sale, we must check that the time is over the main sale end timestamp
        // without this test, we could stop the main sale
        // the mainsale can still be stopped in the buyGLN function if the cap is reached
        if (nextPhase == 4) {
            require(block.timestamp > mainsaleEnd);
        }

        // if the phase is the pause phase (1), the next phase is the safe sale so we need to set the individual wei cap before
        if (phase == 1) {
            require(individualWeiCap > 0);
            // set the end of safe mainsale timestamp
            safeMainsaleEnd = block.timestamp + 12 hours;
            // set the end of the main sale timestamp
            mainsaleEnd = block.timestamp + 2 weeks;
        }

        phase = nextPhase;
    }

    function getCurrentPhase() public view returns(uint8) {
        return phase;
    }

    // Set the individual wei cap which is only used during the safe main sale
    function setIndividualWeiCap(uint256 newWeiCap) public onlyOwner {
        // must be during the pause phase
        require(phase == 1);

        require(newWeiCap > 0);
        individualWeiCap = newWeiCap;
    }

    // Get the individual wei cap which is only used during the safe main sale
    function getIndividualWeiCap() public view returns (uint256) {
        return individualWeiCap;
    }

    // Public function to check if an address is in the whitelist
    function checkWhitelisted(address _addr) public view returns (bool) {
        return whitelist[_addr] > 0;
    }

    // Add addresses to whitelist (level = presale).
    function addToWhitelist(address[] addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = 1;
        }
    }

    // Remove addresses from the whitelist.
    function removeFromWhitelist(address[] addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = 0;
        }
    }
}
