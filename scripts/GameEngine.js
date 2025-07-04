
var GameEngine = (function() {

	const MAX_GENERATE_PLANETS_TRIES = 999
	const MIN_PLANET_SIZE = .25
	const MAX_PLANET_SIZE = .75
	const MIN_DISTANCE_BETWEEN_PLANETS = 1.5
	const PLANET_RADAR_RANGE = 3 // Distance around player's planet where ship are visible (0=planet surface)
	const PLANET_PRECISE_RADAR_RANGE = 1.5 // Distance around planet where all ship information are known (0=planet surface)
	const SHIP_RADAR_RANGE = 1 // Distance around ship where others ship & planet are visible
	const SHIP_PRECISE_RADAR_RANGE = 0.5 // Distance around ship where others ship full information are known

	// // // GAME ENGINE // // //

	class PlayerConnector {
		// private fields
		#engine
		#player
		#requestedAdvanceTurn

		constructor(engine, player) {
			this.#engine = engine
			this.#player = player
			this.#requestedAdvanceTurn = -1
		}

		// getters
		get width() {
			return this.#engine.width
		}
		get height() {
			return this.#engine.height
		}
		get currentTurn() {
			return this.#engine.turn
		}
		get requestedAdvanceTurn() {
			return this.#requestedAdvanceTurn
		}
		get instantData() {
			return {
				name: this.#player.name,
				color: this.#player.color,
			}
		}
		get name() {
			return this.#player.name
		}

		// PLAYER => ENGINE
		getPlanetDistance(originName, destinationName) {
			const origin = this.#engine.planets.find(p => p.name === originName)
			const destination = this.#engine.planets.find(p => p.name === destinationName)
			if(!origin) {
				throw new Error("Invalid planet name: " + originName)
			} else if(!destination) {
				throw new Error("Invalid planet name: " + destinationName)
			}
			return this.#engine.getSphericalDistance(origin, destination)
		}

		sendShip(originName, destinationName, crewSize, turnOrigin=-1, turnDestination=-1) {
			if(originName === destinationName) {
				throw new Error("Origin and destination are the same planet: " + originName)
			} else if(turnOrigin >= 0 && turnOrigin < this.currentTurn) {
				throw new Error("Cannot send ship in the past: " + turnOrigin + " < " + this.currentTurn + "(current turn)")
			}

			const origin = this.#engine.planets.find(p => p.name === originName)
			const destination = this.#engine.planets.find(p => p.name === destinationName)

			if(!origin) {
				throw new Error("Invalid planet name: " + originName)
			} else if(!destination) {
				throw new Error("Invalid planet name: " + destinationName)
			} else if(origin.owner !== this) {
				console.error(origin, this)
				throw new Error("Player " + this.#player.name + " does not own origin planet: " + origin.name)
			}

			crewSize |= 0 // No floating value
			if(crewSize < 1) {
				throw new Error("Can't send an empty ship")
			} else if(crewSize > origin.population) {
				throw new Error("Not enough population in origin planet: " + origin.name + " (requested " + crewSize + "/" + (origin.population|0) + " inhabitants)")
			}

			const distance = this.#engine.getSphericalDistance(origin, destination)
			if(turnDestination >= 0 && turnOrigin + distance > turnDestination) {
				throw new Error("Distance is too long, ship cannot arrive in requested time: " + turnOrigin + "(departure) + " + distance + "(fastest travel time) = " + (turnOrigin + distance) + " > " + turnDestination + "(arrival)")
			} else if(turnDestination < this.currentTurn + distance) {
				turnDestination = this.currentTurn + distance
			}

			origin.population -= crewSize

			this.#engine.createSpaceShip(origin, destination, this.currentTurn, turnDestination, crewSize)
		}

		advanceToTurn(turn) {
			this.#requestedAdvanceTurn = turn
			this.#engine.advanceTurn()
		}

		// ENGINE => PLAYER
		sendUpdateToPlayer(instantData) {
			this.#player.onReceiveGameUpdate(JSON.parse(JSON.stringify(instantData)))
		}
	}

	class GameEngine {

		constructor(width, height, planetsCount, seed) {
			this.players = []
			this.ships = []
			this.width = width
			this.height = height
			this.rng = seed?RND.newGenerator(seed):RND

			this.planets = []

			this.turn = 0
			this.requestedAdvanceTurn = []

			this.generatePlanets(planetsCount)
		}

		generatePlanets(planetsCount) {
			let retries = MAX_GENERATE_PLANETS_TRIES
			while(this.planets.length < planetsCount && retries > 0) {
				const size = this.rng.float(MIN_PLANET_SIZE, MAX_PLANET_SIZE)
				const x = this.rng.float(size, this.width-size)
				const y = this.rng.float(size, this.height-size)
				const color = this.rng.int(0, 360)
				const name = generatePlanetName([
					1-(size-MIN_PLANET_SIZE)/(MAX_PLANET_SIZE-MIN_PLANET_SIZE),
					color / 360,
				])

				const newP = new Planet(name, x, y, size, color)
				newP.population = this.rng.int(10, 99)

				// Check if planet is not intersecting any other planet
				let intersect = false
				for(const planet of this.planets) {
					if(this.getSphericalDistance(newP, planet) < MIN_DISTANCE_BETWEEN_PLANETS) {
						intersect = true
						break
					}
				}
				if(!intersect) {
					this.planets.push(newP)
				} else {
					retries--
				}
			}
		}

		registerPlayer(player) {
			const connectr = new PlayerConnector(this, player)
			this.players.push(connectr)
			const playerId = this.players.length - 1

			return connectr
		}

		start() {
			if(this.turn > 0) {
				throw new Error("Game already started: Turn " + this.turn)
			}
			if(this.players.length < 2) {
				throw new Error("Not enough players: " + this.players.length + "(players) < 2")
			}
			if(this.players.length > this.planets.length) {
				throw new Error("Too many players: " + this.players.length + "(players) > " + this.planets.length + "(planets)")
			}

			// Give every player one planet to start
			const unownedPlanets = this.rng.shuffle(this.planets.map((_,i)=>i))
			for(let player of this.players) {
				let planet = this.planets[unownedPlanets.shift()]
				planet.owner = player
				console.debug('Planet', planet.name, 'is given to', player.name)
			}

			this.update(0, 0)
		}

		advanceTurn() {
			// Get turn to advance to
			let newTurn = this.getNextEventTurn()

			for(const p of this.players) {
				const requestedTurn = p.requestedAdvanceTurn
				if(requestedTurn < newTurn) {
					newTurn = requestedTurn
				}
			}
			if(newTurn > this.turn) {
				this.update(newTurn)
			}
		}

		/**
		 * Get the next turn number (> currentTurn) of the next event of:
		 * - A ship arrives to destination
		 *
		 * Returns currentTurn + 1 at maximum
		 */
		getNextEventTurn() {
			let nextEventTurn = this.turn + 1
			for(const ship of this.ships) {
				if(ship.turnDestination > this.turn && ship.turnDestination < nextEventTurn) {
					nextEventTurn = ship.turnDestination
				}
			}
			return nextEventTurn
		}

		hasPlayerLost(player) {
			// Player has lost if: Own no planet && no ship
			return this.planets.filter(p => p.owner === player).length === 0 && this.ships.filter(s => s.owner === player).length === 0
		}

		playerInstantData() {
			const playerData = {}
			for(const player of this.players) {
				playerData[player.name] = {
					color: player.color,
					hasLost: this.hasPlayerLost(player),
				}
			}
			return playerData
		}

		updateSinglePlayer(player, arrivedShips=null) {
			const instantData = {
				turn: this.turn,
				planets: {},
				ships: {},
				players: this.playerInstantData(),
			}
			const hasLost = instantData.players[player.name].hasLost

			const myArrivedShips = (arrivedShips || []).filter(s => s.owner === player)
			const myPlanets = []
			const myFlyingShips = this.ships.filter(s => s.owner === player)

			const shipRadars = {}
			for(const ship of myFlyingShips) {
				shipRadars[ship.id] = {planets: [], ships: []}
			}

			for(const planet of this.planets) {
				let showFullData = hasLost || planet.owner === player

				// Attack result
				if(!showFullData) {
					for(const ship of myArrivedShips) {
						if(ship.planetDestination === planet) {
							showFullData = true
							break
						}
					}
				}

				// Ship Radar
				if(!showFullData) {
					for(const ship of myFlyingShips) {
						if(this.getSphericalDistance(planet, ship) <= SHIP_RADAR_RANGE) {
							showFullData = true
							shipRadars[ship.id].planets.push(planet.name)
						}
					}
				}

				// Append information
				instantData.planets[planet.name] = planet.getInstantData(showFullData)
				if(planet.owner === player) {
					instantData.planets[planet.name].radar = {ships: []}
					myPlanets.push(planet)
				}
			}

			for(const ship of this.ships) {
				// Only update ship if owner is player OR if ship is near player's territory
				let showFullShipData = hasLost || ship.owner === player
				let showShipData = showFullShipData

				if(!showFullShipData) {
					// Planet Radar
					for(const planet of myPlanets) {
						const distance = this.getSphericalDistance(planet, ship)
						if(distance <= PLANET_PRECISE_RADAR_RANGE) {
							showFullShipData = showShipData = true
							if(!instantData.planets[planet.name].radar) instantData.planets[planet.name].radar = {ships: []}
							instantData.planets[planet.name].radar.ships.push(ship.name)
						} else if(distance <= PLANET_RADAR_RANGE) {
							showShipData = true
							if(!instantData.planets[planet.name].radar) instantData.planets[planet.name].radar = {ships: []}
							instantData.planets[planet.name].radar.ships.push(ship.name)
						}
					}

					// Ship Radar
					for(const ship2 of myFlyingShips) {
						const distance = this.getSphericalDistance(ship, ship2)
						if(distance <= SHIP_PRECISE_RADAR_RANGE) {
							showFullShipData = (showShipData = true)
							shipRadars[ship2.id].ships.push(ship.name)
						} else if(distance <= SHIP_RADAR_RANGE) {
							showShipData = true
							shipRadars[ship2.id].ships.push(ship.name)
						}
					}
				}

				// Append information
				if(showShipData) {
					instantData.ships[ship.id] = ship.getInstantData(showFullShipData)
					if(ship.id in shipRadars) {
						instantData.ships[ship.id].radar = shipRadars[ship.id]
					}
				}
			}
			setTimeout(()=>player.sendUpdateToPlayer(instantData))
		}


		createSpaceShip(origin, destination, turnOrigin, turnDestination, crewSize) {
			const ss = new SpaceShip(origin, destination, turnOrigin, turnDestination, crewSize, this)
			this.ships.push(ss)
			this.updateSinglePlayer(ss.owner)
			return ss
		}

		getSphericalDistance(from, to) {
			// Return the minimum distance between this and otherElement
			// Logic of this equation: Shift full world such as from is at the center of the board. Then compute distance between from and to
			const dx = this.width/2 - ((to.x - from.x + 2.5*this.width) % this.width)
			const dy = this.height/2 - ((to.y - from.y + 2.5*this.height) % this.height)
			const d = Math.hypot(dx, dy)
			return d - (from.size ?? 0) - (to.size ?? 0)
		}
		getSphericalAngle(from, to) {
			// Returns the angle to get from 'from' to 'to' using minimal distance, taking into account the fact that world is spherical
			// Logic of this equation: Shift full world such as from is at the center of the board. Then compute angle between from and to
			const dx = this.width/2 - ((to.x - from.x + 2.5*this.width) % this.width)
			const dy = this.height/2 - ((to.y - from.y + 2.5*this.height) % this.height)
			return Math.atan2(dy, dx)
		}

		/**
		 * @param {number} added By how much turn has increased since last call (can be float)
		 */
		async update(newTurn) {
			const added = newTurn - this.turn

			// Update turn number
			this.turn = newTurn

			// Add population to planets
			for(const planet of this.planets) {
				planet.increasePopulation(added)
			}

			// Update ships
			const arrivedShips = []
			for(const ship of this.ships) {
				if(ship.turnDestination <= this.turn) {
					arrivedShips.push(ship)
				} else {
					ship.update(this.turn)
				}
			}

			// Apply arrived ships, in order of arrival
			arrivedShips.sort((a,b) => a.turnDestination - b.turnDestination)
			for(const ship of arrivedShips) {
				this.ships.unorderedRm(ship)
				ship.applyArrival()
			}

			// Update player information
			for(const player of this.players) {
				this.updateSinglePlayer(player, arrivedShips)
			}
		}
	}


	// // // PLANET // // //

	class Planet {

		constructor(name, x, y, size, color) {
			this.name = name
			this.x = x
			this.y = y
			this.size = size
			this.color = color

			this.population = 0
			this.owner = null
		}

		getInstantData(isFull=false) {
			const instantData = {
				name: this.name,
				x: this.x,
				y: this.y,
				size: this.size,
				color: this.color,
			}

			if(isFull) {
				instantData.population = this.population|0
				instantData.owner = this?.owner?.instantData
				if(this.owner && !instantData.owner) console.error('planet.getInstantData:', this, instantData)
			}

			return instantData
		}

		/**
		 * @param {number} added Number of turns to consider to increase self population
		 */
		increasePopulation(added) {
			this.population += this.owner ? added*5 : added
		}

	}


	// // // SPACE SHIP // // //
	let shipIds = 0
	class SpaceShip extends Point {
		#gameEngine

		/**
		 * @param {Planet} planetOrigin
		 * @param {Planet} planetDestination
		 * @param {number} turnOrigin
		 * @param {number} turnDestination
		 * @param {number} crewSize
		 */
		constructor(planetOrigin, planetDestination, turnOrigin, turnDestination, crewSize, gameEngine) {
			super(planetOrigin.x, planetOrigin.y)

			// Set ship id
			this.id = (shipIds++)

			this.planetOrigin = planetOrigin
			this.planetDestination = planetDestination
			this.turnOrigin = turnOrigin
			this.turnDestination = turnDestination
			this.crewSize = crewSize

			this.owner = planetOrigin.owner
			this.#gameEngine = gameEngine

			const directTravelAngle = gameEngine.getSphericalAngle(planetOrigin, planetDestination)

			// Precompute travel locations (from surface of origin to surface of destination)
			const angle1 = directTravelAngle
				+ (Math.random() > 0.5 ? 5 : 3) * Math.PI/4 // Origin from the left or right quarted side of origin planet, facing target
				+ (Math.random()-0.5) * Math.PI/3 // A bit of variability from where it starts
			this.pointOrigin = new Point(this.planetOrigin.x + Math.cos(angle1) * this.planetOrigin.size, this.planetOrigin.y + Math.sin(angle1) * this.planetOrigin.size)

			const angle2 = directTravelAngle
				+ ((Math.random()-0.5) * Math.PI/2) // Destination is toward the front of target planet
			this.pointDestination = new Point(this.planetDestination.x + Math.cos(angle2) * this.planetDestination.size, this.planetDestination.y + Math.sin(angle2) * this.planetDestination.size)

			// Set to starting location
			this.x = this.pointOrigin.x
			this.y = this.pointOrigin.y
			this.progress = 0

			this.speed = this.location(this.turnOrigin + .1)
			this.speed.x = (this.speed.x - this.pointOrigin.x)/.1
			this.speed.y = (this.speed.y - this.pointOrigin.y)/.1
		}

		location(currentTurn) {
			const progress = (currentTurn - this.turnOrigin) / (this.turnDestination - this.turnOrigin)
			if(progress < 0) return this.pointOrigin
			if(progress > 1) return this.pointDestination

			const dx =  this.#gameEngine.width/2 - ((this.pointOrigin.x - this.pointDestination.x + 2.5*this.#gameEngine.width) % this.#gameEngine.width)
			const dy =  this.#gameEngine.height/2 - ((this.pointOrigin.y - this.pointDestination.y + 2.5*this.#gameEngine.height) % this.#gameEngine.height)

			const x = ((this.pointOrigin.x + dx * progress) + this.#gameEngine.width) % this.#gameEngine.width
			const y = ((this.pointOrigin.y + dy * progress) + this.#gameEngine.height) % this.#gameEngine.height
			return new Point(x, y)
		}
		update(currentTurn) {
			this.progress = (currentTurn - this.turnOrigin) / (this.turnDestination - this.turnOrigin)

			const xy = this.location(currentTurn)
			this.x = xy.x
			this.y = xy.y
		}

		applyArrival() {
			if(this.owner === this.planetDestination.owner) {
				// Reinforcement
				this.planetDestination.population += this.crewSize
			} else if(this.planetDestination.population < this.crewSize) {
				// Successful attack
				this.planetDestination.owner = this.owner
				this.planetDestination.population = (this.crewSize- this.planetDestination.population)
				console.debug('Planet', this.planetDestination.name, 'has been conqueered by', this.owner.name)
			} else {
				// Unsuccessful attack
				this.planetDestination.population -= this.crewSize
			}

			this.crewSize = 0 // Security
		}

		getInstantData(isFull=false) {
			const instantData = {
				id: this.id,
				x: this.x,
				y: this.y,
				speed: new Point(this.speed.x, this.speed.y),
			}

			if(isFull) {
				instantData.planetOrigin = this.planetOrigin.name
				instantData.planetDestination = this.planetDestination.name
				instantData.turnDestination = this.turnDestination
				instantData.crewSize = this.crewSize
				instantData.destination = new Point(this.pointDestination)
				instantData.owner = this.owner ? this.owner.instantData : null
			}

			return instantData
		}

	}

	// // // FUNCTIONS // // //

	const NAME_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZΓΔΘΛΞΠΣΦΨΩ0123456789"
	function generatePlanetName(values) {
		let gen = NAME_LETTERS[(values.shift()*NAME_LETTERS.length-.5)|0].toUpperCase()
		for(const v of values) {
			gen += NAME_LETTERS[(v*NAME_LETTERS.length-.5)|0].toLowerCase()
		}

		return gen
	}


	return GameEngine
})()
