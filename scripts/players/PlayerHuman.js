const PLANET_BORDER_SIZE = .25

var PlayerHuman = (function () {
	class PlayerHuman extends AbstractPlayer {
		/**
		 * @param {string} name Player's name
		 * @param {number} color (0 to 360, Color hue value)
		 * @param {GameEngine} game The game this player is playing
		 */
		constructor(name, color, game) {
			super(name, color, game)

			this.turn = 0
			this.planets = {}
			this.ships = {}
			this.enemies = {}

			console.log('PlayerHuman', this.name, this.color)
		}

		updatePlanetData(updatedData, turn) {
			const planetName = updatedData.name
			if(!this.planets[planetName]) {
				this.planets[planetName] = {}
			}
			const planetData = this.planets[planetName]

			for(const property in updatedData) {
				planetData[property] = updatedData[property]
			}

			if(updatedData.population) {
				planetData.updated = turn
			}
		}

		updateShipData(updatedData, turn) {
			const shipId = updatedData.id
			if(!this.ships[shipId]) {
				const firstKnownLocation = new Point(updatedData)
				firstKnownLocation.turn = turn

				this.ships[shipId] = {firstKnownLocation}
			}
			const shipData = this.ships[shipId]

			for(const property in updatedData) {
				shipData[property] = updatedData[property]
			}
			shipData.updated = turn

			// Compute speed
			if(shipData.turnDestination && shipData.destination) {
				shipData.speed = new Point(
					(shipData.destination.x - shipData.firstKnownLocation.x) / (shipData.turnDestination - shipData.firstKnownLocation.turn),
					(shipData.destination.y - shipData.firstKnownLocation.y) / (shipData.turnDestination - shipData.firstKnownLocation.turn)
				)
			} else if(shipData.firstKnownLocation.turn < turn) {
				shipData.speed = new Point(
					(shipData.x - shipData.firstKnownLocation.x) / (turn - shipData.firstKnownLocation.turn),
					(shipData.y - shipData.firstKnownLocation.y) / (turn - shipData.firstKnownLocation.turn)
				)
			}
		}

		updateUnseenShip(shipId) {
			const ship = this.ships[shipId]

			if(ship.destination) {
				if(ship.turnDestination < this.turn) {
					// Ship is unseen because it has arrived
					delete this.ships[shipId]
				} else {
					// Update location
					ship.x = ship.firstKnownLocation.x + ship.speed.x * (this.turn - ship.firstKnownLocation.turn)
					ship.y = ship.firstKnownLocation.y + ship.speed.y * (this.turn - ship.firstKnownLocation.turn)
				}
			} else {
				// We don't know where the ship is; it may already be arrived to an unknown destination
				delete this.ships[shipId]
			}
		}

		async update(data) {
			this.turn = data.turn

			// Player update
			for(const playerName in data.players) {
				if(playerName === this.name) {
					if(!this.hasLost && data.players[playerName].hasLost) {
						this.hasLost = true
						alert('You have lost!')
					}
				} else {
					if(!(playerName in this.enemies)) {
						this.enemies[playerName] = data.players[playerName]
					}
					if(!this.enemies[playerName].hasLost && data.players[playerName].hasLost) {
						this.enemies[playerName].hasLost = true
						alert(`${playerName} has been defeated!`)
					}
				}
			}
			// if all enemies have lost
			if(!this.hasLost && !this.haveWon && Object.values(this.enemies).every(e => e.hasLost)) {
				alert('You win!')
				this.haveWon = true
			}

			// Planet update
			for(const planetName in data.planets) {
				this.updatePlanetData(data.planets[planetName], data.turn)
			}
			for(const planetName in this.planets) {
				this.planets[planetName].turn = data.turn
			}

			// New ships & Visible ship update
			for(const shipId in data.ships) {
				this.updateShipData(data.ships[shipId], data.turn)
			}

			// Compute unseen ship updated
			for(const shipId in this.ships) {
				this.ships[shipId].turn = data.turn
				if(!data.ships[shipId]) {
					this.updateUnseenShip(shipId)
				}
			}
		}

		requestUpdate() {
			this.game.requestUpdate()
		}

		/**
		 * @param {string} planetName
		 */
		onPlanetClick(planetName) {
			const newSelectedPlanet = this.planets[planetName]
			if(!newSelectedPlanet) {
				throw new Error(`Planet ${planetName} not found`)
			}
			console.debug('PlayerHuman onClick on', planetName)

			const previouslySelectedPlanet = this.selectedPlanet
			if(previouslySelectedPlanet) {
				previouslySelectedPlanet.selected = false
				this.selectedPlanet = null
			}

			newSelectedPlanet.selected = true
			this.selectedPlanet = newSelectedPlanet

			if(previouslySelectedPlanet === newSelectedPlanet) {
				newSelectedPlanet.selected = false
				this.selectedPlanet = null
			} else if(previouslySelectedPlanet && previouslySelectedPlanet.population > 1 && previouslySelectedPlanet.owner.name === this.name) {
				// Send a ship from previously selected planet to this planet
				const shipSize = (previouslySelectedPlanet.population/2)|0
				setTimeout(()=>this.game.sendShip(previouslySelectedPlanet.name, newSelectedPlanet.name, shipSize))

				newSelectedPlanet.selected = false
				this.selectedPlanet = null
			}
		}

		/**
		 * @param {Point} clickLocation
		 */
		async onClick(clickLocation) {
			console.debug('PlayerHuman onClick on empty space')
			const previouslySelectedPlanet = this.selectedPlanet
			if (previouslySelectedPlanet) {
				previouslySelectedPlanet.selected = false
				this.selectedPlanet = null
			}
		}

		async allowIncreaseTurnTo(turn) {
			this.game.advanceToTurn(turn)
		}
	}

	return PlayerHuman
})()
