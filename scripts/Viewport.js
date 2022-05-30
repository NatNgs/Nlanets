var Viewport = (function() {
	const ZOOM_SPEED = 16
	const ZOOM_MIN = -2
	const ZOOM_MAX = 2
	const DEFAULT_ZOOM_CELL_SIZE = 64

	return function(divs, engine) {
		const THIS_VIEWPORT = this
		const ENGINE = engine
		this.viewLocation = {x:.5, y:.5, zoom: 1}

		let turn = 0 // int, +1 per turn
		let ingameTime = 0 // +1 per turn; can use decimal for computing frames
		let animationTime = 0 // +1 per ms

		const HTML = divs.viewport
		const pixi = new PIXI.Application({ resizeTo: window, clearBeforeRender: true, antialias: true })
		HTML.append(pixi.view)
		const graphics = new PIXI.Graphics();
		pixi.stage.addChild(graphics)

		let dragnDrop = false
		let mouseLocation = {x:0, y:0}
		let dragnDropLocation = null

		// Zoom on mouse wheel scroll
		HTML.bind('mousewheel DOMMouseScroll', (e)=>{
			let relX = e.pageX - HTML.offset().left;
			let relY = e.pageY - HTML.offset().top;
			const relZ = (e.originalEvent.wheelDelta || -e.originalEvent.detail) / ZOOM_SPEED

			let graphContext = getGraphContext()

			// Virtualy move the viewport from the mouse position to the center of the viewport
			THIS_VIEWPORT.viewLocation.x += (relX - (graphContext.vW / 2)) / graphContext.cS
			THIS_VIEWPORT.viewLocation.y += (relY - (graphContext.vH / 2)) / graphContext.cS

			// Apply zoom (before checks)
			THIS_VIEWPORT.viewLocation.zoom += relZ

			// Limit Zoom (min zoom = 0, max zoom = 5x5 cells to fit in screen)
			if(THIS_VIEWPORT.viewLocation.zoom < ZOOM_MIN) THIS_VIEWPORT.viewLocation.zoom = ZOOM_MIN
			else if(THIS_VIEWPORT.viewLocation.zoom > ZOOM_MAX) THIS_VIEWPORT.viewLocation.zoom = ZOOM_MAX

			// Apply zoom
			graphContext.cS = getCellSize()

			// Move back the viewport to the mouse position
			THIS_VIEWPORT.viewLocation.x -= (relX - (graphContext.vW / 2)) / graphContext.cS
			THIS_VIEWPORT.viewLocation.y -= (relY - (graphContext.vH / 2)) / graphContext.cS
		}).bind('mousedown', (e)=>{
			if(e.button === 2) {
				// Right click
				dragnDropLocation = {x: e.pageX, y: e.pageY}
				HTML.css('cursor', 'move')
				dragnDrop = true
			}
		}).bind('mouseup', (e)=>{
			if(e.button === 0) {
				// Left click
				engine.onClick(mouseLocation, ingameTime)
			} else if(e.button == 2) {
				// Right click
				HTML.css('cursor', 'default')
				dragnDrop = false
				e.preventDefault()
			}
		}).bind('mousemove', (e)=>{
			const graphContext = getGraphContext()
			mouseLocation = viewportToGameLocation({x: e.pageX - HTML.offset().left, y: e.pageY - HTML.offset().top}, graphContext)
			if (dragnDrop) {
				THIS_VIEWPORT.viewLocation.x -= (e.pageX - dragnDropLocation.x) / graphContext.cS
				THIS_VIEWPORT.viewLocation.y -= (e.pageY - dragnDropLocation.y) / graphContext.cS
				dragnDropLocation = {x: e.pageX, y: e.pageY}
			}
		}).bind('contextmenu', (e)=>{
			e.preventDefault()
		})

		const getCellSize = function() {
			return DEFAULT_ZOOM_CELL_SIZE*(2**THIS_VIEWPORT.viewLocation.zoom)
		}
		const getGraphContext = function() {
			return {
				vW: HTML.width(),
				vH: HTML.height(),
				cS: getCellSize(),
				mouseLocation: mouseLocation,
			}
		}

		const gameToViewportLocation = function(gameXY, graphContext) {
			return {
				x: graphContext.vW/2 + (gameXY.x - THIS_VIEWPORT.viewLocation.x)*graphContext.cS,
				y: graphContext.vH/2 + (gameXY.y - THIS_VIEWPORT.viewLocation.y)*graphContext.cS,
			}
		}
		const viewportToGameLocation = function(viewportXY, graphContext) {
			return {
				x: (viewportXY.x - graphContext.vW/2)/graphContext.cS + THIS_VIEWPORT.viewLocation.x,
				y: (viewportXY.y - graphContext.vH/2)/graphContext.cS + THIS_VIEWPORT.viewLocation.y,
			}
		}

		const onIngameTimeStop = function() {
			divs['btn-nextTurn'].prop('disabled', false)
		}
		pixi.ticker.add(()=>{
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

			// Update graphics
			const graphContext = getGraphContext()
			graphics.context = graphContext

			const ingameRenderBounds = [ // [{x,y}, {x,y}] 2 coordinates defining the current bounding of the screen, in game coordinate format
				viewportToGameLocation({x: 0, y: 0}, graphContext),
				viewportToGameLocation({x: graphContext.vW, y: graphContext.vH}, graphContext),
			]

			graphics.clear()
			graphics.locX = (x)=>gameToViewportLocation({x:x,y:0}, graphContext).x
			graphics.locY = (y)=>gameToViewportLocation({x:0,y:y}, graphContext).y
			if(!ENGINE.render(graphics, animationTime, ingameRenderBounds)) {
				console.error('Engine render failed: Ticker Stopped.')
				pixi.ticker.stop()
			}
		})

		this.getCellSize = getCellSize
		this.getGraphContext = getGraphContext

		divs['btn-nextTurn'].click(()=>{
			turn += 1
			divs['btn-nextTurn'].prop('disabled', true)
		})
	}
})()
