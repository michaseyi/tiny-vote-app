const { WebSocketServer } = require("ws")
const { createServer } = require("http")
const { createReadStream } = require("fs")

let candidates = ["Wizkid", "BurnaBoy", "Davido"]

let votes = new Map()

const users = new Map()

const pages = {
	"/": "index.html",
	"/vote": "vote.html",
	"/bootstrap.min.css": "bootstrap.min.css",
}

const PORT = 3000

let server

let ws

function registerVote(candidate, voter) {
	// gets the votes for a particular candidate
	let candidateVotes = votes.get(candidate)
	if (!candidateVotes) {
		votes.set(candidate, new Set([voter]))
	} else if (candidateVotes.has(voter)) {
		return
	} else {
		candidateVotes.add(voter)
	}

	// sends a new vote update to all voters
	Array.from(users.values()).forEach((userSocket) => {
		userSocket.send(
			JSON.stringify({
				type: "new_vote",
				voter,
				candidate,
			})
		)
	})
}

function enumerateVotes(votes) {
	let enumeratedVotes = {}

	Array.from(votes.entries()).forEach(([candidate, votes]) => {
		enumeratedVotes[candidate] = Array.from(votes)
	})

	return enumeratedVotes
}

function sendVoteStat(userSocket) {
	userSocket.send(
		JSON.stringify({
			type: "stat",
			candidates,
			votes: enumerateVotes(votes),
		})
	)
}

function setupServer() {
	server = createServer((req, res) => {
		const filePath = pages[req.url]
		if (filePath) {
			createReadStream(filePath).pipe(res)
		} else {
			res.statusCode = 404
			res.end("<h1>Not found</h1>")
		}
	})

	ws = new WebSocketServer({ server }, () => {
		console.log("Server running")
	})
}

function setListeners() {
	ws.on("connection", (userSocket, req) => {
		
		users.set(userSocket, userSocket)
		sendVoteStat(userSocket)

		// listen out for messages from the user
		userSocket.on("message", (chunk) => {
			const message = JSON.parse(chunk)
			switch (message.type) {
				case "add_vote":
					const { voter, candidate } = message
					registerVote(candidate, voter)
			}
		})

		// performs clean ups when user disconnets
		userSocket.on("close", () => {
			users.delete(userSocket)
		})
	})
}

setupServer()
setListeners()

server.listen(PORT, "0.0.0.0")
