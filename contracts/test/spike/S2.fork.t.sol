// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {AbstractPayer} from "reactive-lib-omni/base/AbstractPayer.sol";
import {AbstractCallback} from "reactive-lib-omni/base/AbstractCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {ExitProbe} from "../../src/spike/ExitProbe.sol";

/// @notice Spike S2 against the LIVE Unichain Sepolia v4 deployment (fork). Nothing in Uniswap is redeployed or
/// mocked: the pool is created on the real PoolManager, the position is minted by the real PositionManager, and the
/// exit runs the deployed PositionManager bytecode. Only the test tokens are ours (disclosed).
abstract contract S2ForkBase is Test {
    // Addresses from docs/CONTEXT.md (bytecode verified in E-001).
    IPoolManager internal constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    IPositionManager internal constant POSM = IPositionManager(0xf969Aee60879C54bAAed9F3eD26147Db216Fd664);
    IAllowanceTransfer internal constant PERMIT2 = IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    address internal constant PROXY = 0x775c9B990ADe401060B78D0e98684eEf8d2466C1; // Unichain Sepolia callback proxy
    address internal constant REACTIVE = address(0xA11CE); // stands in for the Lasna reactive contract's address
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    /// @dev The gas limit Ripcord will request per exit callback, as in Reactive's own demos.
    uint64 internal constant CALLBACK_GAS = 1_000_000;

    ExitProbe internal probe;
    PoolKey internal key;
    MockERC20 internal t0;
    MockERC20 internal t1;
    address internal recipient = makeAddr("recipient");

    function setUp() public {
        vm.createSelectFork(vm.envOr("UNICHAIN_SEPOLIA_RPC", string("https://sepolia.unichain.org")));
        probe = new ExitProbe(PROXY, REACTIVE, POSM, recipient);

        MockERC20 a = new MockERC20("Ripcord Test A", "RTA", 18);
        MockERC20 b = new MockERC20("Ripcord Test B", "RTB", 18);
        (t0, t1) = address(a) < address(b) ? (a, b) : (b, a);
        key = PoolKey({
            currency0: Currency.wrap(address(t0)),
            currency1: Currency.wrap(address(t1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        POOL_MANAGER.initialize(key, SQRT_PRICE_1_1);
        console.log("S2 fork: Unichain Sepolia block", block.number);

        for (uint256 i = 0; i < 2; ++i) {
            MockERC20 t = i == 0 ? t0 : t1;
            t.mint(address(this), 1_000e18);
            t.approve(address(PERMIT2), type(uint256).max);
            PERMIT2.approve(address(t), address(POSM), type(uint160).max, type(uint48).max);
        }
    }

    function _mintTo(address owner, uint256 liquidity) internal returns (uint256 tokenId) {
        tokenId = POSM.nextTokenId();
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] =
            abi.encode(key, int24(-600), int24(600), liquidity, type(uint128).max, type(uint128).max, owner, bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1);
        POSM.modifyLiquidities(abi.encode(actions, params), block.timestamp + 60);
    }
}

/// @notice Spike S2 proper: the exit itself, its gas, and who may trigger it.
contract S2ExitForkTest is S2ForkBase {
    function test_CallbackPullsAllLiquidityWithinGasLimit() public {
        uint256 tokenId = _mintTo(address(probe), 100e18);
        uint128 before = POSM.getPositionLiquidity(tokenId);
        assertEq(before, 100e18);
        assertEq(IERC721Owner(address(POSM)).ownerOf(tokenId), address(probe));

        bytes memory payload = abi.encodeCall(ExitProbe.exit, (REACTIVE, tokenId));
        vm.prank(PROXY);
        uint256 g0 = gasleft();
        (bool ok,) = address(probe).call{gas: CALLBACK_GAS}(payload);
        uint256 used = g0 - gasleft();
        assertTrue(ok, "exit reverted inside the callback gas limit");

        assertEq(POSM.getPositionLiquidity(tokenId), 0, "liquidity left in the pool");
        assertGt(t0.balanceOf(recipient), 0, "recipient got no token0");
        assertGt(t1.balanceOf(recipient), 0, "recipient got no token1");
        console.log("S2 exit gas used (incl. call overhead):", used);
        console.log("S2 callback gas limit requested:", uint256(CALLBACK_GAS));
        assertLt(used, CALLBACK_GAS / 2, "exit uses more than half the callback gas limit");
    }

    function test_ExitRejectsDirectCaller() public {
        uint256 tokenId = _mintTo(address(probe), 1e18);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), PROXY));
        probe.exit(REACTIVE, tokenId);
        assertEq(POSM.getPositionLiquidity(tokenId), 1e18);
    }

    function test_ExitRejectsForeignReactiveContract() public {
        uint256 tokenId = _mintTo(address(probe), 1e18);
        address impostor = address(0xBEEF);
        vm.prank(PROXY);
        vm.expectRevert(abi.encodeWithSelector(AbstractCallback.CallbackNotAuthorized.selector, impostor, REACTIVE));
        probe.exit(impostor, tokenId);
        assertEq(POSM.getPositionLiquidity(tokenId), 1e18);
    }

    function test_SecondExitRevertsCleanly() public {
        uint256 tokenId = _mintTo(address(probe), 1e18);
        vm.prank(PROXY);
        probe.exit(REACTIVE, tokenId);
        vm.prank(PROXY);
        vm.expectRevert(abi.encodeWithSelector(ExitProbe.NothingToExit.selector, tokenId));
        probe.exit(REACTIVE, tokenId);
    }

    function test_CannotExitPositionItDoesNotOwn() public {
        uint256 tokenId = _mintTo(address(this), 1e18);
        vm.prank(PROXY);
        vm.expectRevert(); // PositionManager: NotApproved(probe)
        probe.exit(REACTIVE, tokenId);
        assertEq(POSM.getPositionLiquidity(tokenId), 1e18);
    }
}

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC721Min is IERC721Owner {
    function approve(address spender, uint256 id) external;
    function transferFrom(address from, address to, uint256 id) external;
}

