// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// . Decentralized Voting System
// Description: Build a contract where users
// can create polls, vote on options, and view results.
// Only authorized users (e.g., the poll creator) can start or end the poll.
// Learning Objectives:
// Use structs and mappings to manage poll data.
// Implement access control (e.g., Ownable from OpenZeppelin).
// Handle events for vote updates and poll status changes.
// Practice secure input validation to prevent double-voting.
// Features:
// Create a poll with multiple options.
// Allow users to vote once per poll.
// End the poll and reveal the winner.
// Emit events for vote casts and poll closure.

import "@openzeppelin/contracts/access/Ownable.sol";


/// @title Decentralized Voting System
/// @notice Allows the owner to create polls, users to vote, and view results
contract Voting is Ownable{
    struct Poll {
        string question;
        string[] options;
        mapping(string => uint256) votes;
        mapping(address => bool) votedUser;
        bool isActive;
    }

    mapping(uint256 => Poll) public Polls;
    uint256 public pollCount;

    event VoteCast(address indexed user, string option);
    event PollClosed(string closedMsg, string winningOption, uint256 votes);
    event PollCreated(
        uint256 indexed pollIndex,
        string question,
        string[] options
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Creates a new poll with a question and options
    /// @param _question The poll question
    /// @param _option Array of voting options
    function createPoll(
        string memory _question,
        string[] memory _option
    ) external onlyOwner {
        require(_option.length > 0, "Options array cannot be empty");
        Poll storage newPoll = Polls[pollCount];
        newPoll.question = _question;
        newPoll.options = _option;
        newPoll.isActive = true;
        emit PollCreated(pollCount, _question, _option);
        pollCount++;
    }

    /// @notice Checks if an option is valid for a given poll
    /// @param _option The option to validate
    /// @param pollIndex The poll ID
    /// @return True if the option is valid, false otherwise
    function validOption(
        string memory _option,
        uint256 pollIndex
    ) internal view returns (bool) {
        Poll storage cast = Polls[pollIndex];
        for (uint256 i = 0; i < cast.options.length; i++) {
            if (
                keccak256(bytes(cast.options[i])) == keccak256(bytes(_option))
            ) {
                return true;
            }
        }
        return false;
    }

    /// @notice Allows a user to vote in a poll
    /// @param _option The option to vote for
    /// @param pollIndex The poll ID
    function vote(
        string memory _option,
        uint256 pollIndex
    ) public  {
        require(pollIndex < pollCount, "Poll does not exist");
        Poll storage cast = Polls[pollIndex];
        require(!cast.votedUser[msg.sender], "You have already voted");
        require(validOption(_option, pollIndex), "Option is not valid");
        require(cast.isActive, "Poll is closed");
        cast.votes[_option]++;
        cast.votedUser[msg.sender] = true;
        emit VoteCast(msg.sender, _option);
    }

    /// @notice Closes a poll and determines the winner
    /// @param pollIndex The poll ID
    /// @param closedMsg Message to include when closing the poll
    function closePoll(
        uint256 pollIndex,
        string memory closedMsg
    ) public onlyOwner {
        require(pollIndex < pollCount, "Poll does not exist");
        Poll storage myPoll = Polls[pollIndex];
        require(myPoll.isActive, "Poll is already closed");

        uint256 highestVote = 0;
        string memory winningOption;

        for (uint256 i = 0; i < myPoll.options.length; i++) {
            if (myPoll.votes[myPoll.options[i]] > highestVote) {
                highestVote = myPoll.votes[myPoll.options[i]];
                winningOption = myPoll.options[i];
            }
        }

        myPoll.isActive = false;
        emit PollClosed(closedMsg, winningOption, highestVote);
    }

    function getPollResults(
        uint256 pollIndex
    )
        external
        view
        returns (
            string memory question,
            string[] memory options,
            uint256[] memory voteCounts,
            bool isActive
        )
    {
        require(pollIndex < pollCount, "Poll does not exist");
        Poll storage poll = Polls[pollIndex];
        uint256[] memory counts = new uint256[](poll.options.length);
        for (uint256 i = 0; i < poll.options.length; i++) {
            counts[i] = poll.votes[poll.options[i]];
        }
        return (poll.question, poll.options, counts, poll.isActive);
    }
}
