const SCALING = 2**10

var Engine = (function () {
	const REPARTITION_REPEAT = 1
	const MIN_DISTANCE_BETWEEN_PLANETS = 1.5 * SCALING

	class Engine {
		constructor() {
			this.planets = []
			this.ships = []
			this.width = 0
			this.height = 0
		}
		set(width, height, planets, seed) {
			this.width = width * SCALING
			this.height = height * SCALING
			this.planets = []

			const rng = RND.newGenerator(seed)

			// Generate random planets
			let retries = 999
			while (this.planets.length < planets && retries > 0) {
				const newP = new Planet(rng, this.width, this.height)

				// Check if planet is not intersecting any other planet
				let intersect = false
				for (const planet of this.planets) {
					if (newP.distanceTo(planet) < MIN_DISTANCE_BETWEEN_PLANETS) {
						intersect = true
						break
					}
				}
				if (!intersect) {
					this.planets.push(newP)
				} else {
					retries--
				}
			}
		}
		onClick(xy, turn) {
			// Find the planet at this location
			const previouslySelectedPlanet = this.selectedPlanet
			if (previouslySelectedPlanet) {
				previouslySelectedPlanet.selected = false
				this.selectedPlanet = null
			}

			for (const planet of this.planets) {
				if (planet.containsLocation(xy)) {
					if (previouslySelectedPlanet !== planet) {
						if (previouslySelectedPlanet && previouslySelectedPlanet.population > 0) {
							// Send a ship from previously selected planet to this planet
							const population = (Math.random() * (previouslySelectedPlanet.population - 1) + 1) | 0
							previouslySelectedPlanet.addPopulation(-population)
							this.ships.push(new Ship(previouslySelectedPlanet, planet, turn, population))
						} else {
							this.selectedPlanet = planet
							planet.selected = true
						}
					}
				}
			}
		}
		update(turn) {
			for (const ship of this.ships) {
				ship.update(turn)
				if (ship.isArrived(turn)) {
					this.ships.splice(this.ships.indexOf(ship), 1)
					ship.toPlanet.addPopulation(ship.population)
				}
			}
		}
		render(graphics, animationTime) {
			graphics.beginFill(0x080810)
			graphics.drawRect(0, 0, this.width, this.height)
			graphics.endFill()

			for (const planet of this.planets) {
				planet.render(graphics, animationTime)
			}
			for (const ship of this.ships) {
				ship.render(graphics, animationTime)
			}
			return true
		}
		getBounds() {
			return [{ x: 0, y: 0 }, { x: this.width, y: this.height }]
		}
	}

	Engine.prototype.TURNS_PER_SECOND = 1

	return Engine
})()


function rgb2hsv(rgb) {
	// Rgb = 0xRRGGBB
	const r = (rgb >> 16)/0xFF, g = ((rgb >> 8) & 0xFF)/0xFF, b = (rgb & 0xFF)/0xFF

	const v=Math.max(r,g,b)
	const c=v-Math.min(r,g,b)
	let h= c && ((v==r) ? (g-b)/c : ((v==g) ? 2+(b-r)/c : 4+(r-g)/c))
	h = (h<0?h+6:h)/6
	const s = v&&c/v

	const hsv = ((h*0xFF)|0) << 16 | ((s*0xFF)|0) << 8 | (v*0xFF)|0

	// return 0xHHSSVV
	return hsv
}