/// @dev TEST FIXTURE: a v4 position subscriber that accepts every notification, used to give a position a subscriber.
contract AcceptAllSubscriber {
    fallback() external {}
}

/// @notice Custody questions for Ripcord's vault, answered against the deployed PositionManager bytecode.
contract S2CustodyForkTest is S2ForkBase {
    function test_ApprovedOperatorCanExitWithoutOwningTheNft() public {
        uint256 tokenId = _mintTo(address(this), 1e18);
        IERC721Min(address(POSM)).approve(address(probe), tokenId);
        vm.prank(PROXY);
        probe.exit(REACTIVE, tokenId);
        assertEq(POSM.getPositionLiquidity(tokenId), 0);
        assertEq(IERC721Owner(address(POSM)).ownerOf(tokenId), address(this), "owner keeps the NFT");
    }

    function test_SubscribedPositionIsRefused() public {
        uint256 tokenId = _mintTo(address(this), 1e18);
        POSM.subscribe(tokenId, address(new AcceptAllSubscriber()), "");
        IERC721Min(address(POSM)).approve(address(probe), tokenId);
        vm.prank(PROXY);
        vm.expectRevert(abi.encodeWithSelector(ExitProbe.HasSubscriber.selector, tokenId));
        probe.exit(REACTIVE, tokenId);
    }

    function test_DeployedTransferIntoVaultClearsSubscription() public {
        uint256 tokenId = _mintTo(address(this), 1e18);
        POSM.subscribe(tokenId, address(new AcceptAllSubscriber()), "");
        IERC721Min(address(POSM)).transferFrom(address(this), address(probe), tokenId);
        assertEq(address(POSM.subscriber(tokenId)), address(0), "deployed transferFrom should unsubscribe");
        vm.prank(PROXY);
        probe.exit(REACTIVE, tokenId);
        assertEq(POSM.getPositionLiquidity(tokenId), 0);
    }

    function test_ApprovalDiesWhenOwnerMovesTheNft() public {
        uint256 tokenId = _mintTo(address(this), 1e18);
        IERC721Min(address(POSM)).approve(address(probe), tokenId);
        IERC721Min(address(POSM)).transferFrom(address(this), makeAddr("elsewhere"), tokenId);
        vm.prank(PROXY);
        vm.expectRevert(); // PositionManager: NotApproved(probe)
        probe.exit(REACTIVE, tokenId);
    }
}
