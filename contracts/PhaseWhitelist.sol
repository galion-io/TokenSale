pragma solidity ^0.4.24;

import "./OpenZeppelin/Ownable.sol";
import "./OpenZeppelin/SafeMath.sol";

// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
contract PhaseWhitelist is Ownable {
    using SafeMath for uint256;

    // Whitelisted addresses (who passed the KYC process)
    // 0 : not whitelisted (default)
    // 1 : whitelisted for mainsale
    // 2 : whitelisted for presale
    mapping(address => uint8) private whitelist;
    uint256 public whitelistCount = 0;

    // store the amount contributed by each contributors
    // used in case of refund in the claim function
    // also used for the individual cap
    mapping(address => uint256) internal contributed;
    // individual wei cap during safe sale, must be set before calling the"setSaleStartBlock" and used to allow
    // every whitelisted user to have a share
    uint256 public individualWeiCap = 0;

    // Indicator of the crowdsale phase (0 = presale, 1 = safe mainsale, 2 = mainsale, 3 = TGE over)
    uint8 public phase = 0;
    uint256 public safeMainsaleEnd = 0;

    // Modifier to check that the user is whitelisted in current phase
    modifier whitelisted() {
        bool presaleOk = phase == 0 && whitelist[msg.sender] == 2;
        bool safeMainSaleOk = phase == 1 && whitelist[msg.sender] > 0;
        bool mainsaleOk = phase == 2 && whitelist[msg.sender] > 0;
        require(presaleOk || safeMainSaleOk || mainsaleOk, "Not whitelisted in current phase.");
        _;
    }

    function setPhase(uint8 nextPhase) public onlyOwner {
        require(nextPhase == phase + 1, "Must go through phases 1 at a time");

        if (phase == 0) {
            require(individualWeiCap > 0, "Must set individual wei cap before starting safe mainsale");
            // set the end of safe mainsale timestamp
            safeMainsaleEnd = block.timestamp + 12 hours;
        }

        phase = nextPhase;
    }

    // Set the individual wei cap which is only used during the safe main sale
    function setIndividualWeiCap(uint256 newWeiCap) public onlyOwner {
        // must still be in presale
        require(phase < 1, "Can only change individual wei cap during presale");

        require(newWeiCap > 0);
        individualWeiCap = newWeiCap;
    }

    // Public function to check if an address is in the presale whitelist.
    function checkWhitelistedForPresale(address _addr) public constant returns (bool) {
        return whitelist[_addr] == 2;
    }

    // Public function to check if an address is in the mainsale whitelist.
    function checkWhitelistedForMainsale(address _addr) public constant returns (bool) {
        return whitelist[_addr] > 0;
    }

    // Add addresses to whitelist (level = presale).
    function addToWhitelistForPresale(address[] addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = 2;
        }

        whitelistCount = whitelistCount.add(addresses.length);
    }

    // Add addresses to whitelist (level = mainsale).
    function addToWhitelistForMainsale(address[] addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = 1;
        }

        whitelistCount = whitelistCount.add(addresses.length);
    }

    // Remove addresses from the whitelist.
    function removeFromWhitelist(address[] addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = 0;
        }

        whitelistCount = whitelistCount.sub(addresses.length);
    }
}