var Planet = (function () {
	const BORDER_SIZE = .25 * SCALING
	const NAME_LETTERS = "ΓΔΘΛΞΠΣΦΨΩABCDEFGHIJKLMNOPQRSTUVWXYZ"

	function generatePlanetName(values) {
		let gen = ''

		gen += NAME_LETTERS[(values.shift()*NAME_LETTERS.length) |0].toUpperCase()
		for(const v of values) {
			gen += NAME_LETTERS[(v*NAME_LETTERS.length) |0].toLowerCase()
		}

		return gen
	}


	class Planet {
		constructor(rng, width, height) {
			this.x = rng.float(SCALING, width - SCALING)
			this.y = rng.float(SCALING, height - SCALING)
			this.size = rng.float(0.2, 0.8) * SCALING
			this.color = rng.int(0, 0xFFFFFF)
			this.population = rng.int(10, 99)
			this.selected = false
			this.name = generatePlanetName([
				1-(this.size-.2*SCALING)/(.8*SCALING-.2*SCALING),
				(rgb2hsv(this.color) >> 16) / 0xFF,
			])

			this.graphicElements = {}
		}
		containsLocation(xy) {
			const distance = Math.sqrt(Math.pow(this.x - xy.x, 2) + Math.pow(this.y - xy.y, 2))
			return distance < this.size
		}
		distanceTo(planet) {
			const distance = Math.sqrt(Math.pow(this.x - planet.x, 2) + Math.pow(this.y - planet.y, 2))
			return distance - this.size - planet.size
		}
		addPopulation(amount) {
			this.population += amount
			const text = this.graphicElements.popText
			if(text) {
				text.text = this.population
			}
		}
		render(graphics, time) {
			graphics.beginFill(0x808080, this.selected ? 1 : .25)
			graphics.drawCircle(this.x, this.y, this.size + BORDER_SIZE)
			graphics.endFill()

			graphics.beginFill(this.color)
			graphics.drawCircle(this.x, this.y, this.size)
			graphics.endFill()

			const FONT_SIZE = 22

			// Planet Name
			if(this.graphicElements.nameBox == null) {
				const box = new PIXI.Graphics()
				box.x = this.x
				box.y = this.y

				const text = new PIXI.Text(this.name, {
					fontFamily: 'Arial',
					fontSize: FONT_SIZE,
					align: 'left',
					fill: '0xFFFFFF',
				})
				text.x = -text.width / 2
				text.y = -text.height / 2

				box.addChild(text)
				graphics.addChild(box)
				this.graphicElements.nameBox = box
				this.graphicElements.nameText = text

				if(text.width > text.height) {
					box.height = this.size
					box.width = text.width * box.height/text.height
				} else {
					box.width = this.size
					box.height = text.height * box.width/text.width
				}
			}

			// Planet Population
			if(this.graphicElements.textBox == null) {
				const box = new PIXI.Graphics()
				box.x = this.x + this.size*Math.SQRT1_2
				box.y = this.y + this.size*Math.SQRT1_2

				const text = new PIXI.Text(this.population, {
					fontFamily: 'Arial',
					fontSize: FONT_SIZE,
					align: 'left',
					fill: '0xFFFFFF',
				})
				text.x = 0
				text.y = 0

				box.addChild(text)
				graphics.addChild(box)
				this.graphicElements.textBox = box
				this.graphicElements.popText = text
			}
			this.graphicElements.textBox.height = FONT_SIZE*graphics.onePixel
			this.graphicElements.textBox.width = this.graphicElements.popText.width * this.graphicElements.textBox.height/this.graphicElements.popText.height
		}
	}

	return Planet
})()

var Ship = (function () {
	function Ship(from, to, departureTime, population) {
		this.fromPlanet = from
		this.toPlanet = to
		this.departureTime = departureTime
		this.population = population

		// Update from to be on the surface of the from planet
		const angle = Math.atan2(this.toPlanet.y - this.fromPlanet.y, this.toPlanet.x - this.fromPlanet.x)
		this.fromLoc = {x: this.fromPlanet.x + Math.cos(angle) * this.fromPlanet.size, y: this.fromPlanet.y + Math.sin(angle) * this.fromPlanet.size}

		// Update to to be on the surface of the to planet
		const angle2 = Math.atan2(this.fromPlanet.y - this.toPlanet.y, this.fromPlanet.x - this.toPlanet.x)
		this.toLoc = {x: this.toPlanet.x + Math.cos(angle2) * this.toPlanet.size, y: this.toPlanet.y + Math.sin(angle2) * this.toPlanet.size}

		// compute arrival time: departure time + distance (speed is 1 distance per turn)
		this.arrivalTime = departureTime + (distancePointToPoint(this.fromLoc, this.toLoc)) / SCALING

		// Set ship initial location
		this.x = this.fromLoc.x
		this.y = this.fromLoc.y
		this.distance = 0
	}

	/**
	 * @param {number} turn Current turn of the game, remember that it can contains decimals
	 * @returns {boolean} true if ship is in transit, false if not yet departed or arrived
	 */
	Ship.prototype.update = function(turn) {
		const progress = (turn - this.departureTime) / (this.arrivalTime - this.departureTime)
		this.x = this.fromLoc.x + (this.toLoc.x - this.fromLoc.x) * progress
		this.y = this.fromLoc.y + (this.toLoc.y - this.fromLoc.y) * progress
	}

	Ship.prototype.render = function(graphics, animationTime) {
		if(this.isArrived()) return false
		const distance = distancePointToPoint(this.fromLoc, this)

		// Draw ship as a circle around 'fromPlanet', with size equals to distance travelled
		graphics.lineStyle(graphics.onePixel, 0xFFFFFF);
		graphics.drawCircle(this.fromPlanet.x, this.fromPlanet.y, this.fromPlanet.size + distance)

		// Draw ship as a line between 'fromLoc' and 'toLoc'
		graphics.moveTo(this.x, this.y)
		graphics.lineTo(this.toLoc.x, this.toLoc.y)
	}

	Ship.prototype.isArrived = function(turn) {
		return turn >= this.arrivalTime
	}

	return Ship
})()
