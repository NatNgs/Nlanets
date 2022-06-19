class AbstractPlayer {
	// this.name: string

	// this.color: number (0 -> 360)

	/* this.game: {
			width: number
			height: number
			sendShip: function(originName, destinationName, crewSize, ?turnOrigin, ?turnDestination)
			getPlanetDistance: function(originName, destinationName)
		}
	*/

	/**
	 * @param {string} name Player's name
	 * @param {number} color (0 to 360, Color hue value)
	 * @param {GameEngine} game The game this player is playing
	 */
	constructor(name, color, game) {
		this.name = name
		this.color = (+color|0)%360

		// Register player to the game
		this.game = game.registerPlayer(this)
	}

	/**
	 * Called after every series of "updatePlanet" and "updateShip" calls
	 * To be overriden by subclasses
	 *
	 * @param {any} data ```
	 * 	{
	 * 		turn: number,
	 * 		planets: {
	 * 			<planetName>: <output of Planet.getInstantData()>, ...
	 * 		}
	 * 		ships: {
	 * 			<shipId>: <output of SpaceShip.getInstantData()>, ...
	 * 		}
	 * 	}```
	 */
	update(data) {
		throw new Error("Non Implemented Abstract method")
	}

	get instantData() {
		return {
			name: this.name,
			color: this.color,
		}
	}
}
