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
				this.planets[planetName].updated = data.turn
			}
			for(const shipName in data.ships) {
				if(!this.ships[shipName]) {
					this.ships[shipName] = {}
				}
				for(const property in data.ships[shipName]) {
					this.ships[shipName][property] = data.ships[shipName][property]
				}
				this.ships[shipName].updated = data.turn
			}
			for(const shipName in this.ships) {
				if(!data.ships[shipName]) {
					delete this.ships[shipName]
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
