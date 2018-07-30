pragma solidity ^0.4.24;

import "./OpenZeppelin/Ownable.sol";
import "./OpenZeppelin/SafeMath.sol";

// developed by contact@it.galion.io
// ----------------------------------------------------------------------------
// The sale has 5 phases :
// 0: private sale
// 1: pause (between private sale & mainsale)
// 2: safe mainsale (individual cap for a few hours)
// 3: mainsale (lasts a few weeks until hardcap is reached)
// 4: TGE event over, we can make the token tradeable & withdraw funds
contract PhasedSale is Ownable {
    using SafeMath for uint256;

    // individual wei cap during safe sale, must be set before calling the"setSaleStartBlock" and used to allow
    // every whitelisted user to have a share
    uint256 public individualWeiCap = 0;

    // Indicator of the crowdsale phase (0 = presale, 1 = pause, 2 = safe mainsale, 3 = mainsale, 4 = TGE over)
    uint8 public phase = 0;
    uint256 public safeMainsaleEnd = 0;
    uint256 public mainsaleEnd = 0;

    // the sale if ON if the phase is 0 = presale
    // or if the phase is 2 or 3 (safe main sale and main sale) and the time is before the mainsale end
    modifier saleIsOn() {
        require(phase == 0 || ((phase == 2 || phase == 3) && block.timestamp <= mainsaleEnd));
        _;
    }

    function setPhase(uint8 nextPhase) public onlyOwner {
        require(nextPhase == phase + 1);

        // if the phase is the pause phase (1), the next phase is the safe sale so we need to set the individual wei cap before
        if (phase == 1) {
            require(individualWeiCap > 0);
            // set the end of safe mainsale timestamp
            safeMainsaleEnd = block.timestamp + 12 hours;
            // set the end of the main sale timestamp
            mainsaleEnd = block.timestamp + 3 weeks;
        }

        // can only change phase from 2 (safe main sale) to 3 (main sale) if the end timestamp of the safe main sale is reached
        if (nextPhase == 3) {
            require(block.timestamp > safeMainsaleEnd);
        }

        // can only change phase from 3 (main sale) to 4 (TGE over) if the end timestamp of the main sale is reached
        // the mainsale can still be stopped from inside the buyGLN function if the cap is reached
        if (nextPhase == 4) {
            require(block.timestamp > mainsaleEnd);
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
}
