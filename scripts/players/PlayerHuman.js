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

			console.log('PlayerHuman', this)
		}

		update(data) {
			this.turn = data.turn

			for(const planetName in data.planets) {
				if(!this.planets[planetName]) {
					this.planets[planetName] = {}
				}

				for(const property in data.planets[planetName]) {
					this.planets[planetName][property] = data.planets[planetName][property]
				}
				for(const property in this.planets[planetName]) {
					if(!(property in data.planets[planetName])) {
						delete this.planets[planetName][property]
					}
				}
				this.planets[planetName].updated = data.turn
			}
			for(const shipId in data.ships) {
				if(!this.ships[shipId]) {
					this.ships[shipId] = {
						firstKnownLocation: new Point(data.ships[shipId]),
					}
					this.ships[shipId].firstKnownLocation.turn = data.turn
				}
				const firstKnownLocation = this.ships[shipId].firstKnownLocation
				for(const property in data.ships[shipId]) {
					this.ships[shipId][property] = data.ships[shipId][property]
				}
				for(const property in this.ships[shipId]) {
					if(!property in data.ships[shipId]) {
						delete this.ships[shipId][property]
					}
				}
				this.ships[shipId].firstKnownLocation = firstKnownLocation
				this.ships[shipId].updated = data.turn

				if(firstKnownLocation.turn < data.turn) {
					// Compute next turn location
					const speedX = (this.ships[shipId].x - firstKnownLocation.x) / (data.turn - firstKnownLocation.turn)
					const speedY = (this.ships[shipId].y - firstKnownLocation.y) / (data.turn - firstKnownLocation.turn)
					this.ships[shipId].nextTurnLocation = new Point(this.ships[shipId].x + speedX, this.ships[shipId].y + speedY)
				}
			}
			for(const shipId in this.ships) {
				if(!data.ships[shipId]) {
					delete this.ships[shipId]
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
			} else if(previouslySelectedPlanet && previouslySelectedPlanet.population > 0 && previouslySelectedPlanet.owner.name === this.name) {
				// Send a ship from previously selected planet to this planet
				const shipSize = (Math.random() * (previouslySelectedPlanet.population - 1) + 1) | 0
				this.game.sendShip(previouslySelectedPlanet.name, newSelectedPlanet.name, shipSize)

				newSelectedPlanet.selected = false
				this.selectedPlanet = null
			}
		}

		/**
		 * @param {Point} clickLocation
		 */
		onClick(clickLocation) {
			const previouslySelectedPlanet = this.selectedPlanet
			if (previouslySelectedPlanet) {
				previouslySelectedPlanet.selected = false
				this.selectedPlanet = null
			}
		}

		allowIncreaseTurnTo(turn) {
			this.game.advanceToTurn(turn)
		}
	}

	return PlayerHuman
})()
