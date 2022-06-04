var Viewport = (function() {
	const ZOOM_SPEED = 16
	const MAP_MOVE_SENSITIVITY = 1

	class Viewport {
		constructor(divs, engine) {
			const THIS_VIEWPORT = this
			const ENGINE = engine
			this.viewLocation = { x: 0, y: 0, zoom: 0 }

			let turn = 0 // int, +1 per turn
			let ingameTime = 0 // +1 per turn; can use decimal for computing frames
			let animationTime = 0 // +1 per ms

			const HTML = divs.viewport
			const pixi = new PIXI.Application({ resizeTo: window, clearBeforeRender: true, antialias: true })
			HTML.append(pixi.view)
			this._div = HTML

			const graphics = new PIXI.Graphics()
			this.graphics = graphics
			pixi.stage.addChild(graphics)
			this.gameToViewportMatrix = new PIXI.Matrix()

			let mouseLocationGame = { x: 0, y: 0 }
			let dragnDrop = false

			// Zoom on mouse wheel scroll
			HTML.bind('mousewheel DOMMouseScroll', (e) => {
				const mouseLocationViewport = THIS_VIEWPORT.getViewportMouseLocation(e)
				THIS_VIEWPORT.updateZoom(mouseLocationViewport, THIS_VIEWPORT.viewLocation.zoom + (e.originalEvent.wheelDelta || -e.originalEvent.detail) / ZOOM_SPEED)
			}).bind('mousedown', (e) => {
				if(e.button === 2 && !dragnDrop) {
					// Right click
					HTML.css('cursor', 'move')
					dragnDrop = mouseLocationGame
				}
			}).bind('mouseup', (e) => {
				if(e.button === 0) {
					// Left click
					engine.onClick(mouseLocationGame, ingameTime)
				} else if(e.button == 2) {
					// Right click
					HTML.css('cursor', 'default')
					dragnDrop = false
					e.preventDefault()
				}
			}).bind('mousemove', (e) => {
				const mouseLocationViewport = THIS_VIEWPORT.getViewportMouseLocation(e)
				mouseLocationGame = this.gameToViewportMatrix.applyInverse(mouseLocationViewport)
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

			const onIngameTimeStop = function() {
				divs['btn-nextTurn'].prop('disabled', false)
			}

			const onTick = function() {
				const deltaS = pixi.ticker.deltaMS / 1000
				animationTime += deltaS
				if(ingameTime < turn) {
					ingameTime += deltaS * ENGINE.TURNS_PER_SECOND
					if(ingameTime > turn) {
						ingameTime = turn
						onIngameTimeStop()
					}
					divs['label-turn'].text(ingameTime.toFixed(2))
				}

				// Update game data
				ENGINE.update(ingameTime)

				// Redraw all (TODO later: instead of redrawing everything, add every sub elements as graphics.addChild(subElement), and let pixiJS to the job)
				graphics.clear()
				graphics.onePixel = 1 / graphics.scale.x
				graphics.mouseLocation = mouseLocationGame
				if(!ENGINE.render(graphics, animationTime)) {
					console.error('Engine render failed: Ticker Stopped.')
					pixi.ticker.stop()
				}
			}

			pixi.ticker.add(onTick)

			divs['btn-nextTurn'].click(() => {
				turn += 1
				divs['btn-nextTurn'].prop('disabled', true)
			})


			this.updateZoom = function(mouseLocationViewport, newZoom) {
				// Where is the mouse in the game before zoom
				const mouseLocationGameBefore = this.gameToViewportMatrix.applyInverse(mouseLocationViewport)

				// Compute zoom value
				THIS_VIEWPORT.viewLocation.zoom = newZoom

				// Fix limits depending on engine bounds
				const gameBounds = ENGINE.getBounds() // [{x,y}, {x,y}]
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

			this.updateView(true)
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
