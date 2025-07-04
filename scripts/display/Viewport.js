
/**
 *
 * @param {number} h Hue, 0 -> 360
 * @param {number} s Saturation, 0 (grey) -> 1 (colorful)
 * @param {number} l Lightness, 0 (black) -> 0.5 (colorful) -> 1 (white)
 * @returns {number} 0xRRGGBB RGB value of given hsl
 */
function hsl2rgb(h, s, l) {
	const a = s * Math.min(l, 1 - l)
	const f = (n)=>{
		const k = (n + h / 30) % 12
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
		return (255 * color)|0
	}

	return (f(0) << 16) | (f(8) << 8) | (f(4))
}

function formatTurnAsYear(turnNum) {
	// IRL current date + 33years 'Number of turns' months
	const curr = new Date(+new Date() +(33 + turnNum/12)*365*24*60*60*1000)
	return curr.toISOString().slice(0, 10)
}


var Viewport = (function() {
	const ZOOM_SPEED = 8
	const MAP_MOVE_SENSITIVITY = 1
	const TURNS_PER_SECOND = 1
	const BORDER_SIZE = 0.5 // Circle of selection around planets, in game units
	const PLANET_RADAR_RADIUS = 2
	const SHIP_RADAR_RADIUS = 1
	const PLANET_NAME_FONT_SIZE = 22
	const MAX_ZOOM = 16 // Increase this value to improve graphics accuracy; but also increases graphics computation time (lag)

	class RadarRenderer extends PIXI.Graphics {
		constructor(radarData) {
			super()
			this.randomShift = Math.random()
			this.radarData = radarData
			const scale = (radarData.scale||1)/MAX_ZOOM
			this.scale = new PIXI.Point(scale, scale)

			this.cullable = true
			this.cullArea = new PIXI.Rectangle(
				-this.radarData.maxRange * MAX_ZOOM,
				-this.radarData.maxRange * MAX_ZOOM,
				2*this.radarData.maxRange* MAX_ZOOM,
				2*this.radarData.maxRange* MAX_ZOOM
			)
		}

		async update(context, animationTime) {
			this.clear()

			const onePx = context.onePixel * MAX_ZOOM
			//const color = hsl2rgb(this.rendererPlayer.color, 1, .7)
			const baseProgress = (animationTime % this.radarData.frequency)/this.radarData.frequency + this.randomShift

			for(let i=this.radarData.waveCount; i>0; i--) {
				const progress = (baseProgress + i/this.radarData.waveCount) % 1

				// Growing circle
				this.lineStyle(onePx, this.radarData.color, 1-progress)
				this.drawCircle(0, 0, MAX_ZOOM * (this.radarData.minRange + (Math.pow(progress, 1/4) * (this.radarData.maxRange - this.radarData.minRange))))
			}
		}
	}
	class PlanetRenderer extends CullableRenderer {

		/**
		 * @param {*} planetData
		 * @param {PlayerHuman} rendererPlayer
		 */
		constructor(planetData, rendererPlayer) {
			super()

			this.data = planetData
			this.rendererPlayer = rendererPlayer

			// Prepare graphics
			this.x = planetData.x
			this.y = planetData.y
			this.scale = new PIXI.Point(1/MAX_ZOOM, 1/MAX_ZOOM)
			this.interactive = true
			this.buttonMode = true

			// Planet highlight (Dynamically drawn, see method 'update')
			this.highlight = new PIXI.Graphics()
			this.highlight.nlanetsData = {owner: false, selected: this.data.selected}

			// Planet
			this.planet = new PIXI.Graphics()
			this.planet.beginFill(hsl2rgb(planetData.color, .5, .4))
			this.planet.drawCircle(0, 0, planetData.size * MAX_ZOOM)
			this.planet.endFill()

			// Radar
			this.radar = new RadarRenderer({
				waveCount: 2,
				frequency: 8+Math.random()*.5,
				minRange: this.data.size,
				maxRange: this.data.size + PLANET_RADAR_RADIUS,
				scale: MAX_ZOOM,
				color: hsl2rgb(planetData.color, 1, .7)
			})
			this.radar.visible = false

			// Planet name
			this.nameBox = new PIXI.Graphics()
			this.nameText = new PIXI.Text(planetData.name, {
				fontFamily: 'Arial',
				fontSize: PLANET_NAME_FONT_SIZE * MAX_ZOOM,
				align: 'left',
				fill: '0xFFFFFF',
				color: hsl2rgb(rendererPlayer.color, 1, .7),
			})
			this.nameText.cacheAsBitmap = true
			this.nameBox.addChild(this.nameText)
			this.nameText.x = -this.nameText.width / 2
			this.nameText.y = -this.nameText.height / 2
			if(this.nameText.width > this.nameText.height) {
				this.nameBox.height = planetData.size * MAX_ZOOM
				this.nameBox.width = this.nameText.width * this.nameBox.height/this.nameText.height
			} else {
				this.nameBox.width = planetData.size * MAX_ZOOM
				this.nameBox.height = this.nameText.height * this.nameBox.width/this.nameText.width
			}

			// Planet Population
			this.populationBox = new PIXI.Graphics()
			this.populationBox.x = planetData.size*Math.SQRT1_2 * MAX_ZOOM
			this.populationBox.y = planetData.size*Math.SQRT1_2 * MAX_ZOOM
			this.populationBox.nlanetsData = {population: false}

			// Add layers
			this.addChild(this.radar) // Background
			this.addChild(this.highlight)
			this.addChild(this.planet)
			this.addChild(this.nameBox)
			this.addChild(this.populationBox) // Foreground

			// Listeners
			this.on('pointertap', this.onClick)

			// Improve performances (hide component when out of view)
			this.cullArea = this.radar.cullArea
		}

		async update(context, animationTime) {
			if(!this.displayed) return // Culling: Element is not visible

			// Planet highlight (owner)
			let ownerChanged = false
			if('owner' in this.data) {
				this.highlight.nlanetsData.updatedOwner = this.data.turn
				if((this.highlight.nlanetsData.owner && !this.data.owner)
					|| (!this.highlight.nlanetsData.owner && this.data.owner)
					|| (this.highlight.nlanetsData.owner && this.data.owner && this.highlight.nlanetsData.owner.name !== this.data.owner.name)) {
					ownerChanged = true
					this.highlight.nlanetsData.owner = this.data.owner
				}
			} else if(this.highlight.nlanetsData.owner && this.highlight.nlanetsData.owner.name === this.rendererPlayer.name) {
				// Viewport player lost a planet; we are sure this planet is no more his property
				ownerChanged = true
				this.highlight.nlanetsData.population = 0
				this.highlight.nlanetsData.owner = null
			}

			if(ownerChanged) {
				const owner = this.highlight.nlanetsData.owner
				const fillColor = (owner)
					? hsl2rgb(owner.color, 1, .5) // colorful
					: hsl2rgb(0, 0, .5) // white

				this.highlight.clear()
				this.highlight.beginFill(fillColor)
				this.highlight.drawCircle(0, 0, (this.data.size + BORDER_SIZE) * MAX_ZOOM)
				this.highlight.endFill()
			}
			const since = this.data.turn - this.data.updated
			this.highlight.alpha = this.data.selected ? .75 : (this.highlight.nlanetsData.owner ? 1 / Math.sqrt(since + 9) : 0)

			// Radar
			this.radar.visible = this.data.radar && this.data.radar.ships.length > 0
			if(this.radar.visible) {
				this.radar.radarData.waveCount = this.data.radar.ships.length + 1
				this.radar.update(context, animationTime)
			}

			// Planet Population
			if('population' in this.data) {
				if(this.populationBox.nlanetsData.lastPop !== this.data.population) {
					if(this.populationText) {
						this.populationText.destroy()
						this.populationBox.removeChildren()
					}

					this.populationText = new PIXI.Text(this.data.population, {
						fontFamily: 'Arial',
						fontSize: PLANET_NAME_FONT_SIZE * MAX_ZOOM,
						align: 'left',
						fill: '0xFFFFFF',
					})
					this.populationText.cacheAsBitmap = true
					this.populationBox.addChild(this.populationText)

					this.populationBox.nlanetsData.lastPop = this.data.population
				}

				this.populationBox.nlanetsData.updated = this.data.turn
			}
			if(this.populationText) {
				this.populationBox.height = PLANET_NAME_FONT_SIZE*context.onePixel * MAX_ZOOM
				this.populationBox.width = this.populationText.width * this.populationBox.height/this.populationText.height
				const since = this.data.turn - this.populationBox.nlanetsData.updated
				this.populationBox.alpha = 1 / (since + 1)
			}
		}

		/**
		 * @param {PIXI.FederatedPointerEvent} event
		 */
		async onClick(event) {
			this.rendererPlayer.onPlanetClick(this.data.name)
		}
	}
	class ShipRenderer extends PIXI.Graphics {
		/**
		 * @param {*} shipData
		 * @param {PlayerHuman} player
		 */
		constructor(shipData, player, displayCopy) {
			super()

			this.data = shipData
			this.player = player
			this.displayCopy = displayCopy

			this.subGraphics = new PIXI.Graphics()
			this.addChild(this.subGraphics)

			if(this.data.owner && this.player.name === this.data.owner.name) {
				this.radar = new RadarRenderer({
					waveCount: 1,
					frequency: 5 + Math.random()*.5,
					minRange: 0,
					maxRange: SHIP_RADAR_RADIUS,
					color: hsl2rgb(this.player.color, .5, .5)
				})
				this.radar.visible = false
				this.addChild(this.radar)
			}

			this.populationBox = new PIXI.Graphics()
			this.populationBox.alpha = 0.7
			this.addChild(this.populationBox) // Foreground
		}

		async update(context, animationTime) {
			this.subGraphics.clear()

			const crossSize = 6 * context.onePixel

			this.subGraphics.lineStyle(context.onePixel, this.data.owner ? hsl2rgb(this.data.owner.color, 1, .7) : 0xFFFFFF, .5)
			if(this.data.turnDestination && this.data.turnDestination > this.data.turn + 1) { // Destination & Speed are known
				// Draw ship as a line between 'fromLoc' and 'toLoc'
				const currShift = 1- (animationTime % (2*TURNS_PER_SECOND) / TURNS_PER_SECOND) // between -1 & 1

				// First segment
				if(currShift > 0) {
					this.subGraphics.moveTo(this.data.destination.x, this.data.destination.y)
					this.subGraphics.lineTo(this.data.destination.x - currShift*this.data.speed.x, this.data.destination.y - currShift*this.data.speed.y)
				}
				let lastTurnDrawn = this.data.turnDestination - currShift
				let lastX = this.data.destination.x - currShift * this.data.speed.x
				let lastY = this.data.destination.y - currShift * this.data.speed.y
				while(lastTurnDrawn >= this.data.turn + 2) {
					lastX -= this.data.speed.x
					lastY -= this.data.speed.y
					const nextX = lastX - this.data.speed.x
					const nextY = lastY - this.data.speed.y

					this.subGraphics.moveTo(lastX, lastY)
					this.subGraphics.lineTo(nextX, nextY)

					lastX = nextX
					lastY = nextY
					lastTurnDrawn -= 2
				}
			}

			// Draw speed arrow from ship location to estimated nextTurn ship location
			this.subGraphics.lineStyle(context.onePixel, this.data.owner ? hsl2rgb(this.data.owner.color, 1, .7) : 0xFFFFFF)
			const nextIsDestination = this.data.turnDestination && this.data.turnDestination - this.data.turn < 1
			const nextX = nextIsDestination ? this.data.destination.x : this.data.x + this.data.speed.x
			const nextY = nextIsDestination ? this.data.destination.y : this.data.y + this.data.speed.y

			this.subGraphics.moveTo(this.data.x, this.data.y)
			this.subGraphics.lineTo(nextX, nextY)

			// Draw arrow shape for ship speed arrow
			const angleDirection = Math.atan2(this.data.speed.y, this.data.speed.x)
			const angleFleche1 = angleDirection + 3*Math.PI/4
			const angleFleche2 = angleDirection - 3*Math.PI/4

			this.subGraphics.lineTo(
				nextX + Math.cos(angleFleche1) * crossSize,
				nextY + Math.sin(angleFleche1) * crossSize
			)
			this.subGraphics.moveTo(nextX, nextY)
			this.subGraphics.lineTo(
				nextX + Math.cos(angleFleche2) * crossSize,
				nextY + Math.sin(angleFleche2) * crossSize
			)

			// Draw a cross to mark the ship
			this.subGraphics.lineStyle(context.onePixel, this.data.owner ? hsl2rgb(this.data.owner.color, 1, .7) : 0xFFFFFF)
			this.subGraphics.moveTo(this.data.x -crossSize, this.data.y)
			this.subGraphics.lineTo(this.data.x +crossSize, this.data.y)
			this.subGraphics.moveTo(this.data.x, this.data.y -crossSize)
			this.subGraphics.lineTo(this.data.x, this.data.y +crossSize)

			// If ship crew is known, display it next to it (bottom left)
			if(this.populationText) {
				this.populationText.destroy()
				this.populationBox.removeChildren()
			}
			if(this.data.crewSize) {
				this.populationText = new PIXI.Text(this.data.crewSize, {
					fontFamily: 'Arial',
					fontSize: 24,
					align: 'left',
					fill: '0xFFFFFF',
				})
				this.populationBox.addChild(this.populationText)
				this.populationBox.height = context.onePixel * MAX_ZOOM
				this.populationBox.width = this.populationText.width * this.populationBox.height/this.populationText.height
				this.populationBox.x = this.data.x
				this.populationBox.y = this.data.y
			}

			// Radar
			if(this.radar) {
				this.radar.visible = this.data.radar && this.data.radar.ships.length > 0
				if(this.radar.visible) {
					this.radar.radarData.waveCount = this.data.radar.ships.length
					this.radar.x = this.data.x
					this.radar.y = this.data.y
					this.radar.update(context, animationTime)
				}
			}
		}
	}
	class Renderer extends PIXI.Graphics {
		/**
		 * @param {PlayerHuman} player
		 */
		constructor(player) {
			super()

			this.player = player
			this.bounds = [{x:0, y:0}, {x:this.player.game.width, y:this.player.game.height}]
			this.planetRenderers = {}
			this.shipRenderers = {}

			// Draw background
			this.beginFill(0x080810)
			this.drawRect(0, 0, this.player.game.width, this.player.game.height)
			this.endFill()

			// Listeners
			this.interactive = true
			this.interactiveChildren = true
			this.on('pointertap', this.onClick)
		}

		async update(context, animationTime) {
			// Add missing planets
			for (const planetName in this.player.planets) {
				if(!this.planetRenderers[planetName]) {
					const planetRenderer = new PlanetRenderer(this.player.planets[planetName], this.player)
					this.planetRenderers[planetName] = planetRenderer
					this.addChild(planetRenderer)
				}
			}

			// Update planets
			for(const planetName in this.planetRenderers) {
				this.planetRenderers[planetName].update(context, animationTime)
			}

			// Add missing ships
			for (const shipId in this.player.ships) {
				if(!this.shipRenderers[shipId]) {
					this.shipRenderers[shipId] = []
					for(let x=-1; x<=1; x++) for(let y=-1; y<=1; y++) {
						const shipRenderer = new ShipRenderer(this.player.ships[shipId], this.player, {x:x, y:y})
						this.shipRenderers[shipId].push(shipRenderer)
						this.addChild(shipRenderer)
					}
				}
			}

			// Update ships
			for(const shipId in this.shipRenderers) {
				const shipData = this.player.ships[shipId]
				if(shipData && !shipData.isArrived) {
					this.shipRenderers[shipId].forEach(r => r.update(context, animationTime))
				} else {
					this.shipRenderers[shipId].forEach(r => r.destroy())
					delete this.shipRenderers[shipId]
				}
			}

			return true
		}

		/**
		 * @param {PIXI.FederatedPointerEvent} event
		 */
		onClick(event) {
			// Stop event if clicked on children
			if(event.target !== this && event.target.onClick) {
				return
			}

			this.player.onClick(event)
		}

		shiftViewport(shiftX, shiftY) {
			// Move all planets and ship coordinates relative to viewport center (add game.width/height then modulo game.width/height)
			for(const planetRenderer of Object.values(this.planetRenderers)) {
				planetRenderer.x = (shiftX + planetRenderer.data.x + this.player.game.width) % this.player.game.width
				planetRenderer.y = (shiftY + planetRenderer.data.y + this.player.game.height) % this.player.game.height
			}
			for(const multipleShipRenderers of Object.values(this.shipRenderers)) {
				for(const shipRenderer of multipleShipRenderers) {
					shipRenderer.transform.position.x = (shiftX + this.player.game.width) % this.player.game.width + (shipRenderer.displayCopy.x * this.player.game.width)
					shipRenderer.transform.position.y = (shiftY + this.player.game.height) % this.player.game.height + (shipRenderer.displayCopy.y * this.player.game.height)
				}
			}
		}
	}

	class Viewport {
		#renderer

		/**
		 * @param {*} divs
		 * @param {PlayerHuman} player
		 */
		constructor(divs, player) {
			const THIS_VIEWPORT = this
			const PLAYER = player
			this.#renderer = new Renderer(player)

			this.viewLocation = { x: 0, y: 0, zoom: 0 }

			let turn = 0 // int, +1 per turn
			let animationTime = 0 // +1 per ms

			const HTML = divs.viewport
			const pixi = new PIXI.Application({ resizeTo: window, antialias: true, autoDensity: true })
			PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.LINEAR;
			HTML.append(pixi.view)
			this._div = HTML

			const graphics = new PIXI.Graphics()
			this.graphics = graphics
			pixi.stage.addChild(graphics)
			this.gameToViewportMatrix = new PIXI.Matrix()
			graphics.addChild(this.#renderer)

			let mouseLocationGame = new Point(0, 0)
			let dragnDrop = false

			// Zoom on mouse wheel scroll
			HTML.bind('mousewheel DOMMouseScroll', (e) => {
				const inOrOut = Math.sign(e.originalEvent.wheelDelta || -e.originalEvent.detail)
				this.updateZoom(this.viewLocation.zoom + inOrOut / ZOOM_SPEED)
			}).bind('mousedown', (e) => {
				if(e.button === 2 && !dragnDrop) {
					// Right click
					HTML.css('cursor', 'move')
					dragnDrop = mouseLocationGame
				}
			}).bind('mouseup', (e) => {
				if(e.button == 2) {
					// Right click
					HTML.css('cursor', 'default')
					dragnDrop = false
					e.preventDefault()
				}
			}).bind('mousemove', (e) => {
				mouseLocationGame = new Point(this.gameToViewportMatrix.applyInverse(THIS_VIEWPORT.getViewportMouseLocation(e)))
				if(dragnDrop) {
					if((e.buttons & 2) === 0) {
						// Not rightclicking anymore; can happen if user releases the mouse button outside the window
						HTML.css('cursor', 'default')
						dragnDrop = false
					} else {
						const dx = (mouseLocationGame.x - dragnDrop.x) * MAP_MOVE_SENSITIVITY
						const dy = (mouseLocationGame.y - dragnDrop.y) * MAP_MOVE_SENSITIVITY
						THIS_VIEWPORT.viewLocation.x += dx
						THIS_VIEWPORT.viewLocation.y += dy

						// Modulo viewLocation on game board size
						THIS_VIEWPORT.viewLocation.x = (THIS_VIEWPORT.viewLocation.x + PLAYER.game.width) % PLAYER.game.width
						THIS_VIEWPORT.viewLocation.y = (THIS_VIEWPORT.viewLocation.y + PLAYER.game.height) % PLAYER.game.height

						dragnDrop = mouseLocationGame
						THIS_VIEWPORT.updateView()
					}
				}
			}).bind('contextmenu', (e) => {
				e.preventDefault()
			})

			const renderer = this.#renderer
			const onTick = async function() {
				const deltaS = pixi.ticker.deltaMS / 1000
				animationTime += deltaS

				if(PLAYER.turn >= turn && divs['chk-autorun'].prop('checked')) {
					turn = PLAYER.turn + deltaS* TURNS_PER_SECOND
				}

				if(PLAYER.turn < turn) {
					// Accept to increase turn
					PLAYER.allowIncreaseTurnTo(Math.min(turn, PLAYER.turn + deltaS* TURNS_PER_SECOND))
				}
				divs['label-turn'].text(formatTurnAsYear(PLAYER.turn))

				// Redraw all (TODO later: instead of redrawing everything, add every sub elements as graphics.addChild(subElement), and let pixiJS to the job)
				graphics.clear()
				graphics.onePixel = 1 / graphics.scale.x
				graphics.mouseLocation = mouseLocationGame
				renderer.update(graphics, animationTime)
				THIS_VIEWPORT.updateView()
			}

			pixi.ticker.add(onTick)

			divs['btn-nextWeek'].click(() => turn += 1/4)
			divs['btn-nextMonth'].click(() => turn += 1)

			this.updateZoom = async function(newZoom) {
				// Where is the mouse in the game before zoom
				const mouseLocationGameBefore = mouseLocationGame
				const mouseLocationViewport = this.gameToViewportMatrix.apply(mouseLocationGame)

				// Compute zoom value
				THIS_VIEWPORT.viewLocation.zoom = newZoom

				// Fix limits depending on engine bounds
				const gameBounds = this.#renderer.bounds // [{x,y}, {x,y}]
				const viewportBounds = this.getViewportBoundsOnScreen() // [{x,y}, {x,y}]
				const ratioX = (viewportBounds[1].x - viewportBounds[0].x) / (gameBounds[1].x - gameBounds[0].x)
				const ratioY = (viewportBounds[1].y - viewportBounds[0].y) / (gameBounds[1].y - gameBounds[0].y)
				const minZoom = Math.log2(Math.min(ratioX, ratioY) * .9) // Tolerate 5% margin on every side
				if(this.viewLocation.zoom < minZoom) {
					this.viewLocation.zoom = minZoom
				}

				if(this.viewLocation.zoom > MAX_ZOOM/2) {
					this.viewLocation.zoom = MAX_ZOOM/2
				}

				// Apply zoom & viewport move, to the matrix only
				THIS_VIEWPORT.updateView(false)

				// Where is the mouse in the game after zoom
				const mouseLocationGameAfter = this.gameToViewportMatrix.applyInverse(mouseLocationViewport)

				// Move the viewport so the mouse stays in the same place
				THIS_VIEWPORT.viewLocation.x += mouseLocationGameAfter.x - mouseLocationGameBefore.x
				THIS_VIEWPORT.viewLocation.y += mouseLocationGameAfter.y - mouseLocationGameBefore.y

				// Apply to the matrix
				THIS_VIEWPORT.updateView(true)
			}

			// Default zoom out maximum
			this.updateZoom(-99)
		}
		async updateView(applyUpdate = true) {

			// Initiate the matrix
			this.gameToViewportMatrix.identity()

			// Apply zoom
			const zoomFactor = 2 ** this.viewLocation.zoom
			this.gameToViewportMatrix.scale(zoomFactor, zoomFactor)

			this.#renderer.shiftViewport(this.viewLocation.x, this.viewLocation.y)

			if(applyUpdate) {
				this.graphics.transform.setFromMatrix(this.gameToViewportMatrix)
			}
		}

		getViewportBoundsOnScreen() {
			return [{ x: this._div.offset().left, y: this._div.offset().top }, { x: this._div.offset().left + this._div.width(), y: this._div.offset().top + this._div.height() }]
		}
		getViewportMouseLocation(event) {
			return { x: event.pageX - this._div.offset().left, y: event.pageY - this._div.offset().top }
		}
	}


	return Viewport
})()
