pragma solidity ^0.4.24;

import "./OpenZeppelin/SafeMath.sol";
import "./OpenZeppelin/TokenTimelock.sol";
import "./GalionToken.sol";
import "./PhaseWhitelist.sol";


// Galion.io Token Contract : ERC20 Token
// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
contract GalionTokenSale is PhaseWhitelist {
    using SafeMath for uint256;

    GalionToken public token;
    address public constant COMPANY_ADDRESS = address(0x849F14948588d2bDe7a3ff68DE9269b2160483C1);
    TokenTimelock public teamLockAddress1;
    TokenTimelock public teamLockAddress2;
    TokenTimelock public teamLockAddress3;
    TokenTimelock public teamLockAddress4;
    TokenTimelock public teamLockAddress5;

    // soft cap is 26% of total supply
    uint256 public constant SOFTCAP = 83 * (10 ** 6) * (10 ** 18);
    // presale cap is 50% of total supply
    uint256 public constant PRESALECAP = 160 * (10 ** 6) * (10 ** 18);
    // hard cap is 60% of total supply
    uint256 public constant HARDCAP = 192 * (10 ** 6) * (10 ** 18);

    // buy price = how much token can 1 ETH buy
    uint256 public baseBuyPrice = 0;

    // presale bonus (in multiplier percent). E.g. 120 = 120% multiplier = *1.2 = 20% bonus.
    uint256 public preSaleBonus = 120;

    // amount of raised money in wei
    uint256 public weiRaised = 0;
    uint256 public tokenSold = 0;

    constructor() public {
        // Token contract creation
        token = new GalionToken();
        uint256 tokens = 10 ** uint256(token.decimals()); // alias for token's decimals

        // Mint company tokens
        token.mint(COMPANY_ADDRESS, 96000000 * tokens);

        // Mint & lock team tokens
        uint256 releaseTime = block.timestamp + 52 weeks;
        teamLockAddress1 = new TokenTimelock(token, address(0x4933916d10aB8225a33F3a8bae7CF1A8AA316068), releaseTime);
        teamLockAddress2 = new TokenTimelock(token, address(0x531A551dE22317857b10d9FaB69674E56130679e), releaseTime);
        teamLockAddress3 = new TokenTimelock(token, address(0xDe6fdA07c2f16dE22654B707c80d25705f6410a5), releaseTime);
        teamLockAddress4 = new TokenTimelock(token, address(0x13E45dFF393716f3169E34Dd9039468975b808C6), releaseTime);
        teamLockAddress5 = new TokenTimelock(token, address(0xFcCB4C7D53745f03DF19039f3B37083D0E4ff47B), releaseTime);
        token.mint(teamLockAddress1, 6400000 * tokens);
        token.mint(teamLockAddress2, 6400000 * tokens);
        token.mint(teamLockAddress3, 6400000 * tokens);
        token.mint(teamLockAddress4, 6400000 * tokens);
        token.mint(teamLockAddress5, 6400000 * tokens);
    }

    // Default function called when someone is sending ETH : redirects to the ICO buy function.
    function() public payable {
        buyGLN();
    }

    // ICO buy function
    // The sender can only buy if :
    // - the ICO is in progress (mainsale or presale)
    // - the sender is whitelisted
    function buyGLN() public payable whitelisted saleIsOn {
        // require the buy price to be set
        require(baseBuyPrice > 0);

        // Compute buy price (with bonus applied if presale is in progress)
        uint256 buyPrice = baseBuyPrice;
        // set the correct cap for the phase
        uint256 phaseCap = HARDCAP;

        if (phase == 0) {
            buyPrice = baseBuyPrice.mul(preSaleBonus).div(100);
            require(msg.value >= 10 ** 18);
            phaseCap = PRESALECAP;
        }

        // individual cap check if current phase is safe mainsale
        if (phase == 2) {
            if (block.timestamp >= safeMainsaleEnd) { // potentially switch to normal mainsale if time is elapsed
                phase = 3;
            } else {
                uint256 futureContributedWei = contributed[msg.sender].add(msg.value);
                require(futureContributedWei <= individualWeiCap);
            }
        }

        // Amount of tokens bought
        uint256 buyAmount = msg.value.mul(buyPrice);
        uint256 futureTokenSold = tokenSold + buyAmount;

        // Check for hardcap
        require(futureTokenSold <= phaseCap);

        // Mint token & assign to contributor
        contributed[msg.sender] = contributed[msg.sender].add(msg.value);
        tokenSold = futureTokenSold;
        weiRaised = weiRaised.add(msg.value);
        token.mint(msg.sender, buyAmount);

        // end the token generation event if the total token sold is the hard cap
        if (tokenSold == HARDCAP) {
            phase = 4;
        }
    }

    // Set presale bonus
    function setPreSaleBonus(uint256 newBonus) public onlyOwner {
        require(newBonus >= 100);
        preSaleBonus = newBonus;
    }

    // Set buy price (tokens per ETH, without bonus).
    // because both have 18 decimal, newBuyPrice is "how much token can be bought with 1 eth"
    function setBuyPrice(uint256 newBuyPrice) public onlyOwner {
        // the base price can only be changed before the main sale
        require(phase < 2);
        require(newBuyPrice > 0);

        baseBuyPrice = newBuyPrice;
    }

    // Withdraw all ETH stored on the contract, by sending them to the company address
    function withdraw() public {
        // cannot withdraw if the soft cap is not reached
        require(tokenSold >= SOFTCAP);
        // cannot withdraw if the sale is not over
        require(phase >= 4);

        COMPANY_ADDRESS.transfer(address(this).balance);
    }

    // allow a user to get refund before softcap is reached
    function refund(address contributor) public {
        // if the main sale is over, put the contract in the phase TGE over
        // this will allow contributors to get refund even if Galion does not set the phase from 3 to 4
        if (phase == 3 && block.timestamp > mainsaleEnd) {
            phase = 4;
        }

        require(tokenSold < SOFTCAP);
        require(phase >= 4);

        uint256 contributedWei = contributed[contributor];
        require(contributedWei > 0);

        contributed[contributor] = 0;
        if (contributedWei > 0 && address(this).balance >= contributedWei) {
            contributor.transfer(contributedWei);
        }
    }

    // activate token after token generation even (enable the transfer() function of ERC20)
    function activateToken() public onlyOwner {
        require(phase >= 4);

        token.activate();
        token.transferOwnership(owner);
    }
}
