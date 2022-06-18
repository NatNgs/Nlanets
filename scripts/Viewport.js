
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


var Viewport = (function() {
	const ZOOM_SPEED = 16
	const MAP_MOVE_SENSITIVITY = 1
	const TURNS_PER_SECOND = 1
	const BORDER_SIZE = .5 // Circle of selection around planets, in game units


	const PLANET_NAME_FONT_SIZE = 22


	const QUALITY_UPGRADE = 16
	class PlanetRenderer extends PIXI.Graphics {

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
			this.scale = new PIXI.Point(1/QUALITY_UPGRADE, 1/QUALITY_UPGRADE)
			this.interactive = true
			this.buttonMode = true

			// Planet highlight (Dynamically drawn, see method 'update')
			this.highlight = new PIXI.Graphics()
			this.highlight.nlanetsData = {owner: false, selected: false}

			// Planet
			this.planet = new PIXI.Graphics()
			this.planet.beginFill(hsl2rgb(planetData.color, .5, .4))
			this.planet.drawCircle(0, 0, planetData.size * QUALITY_UPGRADE)
			this.planet.endFill()

			// Planet name
			this.nameBox = new PIXI.Graphics()
			this.nameText = new PIXI.Text(planetData.name, {
				fontFamily: 'Arial',
				fontSize: PLANET_NAME_FONT_SIZE * QUALITY_UPGRADE,
				align: 'left',
				fill: '0xFFFFFF',
			})
			this.nameBox.addChild(this.nameText)
			this.nameText.x = -this.nameText.width / 2
			this.nameText.y = -this.nameText.height / 2
			if(this.nameText.width > this.nameText.height) {
				this.nameBox.height = planetData.size * QUALITY_UPGRADE
				this.nameBox.width = this.nameText.width * this.nameBox.height/this.nameText.height
			} else {
				this.nameBox.width = planetData.size * QUALITY_UPGRADE
				this.nameBox.height = this.nameText.height * this.nameBox.width/this.nameText.width
			}

			// Planet Population
			this.populationBox = new PIXI.Graphics()
			this.populationBox.x = planetData.size*Math.SQRT1_2 * QUALITY_UPGRADE
			this.populationBox.y = planetData.size*Math.SQRT1_2 * QUALITY_UPGRADE
			this.populationBox.nlanetsData = {population: false}

			// Add layers
			this.addChild(this.highlight) // Background
			this.addChild(this.planet)
			this.addChild(this.nameBox)
			this.addChild(this.populationBox)

			// Listeners
			this.on('pointertap', this.onClick)
		}

		update(context, turn, animationTime) {
			const timeSinceLastUpdate = turn - this.data.turn

			// Update planet highlight
			if( (!this.data.owner && this.highlight.nlanetsData.owner)
				|| this.data.owner && (
					this.highlight.nlanetsData.owner !== this.data.owner.name
					|| this.highlight.nlanetsData.selected !== this.data.selected)) {

				const fillColor = (this.data.owner)
					? hsl2rgb(this.data.owner.color, 1, .5) // colorful
					: hsl2rgb(0, 0, .5) // white

				this.highlight.clear()
				this.highlight.beginFill(fillColor, this.data.selected ? 1 : (this.data.owner ? .25 : 0))
				this.highlight.drawCircle(0, 0, (this.data.size + BORDER_SIZE) * QUALITY_UPGRADE)
				this.highlight.endFill()

				this.highlight.nlanetsData.owner = this.data.owner ? this.data.owner.name : null
				this.highlight.nlanetsData.selected = this.data.selected
			}

			// Planet Population
			const currentPopulation = this.data.population !== undefined ? (this.data.population|0) : '?'
			if(this.populationBox.nlanetsData.lastPop !== currentPopulation) {
				if(this.populationText) {
					this.populationText.destroy()
					this.populationBox.removeChildren()
				}

				this.populationText = new PIXI.Text(currentPopulation, {
					fontFamily: 'Arial',
					fontSize: PLANET_NAME_FONT_SIZE * QUALITY_UPGRADE,
					align: 'left',
					fill: '0xFFFFFF',
				})
				this.populationBox.addChild(this.populationText)

				this.populationBox.nlanetsData.lastPop = currentPopulation
			}
			this.populationBox.height = PLANET_NAME_FONT_SIZE*context.onePixel * QUALITY_UPGRADE
			this.populationBox.width = this.populationText.width * this.populationBox.height/this.populationText.height
			this.populationBox.alpha = 1 / (timeSinceLastUpdate + 1)
		}

		/**
		 * @param {PIXI.FederatedPointerEvent} event
		 */
		onClick(event) {
			this.rendererPlayer.onPlanetClick(this.data.name)
		}
	}
	class ShipRenderer extends PIXI.Graphics {
		/**
		 * @param {*} shipData
		 * @param {PlayerHuman} player
		 */
		constructor(shipData, player) {
			super()

			this.data = shipData
			this.player = player
		}

		update(context, turn, animationTime) {
			this.clear()

			this.lineStyle(context.onePixel, this.data.owner ? hsl2rgb(this.data.owner.color, 1, .7) : 0xFFFFFF)

			let crossSize = 1
			if(this.data.owner && this.player.name === this.data.owner.name) {
				// Draw ship as a line between 'fromLoc' and 'toLoc'
				this.moveTo(this.data.x, this.data.y)
				this.lineTo(this.data.destination.x, this.data.destination.y)
				crossSize = 6 * context.onePixel
			} else {
				// Draw circle where the ship can go
				this.drawCircle(this.data.x, this.data.y, 1)
			}

			// Draw a cross to mark the ship
			this.moveTo(this.data.x -crossSize, this.data.y)
			this.lineTo(this.data.x +crossSize, this.data.y)
			this.moveTo(this.data.x, this.data.y -crossSize)
			this.lineTo(this.data.x, this.data.y +crossSize)
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

		update(context, animationTime) {
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
				this.planetRenderers[planetName].update(context, this.player.turn, animationTime)
			}

			// Add missing ships
			for (const shipId in this.player.ships) {
				if(!this.shipRenderers[shipId]) {
					const shipRenderer = new ShipRenderer(this.player.ships[shipId], this.player)
					this.shipRenderers[shipId] = shipRenderer
					this.addChild(shipRenderer)
				}
			}

			// Update ships
			for(const shipId in this.shipRenderers) {
				const shipData = this.player.ships[shipId]
				if(shipData && !shipData.isArrived) {
					this.shipRenderers[shipId].update(context, this.player.turn, animationTime)
				} else {
					this.shipRenderers[shipId].destroy()
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
	}




	class Viewport {
		/**
		 * @param {*} divs
		 * @param {PlayerHuman} player
		 */
		constructor(divs, player) {
			const THIS_VIEWPORT = this
			const PLAYER = player
			const RENDERER = new Renderer(player)

			this.viewLocation = { x: 0, y: 0, zoom: 0 }

			let turn = 0 // int, +1 per turn
			let animationTime = 0 // +1 per ms

			const HTML = divs.viewport
			const pixi = new PIXI.Application({ resizeTo: window, antialias: true, autoDensity: true })
			HTML.append(pixi.view)
			this._div = HTML

			const graphics = new PIXI.Graphics()
			this.graphics = graphics
			pixi.stage.addChild(graphics)
			this.gameToViewportMatrix = new PIXI.Matrix()
			graphics.addChild(RENDERER)

			let mouseLocationGame = new Point(0, 0)
			let dragnDrop = false

			// Zoom on mouse wheel scroll
			HTML.bind('mousewheel DOMMouseScroll', (e) => {
				this.updateZoom(this.viewLocation.zoom + (e.originalEvent.wheelDelta || -e.originalEvent.detail) / ZOOM_SPEED)
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
						THIS_VIEWPORT.viewLocation.x -= dx
						THIS_VIEWPORT.viewLocation.y -= dy
						dragnDrop = { x: mouseLocationGame.x + dx, y: mouseLocationGame.y + dy }
						THIS_VIEWPORT.updateView()
					}
				}
			}).bind('contextmenu', (e) => {
				e.preventDefault()
			})

			const onTick = function() {
				const deltaS = pixi.ticker.deltaMS / 1000
				animationTime += deltaS

				if(PLAYER.turn < turn) {
					// Accept to increase turn
					PLAYER.allowIncreaseTurnTo(Math.min(turn, PLAYER.turn + deltaS* TURNS_PER_SECOND))
				}
				divs['label-turn'].text(PLAYER.turn.toFixed(2))

				// Redraw all (TODO later: instead of redrawing everything, add every sub elements as graphics.addChild(subElement), and let pixiJS to the job)
				graphics.clear()
				graphics.onePixel = 1 / graphics.scale.x
				graphics.mouseLocation = mouseLocationGame
				RENDERER.update(graphics, animationTime)
			}

			pixi.ticker.add(onTick)

			const unlockBtnNextTurn = function() {
				divs['btn-nextTurn'].prop('disabled', false)
			}
			divs['btn-nextTurn'].click(() => {
				turn += 1
				divs['btn-nextTurn'].prop('disabled', true)
				setTimeout(unlockBtnNextTurn, 1000)
			})


			this.updateZoom = function(newZoom) {
				// Where is the mouse in the game before zoom
				const mouseLocationGameBefore = mouseLocationGame
				const mouseLocationViewport = this.gameToViewportMatrix.apply(mouseLocationGame)

				// Compute zoom value
				THIS_VIEWPORT.viewLocation.zoom = newZoom

				// Fix limits depending on engine bounds
				const gameBounds = RENDERER.bounds // [{x,y}, {x,y}]
				const viewportBounds = this.getViewportBoundsOnScreen() // [{x,y}, {x,y}]
				const ratioX = (viewportBounds[1].x - viewportBounds[0].x) / (gameBounds[1].x - gameBounds[0].x)
				const ratioY = (viewportBounds[1].y - viewportBounds[0].y) / (gameBounds[1].y - gameBounds[0].y)
				const minZoom = Math.log2(Math.min(ratioX, ratioY) * .9) // Tolerate 5% margin on every side
				if(this.viewLocation.zoom < minZoom) {
					this.viewLocation.zoom = minZoom
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

			this.updateZoom(-99)
		}
		updateView(applyUpdate = true) {
			// Initiate the matrix
			this.gameToViewportMatrix.identity()

			// Apply zoom
			const zoomFactor = 2 ** this.viewLocation.zoom
			this.gameToViewportMatrix.scale(zoomFactor, zoomFactor)
			this.gameToViewportMatrix.translate(this.viewLocation.x * zoomFactor, this.viewLocation.y * zoomFactor)

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
