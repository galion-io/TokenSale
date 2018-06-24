pragma solidity ^0.4.24;
// Inspired from :
// https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/contracts/lifecycle/Pausable.sol
// https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/contracts/token/ERC20/PausableToken.sol

import "./OpenZeppelin/MintableToken.sol";


/**
 * @title Activable StandardToken
 * Make transfers of a StandardToken disabled until the owner calls an activate() function.
 */
contract MintableActivableToken is MintableToken {
    event Activate();

    bool public activated = false;

    modifier whenActivated() {
        require(activated);
        _;
    }

    modifier whenNotActivated() {
        require(!activated);
        _;
    }

    function activate() public onlyOwner whenNotActivated {
        activated = true;
        emit Activate();
    }

    function transfer(address _to, uint256 _value) public whenActivated returns (bool) {
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public whenActivated returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    function approve(address _spender, uint256 _value) public whenActivated returns (bool) {
        return super.approve(_spender, _value);
    }

    function increaseApproval(address _spender, uint _addedValue) public whenActivated returns (bool success) {
        return super.increaseApproval(_spender, _addedValue);
    }

    function decreaseApproval(address _spender, uint _subtractedValue) public whenActivated returns (bool success) {
        return super.decreaseApproval(_spender, _subtractedValue);
    }
}
