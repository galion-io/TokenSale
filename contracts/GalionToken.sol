pragma solidity ^0.4.24;

import "./OpenZeppelin/BurnableToken.sol";
import "./MintableActivableToken.sol";

// Galion.io Token Contract : ERC20 Token
// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
contract GalionToken is BurnableToken, MintableActivableToken {
    string public constant name = "Galion Token";
    string public constant symbol = "GLN";
    uint256 public constant decimals = 18;
}
