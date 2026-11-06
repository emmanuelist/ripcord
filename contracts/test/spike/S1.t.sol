// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, Vm} from "forge-std/Test.sol";
import {IReactive} from "reactive-lib-omni/interfaces/IReactive.sol";
import {ISystemContract} from "reactive-lib-omni/interfaces/ISystemContract.sol";
import {AbstractPayer} from "reactive-lib-omni/base/AbstractPayer.sol";
import {PingSource} from "../../src/spike/PingSource.sol";
import {PongSink} from "../../src/spike/PongSink.sol";
import {PingReactive} from "../../src/spike/PingReactive.sol";
import {SystemStub} from "../utils/SystemStub.sol";
import {OBSERVED_PROXY_OVERHEAD_GAS} from "../utils/ReactiveBudget.sol";

contract S1Test is Test {
    address internal constant SYSTEM = 0x8888888888888888888888888888888888888888;
    uint256 internal constant REACTIVE_IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;
    uint256 internal constant POOL_CHAIN = 1301; // Unichain Sepolia
    address internal constant PROXY = address(0xC0FFEE); // stands in for the pool chain's callback proxy

    SystemStub internal sys;
    PingSource internal source;
    PongSink internal sink;
    PingReactive internal rc;

    function setUp() public {
        vm.etch(SYSTEM, address(new SystemStub()).code);
        sys = SystemStub(payable(SYSTEM));
        source = new PingSource();
        // The sink must know the reactive contract's address before it exists, as on testnet (nonce precompute).
        address expected = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        sink = new PongSink(PROXY, expected);
        rc = new PingReactive(POOL_CHAIN, address(source), POOL_CHAIN, address(sink));
        assertEq(address(rc), expected, "precomputed reactive address");
    }

    function test_SubscribesToPingOnPoolChainOnly() public view {
        assertEq(sys.subscriptionCount(), 1);
        (uint256 chainId, address emitter, uint256 t0, uint256 t1, uint256 t2, uint256 t3) = sys.subscriptions(0);
        assertEq(chainId, POOL_CHAIN);
        assertEq(emitter, address(source));
        assertEq(t0, uint256(PingSource.Ping.selector));
        assertEq(t0, rc.PING_TOPIC());
        assertEq(t1, REACTIVE_IGNORE);
        assertEq(t2, REACTIVE_IGNORE);
        assertEq(t3, REACTIVE_IGNORE);
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(PingReactive.ZeroAddress.selector);
        new PingReactive(POOL_CHAIN, address(0), POOL_CHAIN, address(sink));
        vm.expectRevert(PingReactive.ZeroAddress.selector);
        new PingReactive(POOL_CHAIN, address(source), POOL_CHAIN, address(0));
    }

    function test_ReactRejectsAnyoneButSystem() public {
        IReactive.LogRecord memory log_ = _pingLog(1);
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), SYSTEM));
        rc.react(log_);
    }

    function test_ReactRejectsLogFromWrongEmitter() public {
        IReactive.LogRecord memory log_ = _pingLog(1);
        log_.contractAddress = address(0xBAD);
        vm.prank(SYSTEM);
        vm.expectRevert(
            abi.encodeWithSelector(PingReactive.UnexpectedLog.selector, POOL_CHAIN, address(0xBAD), log_.topic0)
        );
        rc.react(log_);
    }

    function test_ReactRejectsLogFromWrongChain() public {
        IReactive.LogRecord memory log_ = _pingLog(1);
        log_.chainId = 84532;
        vm.prank(SYSTEM);
        vm.expectRevert(
            abi.encodeWithSelector(PingReactive.UnexpectedLog.selector, 84532, address(source), log_.topic0)
        );
        rc.react(log_);
    }

    function test_ReactRequestsOneCallbackToSink() public {
        vm.prank(SYSTEM);
        rc.react(_pingLog(7));
        assertEq(sys.requestCount(), 1);
        ISystemContract.CallbackConfiguration_V_1_0 memory req = sys.request(0);
        assertEq(req.chainId, POOL_CHAIN);
        assertEq(req.recipient, address(sink));
        assertGe(req.gasLimit, 100_000, "Reactive ignores callbacks under 100k gas");
        assertEq(req.payload, abi.encodeCall(PongSink.pong, (address(0), 7, 123, uint256(keccak256("origin-tx-7")))));
    }

    /// @notice Regression for the S1 v2 on-chain failure: the proxy forwards only gasLimit minus its overhead.
    function test_CallbackGasLeavesEnoughForPongAfterProxyOverhead() public {
        uint256 forwarded = uint256(rc.CALLBACK_GAS()) - OBSERVED_PROXY_OVERHEAD_GAS;
        bytes memory delivered = abi.encodeCall(PongSink.pong, (address(rc), 1, 1, 1));
        vm.prank(PROXY);
        (bool ok,) = address(sink).call{gas: forwarded}(delivered);
        assertTrue(ok, "pong runs out of gas inside the proxy's forwarded budget");
        assertEq(sink.pongs(), 1);
    }

    function test_SinkRejectsCallsNotFromProxy() public {
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), PROXY));
        sink.pong(address(rc), 1, 1, 1);
    }

    function test_SinkFlagsUnexpectedInjectedSender() public {
        vm.recordLogs();
        vm.prank(PROXY);
        sink.pong(address(0xDEAD), 1, 1, 1);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        (bool senderIsExpected,,,) = abi.decode(logs[0].data, (bool, uint256, uint256, uint256));
        assertFalse(senderIsExpected);
    }

    /// @notice Whole loop locally: real Ping event -> react() -> the documented sender overwrite -> PongSink.
    function test_FullLoopSimulated() public {
        vm.recordLogs();
        uint256 seq = source.ping();
        Vm.Log[] memory pingLogs = vm.getRecordedLogs();
        assertEq(pingLogs.length, 1);

        IReactive.LogRecord memory log_ = IReactive.LogRecord({
            chainId: POOL_CHAIN,
            contractAddress: pingLogs[0].emitter,
            topic0: uint256(pingLogs[0].topics[0]),
            topic1: uint256(pingLogs[0].topics[1]),
            topic2: uint256(pingLogs[0].topics[2]),
            topic3: 0,
            data: pingLogs[0].data,
            blockNumber: block.number,
            opCode: 3,
            blockHash: 0,
            txHash: uint256(keccak256("origin-tx")),
            logIndex: 0
        });
        vm.prank(SYSTEM);
        rc.react(log_);

        // Reactive overwrites the first 160 bits of the payload's first argument with the requester's address.
        bytes memory payload = sys.request(0).payload;
        bytes memory delivered = abi.encodePacked(bytes4(payload), abi.encode(address(rc)), _slice(payload, 36));

        vm.recordLogs();
        vm.prank(PROXY);
        (bool ok,) = address(sink).call(delivered);
        assertTrue(ok);
        Vm.Log[] memory pongLogs = vm.getRecordedLogs();
        assertEq(uint256(pongLogs[0].topics[1]), seq);
        assertEq(address(uint160(uint256(pongLogs[0].topics[2]))), address(rc));
        (bool senderIsExpected,,,) = abi.decode(pongLogs[0].data, (bool, uint256, uint256, uint256));
        assertTrue(senderIsExpected);
        assertEq(sink.pongs(), 1);
    }

    function _pingLog(uint256 seq) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chainId: POOL_CHAIN,
            contractAddress: address(source),
            topic0: uint256(PingSource.Ping.selector),
            topic1: seq,
            topic2: uint256(uint160(address(this))),
            topic3: 0,
            data: abi.encode(block.timestamp),
            blockNumber: 123,
            opCode: 3,
            blockHash: 0,
            txHash: uint256(keccak256(abi.encodePacked("origin-tx-", vm.toString(seq)))),
            logIndex: 0
        });
    }

    function _slice(bytes memory b, uint256 from) internal pure returns (bytes memory out) {
        out = new bytes(b.length - from);
        for (uint256 i = 0; i < out.length; ++i) {
            out[i] = b[from + i];
        }
    }
}
