class CullableRenderer extends PIXI.Graphics {
	constructor() {
		super()

		// Improve performances (hide component when out of view)
		this.cullable = true
	}

	render(renderer) {
		this.displayed = false
		super.render(renderer)
	}
	_render(renderer) {
		this.displayed = true
		super._render(renderer)
	}
}
