var RandomAI = (function () {
	class RandomAI extends AbstractPlayer {
		/* Extended properties, see AbstractPlayer
		 * this.name
		 * this.color
		 * this.game
		 */


		/**
		 * @param {string} name Player's name
		 * @param {number} color (0 to 360, Color hue value)
		 * @param {GameEngine} game The game this player is playing
		 */
		constructor(name, color, game) {
			super('RandomAI ' + name, color, game)

			// Prepare for acting
			this.actData = {
				lastSentShipSize: 0
			}

			this.planets = {}
			this.ships = {}

			console.log(this.name, this.color)
		}

		update(data) {
			this.turn = data.turn
			for(const planetName in data.planets) {
				const dta = data.planets[planetName]
				dta.updated = data.turn
				this.planets[planetName] = dta
			}
			for(const shipName in data.ships) {
				const dta = data.ships[shipName]
				dta.updated = data.turn
				this.ships[shipName] = dta
			}

			setTimeout(()=>this.act())
		}

		act() {
			// Sort planets
			const myPlanets = []
			const notMyPlanets = []
			for(const p of Object.values(this.planets)) {
				if(p.owner && p.owner.name === this.name) {
					myPlanets.push(p)
				} else {
					notMyPlanets.push(p)
				}
			}
			myPlanets.sort((a, b)=>b.population - a.population)

			if(myPlanets.length <= 0 || notMyPlanets.length <= 0 || myPlanets[0].population < this.actData.lastSentShipSize) {
				this.game.advanceToTurn(this.turn + 1)
				// Wait longer
				return
			}

			// Send random ship from my planet to random planet
			const myBestPlanet = myPlanets[0]
			const target = notMyPlanets[Math.floor(Math.random()*notMyPlanets.length)]
			const shipSize = (Math.random()*(myBestPlanet.population - this.actData.lastSentShipSize - 1) + this.actData.lastSentShipSize + 1)|0

			this.game.sendShip(myBestPlanet.name, target.name, shipSize)
			this.actData.lastSentShipSize = shipSize

			this.game.advanceToTurn(this.turn + 1)
		}
	}

	return RandomAI
})()
