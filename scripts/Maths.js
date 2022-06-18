class Point {
	constructor(x,y) {
		if(x.x !== undefined) {
			this.x = x.x
			this.y = x.y
		} else {
			this.x=x
			this.y=y
		}
	}

	distanceTo(point) {
		return Math.hypot(this.x-point.x, this.y-point.y)
	}
}
class Line {
	constructor(p1,p2) {
		this.p1=p1; this.p2=p2
	}

	distanceToPoint(point) {
		const dlx = this.p2.x - this.p1.x
		const dly = this.p2.y - this.p1.y
		const dpx = point.x - this.p1.x
		const dpy = point.y - this.p1.y

		const len_sq = dlx * dlx + dly * dly
		let param = -1
		if (len_sq) //in case of 0 length line
			param = (dpx * dlx + dpy * dly) / len_sq

		let xx, yy
		if (param < 0) {
			xx = this.p1.x
			yy = this.p1.y
		} else if (param > 1) {
			xx = this.p2.x
			yy = this.p2.y
		} else {
			xx = this.p1.x + param * dlx
			yy = this.p1.y + param * dly
		}

		return Math.hypot(point.x - xx, point.y - yy)
	}

	/**
	 * @param {Line} line
	 * @returns {Point} (null if no intersection)
	 *  Append to returned point the two following properties:
	 * 	- pct1: where is the intersection on l1 (0: intersection is l1[0], 1: intersection is l1[1], 0.5: intersection is the middle of l1)
	 * 	- pct2: where is the intersection on l2 (0: intersection is l2[0], 1: intersection is l2[1], 0.5: intersection is the middle of l2)
	 */
	intersect(line, exclusive=false) {
		const det = (line.p2.y - line.p1.y)*(this.p2.x - this.p1.x) - (line.p2.x - line.p1.x)*(this.p2.y - this.p1.y)
		if (det === 0) {
			return false
		}
		const ua = ((line.p2.x - line.p1.x)*(this.p1.y - line.p1.y) - (line.p2.y - line.p1.y)*(this.p1.x - line.p1.x))/det
		const ub = ((this.p2.x - this.p1.x)*(this.p1.y - line.p1.y) - (this.p2.y - this.p1.y)*(this.p1.x - line.p1.x))/det
		if(ua < 0 || ua > 1 || ub < 0 || ub > 1) {
			return false
		} else if(exclusive && (ua < 0.00001 || ub < 0.00001 || ua > 0.99999 || ub > 0.99999)) {
			return false
		}

		const intersect = new Point(this.p1.x + ua * (this.p2.x - this.p1.x), this.p1.y + ua * (this.p2.y - this.p1.y))
		intersect.pct1 = ua
		intersect.pct2 = ub
		return intersect
	}

	/**
	 * @param {Line} line Line where to cut the current one
	 * @returns {[Line]} List of 1 or 2 lines that are the result of the cut
	 */
	split(line) {
		const intersection = this.insersect(line)
		if(!intersection) {
			return [this]
		}
		return [new Line(this.p1, intersection), new Line(intersection, this.p2)]
	}
}
class Circle extends Point {
	constructor(p,r) {
		super(p)
		this.r=r
	}

	/**
	 * @param {Circle} circle Circle to find intersection with
	 * @returns {Line} line composed of the two points of intersection of the two circles; null if not intersecting or intersecting in a point
	 */
	intersectCircle(circle) {
		const dx = circle.x - this.x
		const dy = circle.y - this.y
		const d = Math.hypot(dx, dy)

		if (d > (this.r + circle.r)) {
			// circles do not intersect
			return null
		}

		// point x2,y2 is the point where the line through the circle intersection points crosses the line between the circle centers

		// Determine the distance from center of this to point 2
		const a = ((this.r*this.r) - (circle.r*circle.r) + (d*d)) / (2*d)

		// Determine the coordinates of point 2
		const x2 = this.x + (dx * a/d)
		const y2 = this.y + (dy * a/d)

		// Determine the distance from point 2 to either of the intersection points
		const h = Math.sqrt((this.r*this.r) - (a*a))

		// Determine the offsets of the intersection points from point 2
		const rx = -dy * (h/d)
		const ry = dx * (h/d)

		// Determine the absolute intersection points
		return new Line(new Point(x2 + rx, y2 + ry), new Point(x2 - rx, y2 - ry))
	}
}



