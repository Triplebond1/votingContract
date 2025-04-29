import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Voting", function () {
  async function deploymentFixture() {
    const [owner, acct1, acct2, acct3] = await hre.ethers.getSigners();
    const QUESTION: string = "Who should be the next leader?";
    const OPTIONS: string[] = ["Alice", "Bob", "Charlie"];
    const _option: string = "Alice";
    const _option1: string = "Bob";
    const pollIndex: number = 0;
    const Vote = await hre.ethers.getContractFactory("Voting");
    const vote = await Vote.deploy();

    return {
      vote,
      owner,
      acct1,
      acct2,
      acct3,
      QUESTION,
      OPTIONS,
      _option,
      _option1,
      pollIndex,
    };
  }

  const createPoll = async () => {
    const { QUESTION, OPTIONS, vote } = await loadFixture(deploymentFixture);
    await vote.createPoll(QUESTION, OPTIONS);
  };

  describe("deployment", function () {
    it("should set the right owner", async function () {
      const { vote, owner } = await loadFixture(deploymentFixture);

      expect(await vote.owner()).to.equal(owner.address);
    });
  });

  describe("createPoll", function () {
    it("Should allow owner to create a poll", async () => {
      const { QUESTION, OPTIONS, vote } = await loadFixture(deploymentFixture);
      await expect(vote.createPoll(QUESTION, OPTIONS))
        .to.emit(vote, "PollCreated")
        .withArgs(0, QUESTION, OPTIONS);
      expect(await vote.pollCount()).to.equal(1);

      const poll: [string, string[], bigint[], boolean] =
        await vote.getPollResults(0);
      expect(poll[0]).to.equal(QUESTION);
      expect(poll[1]).to.deep.equal(OPTIONS);
      expect(poll[3]).to.be.true;
      expect(poll[2]).to.deep.equal([0n, 0n, 0n]); // No votes yet
    });

    it("should revert if called from other account", async function () {
      const { acct1, QUESTION, OPTIONS, vote } = await loadFixture(
        deploymentFixture
      );

      await expect(
        vote.connect(acct1).createPoll(QUESTION, OPTIONS)
      ).to.be.revertedWithCustomError(vote, "OwnableUnauthorizedAccount");
    });

    it("should revert if option is less than 0", async function () {
      const { QUESTION, vote } = await loadFixture(deploymentFixture);
      const OPTIONS: string[] = [];
      await expect(vote.createPoll(QUESTION, OPTIONS)).to.be.revertedWith(
        "Options array cannot be empty"
      );
    });

    it("it should emit pollcount, options and qustion", async function () {
      const { QUESTION, OPTIONS, vote } = await loadFixture(deploymentFixture);

      await expect(vote.createPoll(QUESTION, OPTIONS))
        .to.emit(vote, "PollCreated")
        .withArgs(0, QUESTION, OPTIONS);
      expect(await vote.pollCount()).to.equal(1);
      const poll: [string, string[], bigint[], boolean] =
        await vote.getPollResults(0);
      expect(poll[0]).to.equal(QUESTION);
      expect(poll[1]).to.deep.equal(OPTIONS);
      expect(poll[3]).to.be.true;
      expect(poll[2]).to.deep.equal([0n, 0n, 0n]); // No votes yet
    });
  });

  describe("vote", function () {
    it("should be able to vote", async () => {
      const { acct1, vote, _option } = await loadFixture(deploymentFixture);
      const pollIndex: number = 0;
      await createPoll();
      await expect(vote.connect(acct1).vote(_option, pollIndex))
        .to.emit(vote, "VoteCast")
        .withArgs(acct1, _option);

      const poll: [string, string[], bigint[], boolean] =
        await vote.getPollResults(0);
      expect(poll[2]).to.deep.equal([1n, 0n, 0n]);
    });

    it("should revert if poll does not exist", async () => {
      const { acct1, vote, _option } = await loadFixture(deploymentFixture);
      const pollIndex: number = 1;
      await createPoll();
      await expect(
        vote.connect(acct1).vote(_option, pollIndex)
      ).to.be.revertedWith("Poll does not exist");
    });

    it("should revert if user have voted before", async function () {
      const { acct1, vote, _option, _option1, pollIndex } = await loadFixture(
        deploymentFixture
      );
      await createPoll();
      await vote.connect(acct1).vote(_option, pollIndex);
      await expect(
        vote.connect(acct1).vote(_option1, pollIndex)
      ).to.be.rejectedWith("You have already voted");
    });

    it("should revert if poll is closed", async function () {
      const { acct1, vote, _option, pollIndex } = await loadFixture(
        deploymentFixture
      );
      await createPoll();
      await vote.closePoll(0, "the poll is now closed");
      await expect(
        vote.connect(acct1).vote(_option, pollIndex)
      ).to.revertedWith("Poll is closed");
    });
  });

  describe("getPollResult", () => {
    it("should be able to get poll result", async () => {
      const {
        acct1,
        acct2,
        vote,
        QUESTION,
        OPTIONS,
        _option,
        _option1,
        pollIndex,
      } = await loadFixture(deploymentFixture);
      await createPoll();
      await vote.connect(acct1).vote(_option, pollIndex);
      await vote.connect(acct2).vote(_option1, pollIndex);
      const poll: [string, string[], bigint[], boolean] =
        await vote.getPollResults(pollIndex);
      expect(poll[0]).to.equal(QUESTION);
      expect(poll[1]).to.deep.equal(OPTIONS);
      expect(poll[2]).to.deep.equal([1n, 1n, 0n]); // Alice: 1, Bob: 1, Charlie: 0
      expect(poll[3]).to.be.true;
    });

    it("should revert if poll does not exist", async () => {
      const { acct1, vote } = await loadFixture(deploymentFixture);
      await createPoll();
      await expect(vote.connect(acct1).getPollResults(1)).to.be.rejectedWith(
        "Poll does not exist"
      );
    });
  });

  describe("closepoll", () => {
    it("should be able to close poll", async () => {
      const {
        acct1,
        acct2,
        acct3,
        QUESTION,
        OPTIONS,
        vote,
        _option,
        _option1,
        pollIndex,
      } = await loadFixture(deploymentFixture);
      await createPoll();
      await vote.connect(acct1).vote(_option, pollIndex);
      await vote.connect(acct2).vote(_option1, pollIndex);
      await vote.connect(acct3).vote(_option1, pollIndex);
      const closeMsg: string = "the poll is closed and this is the winner";

      await expect(vote.closePoll(pollIndex, closeMsg))
        .to.emit(vote, "PollClosed")
        .withArgs(closeMsg, _option1, 2);

      const poll: [string, string[], bigint[], boolean] =
        await vote.getPollResults(0);
      expect(poll[0]).to.equal(QUESTION);
      expect(poll[1]).to.deep.equal(OPTIONS);
      expect(poll[3]).to.be.false;
      expect(poll[2]).to.deep.equal([1n, 2n, 0n]);
    });

    it("should revert if poll already closed", async () => {
      const { vote, pollIndex } = await loadFixture(deploymentFixture);
      await createPoll();
      const closeMsg: string = "the poll is closed and this is the winner";
      vote.closePoll(pollIndex, closeMsg);
      await expect(vote.closePoll(pollIndex, closeMsg)).to.be.revertedWith(
        "Poll is already closed"
      );
    });

    it("Should handle zero votes", async () => {
      const { vote } = await loadFixture(deploymentFixture);
      // Create a new poll with no votes
      await createPoll();
      await expect(vote.closePoll(0, "Poll closed"))
        .to.emit(vote, "PollClosed")
        .withArgs("Poll closed", "", 0); // No winner

      const poll: [string, string[], bigint[], boolean] =
        await vote.getPollResults(0);
      expect(poll[3]).to.be.false;
    });

    it("Should revert if non-owner tries to close a poll", async () => {
      const { acct1, vote } = await loadFixture(deploymentFixture);
      await createPoll();
      await expect(
        vote.connect(acct1).closePoll(0, "Poll closed")
      ).to.be.revertedWithCustomError(vote, "OwnableUnauthorizedAccount");
    });
  });

  deploymentFixture();
});
