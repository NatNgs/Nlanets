var Engine = (function () {
	const REPARTITION_REPEAT = 1

	function Engine() {
		this.planets = []
		this.ships = []
		this.width = 0
		this.height = 0
	}

	const MIN_DISTANCE_BETWEEN_PLANETS = 1.5
	Engine.prototype.set = function(width, height, planets, seed) {
		this.width = width
		this.height = height
		this.planets = []

		const rng = RND.newGenerator(seed)

		// Generate random planets
		let retries = 999
		while(this.planets.length < planets && retries > 0) {
			const newP = new Planet(rng, width, height)

			// Check if planet is not intersecting any other planet
			let intersect = false
			for(const planet of this.planets) {
				if (newP.distanceTo(planet) < MIN_DISTANCE_BETWEEN_PLANETS) {
					intersect = true
					break
				}
			}
			if(!intersect) {
				this.planets.push(newP)
			} else {
				retries --
			}
		}
	}

	Engine.prototype.onClick = function(xy, turn) {
		// Find the planet at this location
		const previouslySelectedPlanet = this.selectedPlanet
		if(previouslySelectedPlanet) {
			previouslySelectedPlanet.selected = false
			this.selectedPlanet = null
		}

		for (const planet of this.planets) {
			if(planet.containsLocation(xy)) {
				if(previouslySelectedPlanet !== planet) {
					if(previouslySelectedPlanet) {
						// Send a ship from previously selected planet to this planet
						this.ships.push(new Ship(previouslySelectedPlanet, planet, turn))
					} else {
						this.selectedPlanet = planet
						planet.selected = true
					}
				}
			}
		}
	}

	Engine.prototype.update = function(turn) {
		for(const ship of this.ships) {
			ship.update(turn)
			if(ship.isArrived(turn)) {
				this.ships.splice(this.ships.indexOf(ship), 1)
			}
		}
	}

	Engine.prototype.render = function(graphics, animationTime, renderBounds) {
		for(const planet of this.planets) {
			planet.render(graphics, renderBounds, animationTime)
		}
		for(const ship of this.ships) {
			ship.render(graphics, renderBounds, animationTime)
		}
		return true
	}

	Engine.prototype.TURNS_PER_SECOND = 1

	Engine.prototype.getBounds = function() {
		return [{x:0, y:0}, {x:this.width, y:this.height}]
	}

	return Engine
})()

var Planet = (function () {


	function Planet(rng, width, height) {
		this.x = rng.float(-width/2, width/2)
		this.y = rng.float(-height/2, height/2)
		this.size = rng.float(0.2, 0.8)
		this.color = rng.int(0, 0xFFFFFF)
		this.selected = false
	}

	Planet.prototype.containsLocation = function(xy) {
		const distance = Math.sqrt(Math.pow(this.x - xy.x, 2) + Math.pow(this.y - xy.y, 2))
		return distance < this.size
	}
	Planet.prototype.distanceTo = function(planet) {
		const distance = Math.sqrt(Math.pow(this.x - planet.x, 2) + Math.pow(this.y - planet.y, 2))
		return distance - this.size - planet.size
	}

	const BORDER_SIZE = .25
	Planet.prototype.render = function(graphics, bounds, time) {
		graphics.beginFill(0x808080, this.selected ? 1 : .25)
		graphics.drawCircle(graphics.locX(this.x), graphics.locY(this.y), (this.size + BORDER_SIZE) * graphics.context.cS)
		graphics.endFill()

		graphics.beginFill(this.color)
		graphics.drawCircle(graphics.locX(this.x), graphics.locY(this.y), this.size * graphics.context.cS)
		graphics.endFill()
	}

	return Planet
})()

var Ship = (function () {

	function Ship(from, to, departureTime) {
		this.fromPlanet = from
		this.toPlanet = to
		this.departureTime = departureTime

		// Update from to be on the surface of the from planet
		const angle = Math.atan2(this.toPlanet.y - this.fromPlanet.y, this.toPlanet.x - this.fromPlanet.x)
		this.fromLoc = {x: this.fromPlanet.x + Math.cos(angle) * this.fromPlanet.size, y: this.fromPlanet.y + Math.sin(angle) * this.fromPlanet.size}

		// Update to to be on the surface of the to planet
		const angle2 = Math.atan2(this.fromPlanet.y - this.toPlanet.y, this.fromPlanet.x - this.toPlanet.x)
		this.toLoc = {x: this.toPlanet.x + Math.cos(angle2) * this.toPlanet.size, y: this.toPlanet.y + Math.sin(angle2) * this.toPlanet.size}

		// compute arrival time: departure time + distance (speed is 1 distance per turn)
		this.arrivalTime = departureTime + (distancePointToPoint(this.fromLoc, this.toLoc))

		// Set ship initial location
		this.x = this.fromLoc.x
		this.y = this.fromLoc.y
		this.distance = 0

		console.log(this)
	}

	/**
	 *
	 * @param {number} turn Current turn of the game, remember that it can contains decimals
	 * @returns {boolean} true if ship is in transit, false if not yet departed or arrived
	 */
	Ship.prototype.update = function(turn) {
		const progress = (turn - this.departureTime) / (this.arrivalTime - this.departureTime)
		this.x = this.fromLoc.x + (this.toLoc.x - this.fromLoc.x) * progress
		this.y = this.fromLoc.y + (this.toLoc.y - this.fromLoc.y) * progress
	}

	Ship.prototype.render = function(graphics, bounds, animationTime) {
		if(this.isArrived()) return false

		const distance = distancePointToPoint(this.fromLoc, this)

		// Draw ship as a circle around 'fromPlanet', with size equals to distance travelled
		graphics.lineStyle(1, 0xFFFFFF, 1);
		graphics.drawCircle(graphics.locX(this.fromPlanet.x), graphics.locY(this.fromPlanet.y), (this.fromPlanet.size + distance) * graphics.context.cS)

		// Draw ship as a line between 'fromLoc' and 'toLoc'
		graphics.moveTo(graphics.locX(this.x), graphics.locY(this.y));
		graphics.lineTo(graphics.locX(this.toLoc.x), graphics.locY(this.toLoc.y));
	}

	Ship.prototype.isArrived = function(turn) {
		return turn >= this.arrivalTime
	}

	return Ship
})()