/**
 * @param {[{x: number, y: number}, {x: number, y: number}]} l1 2 points defining the line
 * @param {[{x: number, y: number}, {x: number, y: number}]} l2 2 points defining the line
 * @returns false if no intersection, else returns {x, y, pct1, pct2}
 * 	- x: intersection point x,
 * 	- y: intersection point y,
 * 	- pct1: where is the intersection on l1 (0: intersection is l1[0], 1: intersection is l1[1], 0.5: intersection is the middle of l1)
 * 	- pct2: where is the intersection on l2 (0: intersection is l2[0], 1: intersection is l2[1], 0.5: intersection is the middle of l2)
 */
function lineIntersect(l1, l2) {
	return new Line(l1[0], l1[1]).intersect(new Line(l2[0], l2[1]))
}

function areLineIntersecting(l1, l2, inter) {
	inter = inter || lineIntersect(l1, l2)
	return inter.pct1 >= 0 && inter.pct1 <= 1 && inter.pct2 >= 0 && inter.pct2 <= 1
}


/**
 * @param {[{x: number, y: number}, {x: number, y: number}]} line 2 points defining the line
 * @param {[{x: number, y: number}, {x: number, y: number}]} rect any 2 oposite corners of the rectangle
 * @returns {boolean} true if line is in or intersects with the rectangle
 */
function isLineInRectangle(line, rect) {
	return (
		// if va or vb are in bounds, then the edge is in bounds
		(line[0].x >= rect[0].x && line[0].x <= rect[1].x && line[0].y >= rect[0].y && line[0].y <= rect[0].y)
		|| (line[1].x >= rect[0].x && line[1].x <= rect[0].x && line[1].y >= rect[0].y && line[1].y <= rect[0].y)

		// if line va-vb intersects bounds, then the edge is in bounds
		|| areLineIntersecting(line, [{x: rect[0].x, y: rect[0].y}, {x: rect[1].x, y: rect[0].y}])
		|| areLineIntersecting(line, [{x: rect[0].x, y: rect[0].y}, {x: rect[0].x, y: rect[1].y}])
		|| areLineIntersecting(line, [{x: rect[1].x, y: rect[1].y}, {x: rect[1].x, y: rect[0].y}])
		|| areLineIntersecting(line, [{x: rect[1].x, y: rect[1].y}, {x: rect[0].x, y: rect[1].y}])
	)
}

/**
 * @param {[{x: number, y: number}, {x: number, y: number}]} lineToCut
 * @param {[{x: number, y: number}, {x: number, y: number}]} lineCutting
 * @returns {[[{x: number, y: number}, {x: number, y: number}]]} List of 1 or 2 lines that are the result of the cut
 */
function cutLine(lineToCut, lineCutting) {
	const intersection = lineIntersect(lineToCut, lineCutting)
	if (!areLineIntersecting(lineToCut, lineCutting, intersection)) {
		return [lineToCut]
	}
	delete intersection.pct1
	delete intersection.pct2
	return [[lineToCut[0], intersection], [intersection, lineToCut[1]]]
}
function cutLines(lineToCut, linesCutting) {
	let linesToCut = [lineToCut]
	for(const lineCutting of linesCutting) {
		const cutLines = []
		for(const edge of linesToCut) {
			for(const cutLine of cutLine(edge, lineCutting)) {
				cutLines.push(cutLine)
			}
		}
		linesToCut = cutLines
	}
	return linesToCut
}


function angle(cxy, pxy) {
	return Math.atan2(pxy.y - cxy.y, pxy.x - cxy.x)
}
