pragma solidity ^0.4.24;

import "./OpenZeppelin/Ownable.sol";

// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
contract SimpleWhitelist is Ownable {

    // Whitelisted addresses (who passed the KYC process)
    mapping(address => bool) private whitelist;

    // Modifier to check that the user is whitelisted
    modifier whitelisted() {
        require(whitelist[msg.sender] == true);
        _;
    }

    // Public function to check if an address is in the whitelist
    function checkWhitelisted(address _addr) public view returns (bool) {
        return whitelist[_addr] == true;
    }

    // Add addresses to whitelist.
    function addToWhitelist(address[] addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = true;
        }
    }

    // Remove addresses from the whitelist.
    function removeFromWhitelist(address[] addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = false;
        }
    }
}
