
var GameEngine = (function() {

	const MAX_GENERATE_PLANETS_TRIES = 999
	const MIN_PLANET_SIZE = .25
	const MAX_PLANET_SIZE = .75
	const MIN_DISTANCE_BETWEEN_PLANETS = 1.5
	const PLANET_RADAR_RANGE = 1.5 // Distance around player's planet where all ship information are known
	const SHIP_RADAR_RANGE = 1 // Distance around player's ship where all ship & planet information are known

	// // // GAME ENGINE // // //

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
				const x = this.rng.float(MIN_DISTANCE_BETWEEN_PLANETS, this.width - MIN_DISTANCE_BETWEEN_PLANETS)
				const y = this.rng.float(MIN_DISTANCE_BETWEEN_PLANETS, this.height - MIN_DISTANCE_BETWEEN_PLANETS)
				const size = this.rng.float(MIN_PLANET_SIZE, MAX_PLANET_SIZE)
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
					if(newP.distanceTo(planet) < MIN_DISTANCE_BETWEEN_PLANETS) {
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
			this.players.push(player)
			const playerId = this.players.length - 1

			this.requestedAdvanceTurn[playerId] = -1

			return {
				width: this.width,
				height: this.height,
				getPlanetDistance: (originName, destinationName) => {
					const origin = this.planets.find(p => p.name === originName)
					const destination = this.planets.find(p => p.name === destinationName)
					if(!origin) {
						throw new Error("Invalid planet name: " + originName)
					} else if(!destination) {
						throw new Error("Invalid planet name: " + destinationName)
					}
					return origin.distanceTo(destination)
				},
				sendShip: (originName, destinationName, crewSize, turnOrigin=-1, turnDestination=-1) => {
					if(originName === destinationName) {
						throw new Error("Origin and destination are the same planet: " + originName)
					} else if(turnOrigin >= 0 && turnOrigin < this.turn) {
						throw new Error("Cannot send ship in the past: " + turnOrigin + " < " + this.turn + "(current turn)")
					}

					const origin = this.planets.find(p => p.name === originName)
					const destination = this.planets.find(p => p.name === destinationName)

					if(!origin) {
						throw new Error("Invalid planet name: " + originName)
					} else if(!destination) {
						throw new Error("Invalid planet name: " + destinationName)
					} else if(origin.owner !== player) {
						throw new Error("Player " + player.name + " does not own origin planet: " + origin.name)
					}

					crewSize |= 0 // No floating value
					if(crewSize < 1) {
						throw new Error("Can't send an empty ship")
					} else if(crewSize > origin.population) {
						throw new Error("Not enough population in origin planet: " + origin.name + " (requested " + crewSize + "/" + (origin.population|0) + " inhabitants)")
					}

					const distance = origin.distanceTo(destination)
					if(turnDestination >= 0 && turnOrigin + distance > turnDestination) {
						throw new Error("Distance is too long, ship cannot arrive in requested time: " + turnOrigin + "(departure) + " + distance + "(fastest travel time) = " + (turnOrigin + distance) + " > " + turnDestination + "(arrival)")
					} else if(turnDestination < this.turn + distance) {
						turnDestination = this.turn + distance
					}

					origin.population -= crewSize
					const ship = new SpaceShip(origin, destination, this.turn, turnDestination, crewSize)
					this.ships.push(ship)
					return this.updateSinglePlayer(player)
				},
				advanceToTurn: (turn) => {
					this.requestedAdvanceTurn[playerId] = turn
					if(turn > this.turn) {
						this.advanceTurn()
					}
				},
			}
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
			const unownedPlanets = this.rng.shuffle(this.planets.copy())
			for(let player of this.players) {
				let planet = unownedPlanets.shift()
				planet.owner = player
			}

			this.update(0, 0)
		}

		advanceTurn() {
			// Get turn to advance to
			let newTurn = this.getNextEventTurn()

			for(const requestedTurn of this.requestedAdvanceTurn) {
				if(requestedTurn < newTurn) {
					newTurn = requestedTurn
				}
			}
			if(newTurn > this.turn) {
				this.update(newTurn, newTurn - this.turn)
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

		updateSinglePlayer(player, arrivedShips=null) {
			const instantData = {
				turn: this.turn,
				planets: {},
				ships: {},
			}

			const hasLost = this.hasPlayerLost(player)

			const myArrivedShips = (arrivedShips || []).filter(s => s.owner === player)
			const myPlanets = this.planets.filter(p => p.owner === player)
			const myFlyingShips = this.ships.filter(s => s.owner === player)

			for(const planet of this.planets) {
				let showFullData = hasLost || planet.owner === player
				if(!showFullData) {
					// Show full data if any ship as arrive to this planet
					for(const ship of myArrivedShips) {
						if(ship.planetDestination === planet) {
							showFullData = true
							break
						}
					}
				}
				if(!showFullData) {
					for(const ship of myFlyingShips) {
						// If planet center is in range of ship, show full data
						if(ship.distanceTo(planet) <= SHIP_RADAR_RANGE) {
							showFullData = true
							break
						}
					}
				}
				instantData.planets[planet.name] = planet.getInstantData(showFullData)
			}
			for(const ship of this.ships) {
				// Only update ship if owner is player OR if ship is near player's territory
				let showFullShipData = hasLost || ship.owner === player
				let showShipData = showFullShipData
				if(!showShipData) {
					for(const planet of myPlanets) {
						if(planet.distanceTo(ship, true) <= PLANET_RADAR_RANGE) {
							showShipData = true
							break
						}
					}
				}
				if(!showShipData) {
					for(const ship2 of myFlyingShips) {
						if(ship.distanceTo(ship2, true) <= SHIP_RADAR_RANGE) {
							showFullShipData = showShipData = true
							break
						}
					}
				}
				if(showShipData) {
					instantData.ships[ship.id] = ship.getInstantData(showFullShipData)
				}
			}
			player.update(instantData)
		}

		/**
		 * @param {number} added By how much turn has increased since last call (can be float)
		 */
		update(newTurn, added) {
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
			this._owner = null
		}

		distanceTo(otherPlanet, isNotAPlanet=false) {
			return Math.hypot(this.x - otherPlanet.x, this.y - otherPlanet.y) - this.size - (isNotAPlanet ? 0 : otherPlanet.size)
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
				instantData.owner = this.owner?this.owner.instantData:null
			}

			return instantData
		}

		set owner(newOwner) {
			this._owner = newOwner
			console.log("Planet " + this.name + " now owned by " + newOwner.name)
		}
		get owner() {
			return this._owner
		}

		/**
		 * @param {number} added Number of turns to consider to increase self population
		 */
		increasePopulation(added) {
			this.population += this.owner ? added*5 : added
		}

	}


	// // // SPACE SHIP // // //
	let shipIds = {} // [origin][destination] = number
	class SpaceShip extends Point {

		/**
		 * @param {Planet} planetOrigin
		 * @param {Planet} planetDestination
		 * @param {number} turnOrigin
		 * @param {number} turnDestination
		 * @param {number} crewSize
		 */
		constructor(planetOrigin, planetDestination, turnOrigin, turnDestination, crewSize) {
			super(planetOrigin.x, planetOrigin.y)

			// Set ship id
			const idListOrigin = shipIds[planetOrigin.name] || []
			shipIds[planetOrigin.name] = idListOrigin
			const tripId = (shipIds[planetOrigin.name][planetDestination.name] || 0) + 1
			shipIds[planetOrigin.name][planetDestination.name] = tripId
			this.id = planetOrigin.name + "-" + planetDestination.name + "-" + tripId

			this.planetOrigin = planetOrigin
			this.planetDestination = planetDestination
			this.turnOrigin = turnOrigin
			this.turnDestination = turnDestination
			this.crewSize = crewSize

			this.owner = planetOrigin.owner

			// Precompute travel locations (from surface of origin to surface of destination)
			const angle1 = Math.atan2(this.planetDestination.y - this.planetOrigin.y, this.planetDestination.x - this.planetOrigin.x)
				+ (Math.random() > 0.5 ? 1 : -1) * (Math.random() * (Math.PI/4) + Math.PI/4)
			this.pointOrigin = new Point(this.planetOrigin.x + Math.cos(angle1) * this.planetOrigin.size, this.planetOrigin.y + Math.sin(angle1) * this.planetOrigin.size)

			const angle2 = Math.atan2(this.planetOrigin.y - this.planetDestination.y, this.planetOrigin.x - this.planetDestination.x)
				+ (Math.random() > 0.5 ? 1 : -1) * (Math.random() * (Math.PI/4) + Math.PI/4)
			this.pointDestination = new Point(this.planetDestination.x + Math.cos(angle2) * this.planetDestination.size, this.planetDestination.y + Math.sin(angle2) * this.planetDestination.size)

			// Set to starting location
			this.x = this.pointOrigin.x
			this.y = this.pointOrigin.y
			this.progress = 0
		}

		location(currentTurn) {
			const progress = (currentTurn - this.turnOrigin) / (this.turnDestination - this.turnOrigin)
			if(progress < 0) return this.pointOrigin
			if(progress > 1) return this.pointDestination

			const x = this.pointOrigin.x + (this.pointDestination.x - this.pointOrigin.x) * progress
			const y = this.pointOrigin.y + (this.pointDestination.y - this.pointOrigin.y) * progress
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
			}

			if(isFull) {
				instantData.planetOrigin = this.planetOrigin.name
				instantData.planetDestination = this.planetDestination.name
				instantData.turnOrigin = this.turnOrigin
				instantData.turnDestination = this.turnDestination
				instantData.crewSize = this.crewSize
				instantData.destination = new Point(this.pointDestination)
				instantData.owner = this.owner ? this.owner.instantData : null
			}

			return instantData
		}

	}

	// // // FUNCTIONS // // //

	const NAME_LETTERS = "ΓΔΘΛΞΠΣΦΨΩABCDEFGHIJKLMNOPQRSTUVWXYZ"
	function generatePlanetName(values) {
		let gen = NAME_LETTERS[(values.shift()*NAME_LETTERS.length-.5)|0].toUpperCase()
		for(const v of values) {
			gen += NAME_LETTERS[(v*NAME_LETTERS.length-.5)|0].toLowerCase()
		}

		return gen
	}


	return GameEngine
})()
