function distancePointToPoint(xy1, xy2) {
	return Math.sqrt(Math.pow(xy1.x-xy2.x, 2) + Math.pow(xy1.y-xy2.y, 2))
}

function distancePointToLine(xy, p1, p2) {
	const A = xy.x - p1.x
	const B = xy.y - p1.y
	const C = p2.x - p1.x
	const D = p2.y - p1.y

	const len_sq = C * C + D * D
	let param = -1
	if (len_sq) //in case of 0 length line
		param = (A * C + B * D) / len_sq

	let xx, yy
	if (param < 0) {
		xx = p1.x
		yy = p1.y
	} else if (param > 1) {
		xx = p2.x
		yy = p2.y
	} else {
		xx = p1.x + param * C
		yy = p1.y + param * D
	}

	const dx = xy.x - xx
	const dy = xy.y - yy
	return Math.sqrt(dx * dx + dy * dy)
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
	const det = (l2[1].y - l2[0].y)*(l1[1].x - l1[0].x) - (l2[1].x - l2[0].x)*(l1[1].y - l1[0].y)
	if (det === 0) {
		return false
	}
	ua = ((l2[1].x - l2[0].x)*(l1[0].y - l2[0].y) - (l2[1].y - l2[0].y)*(l1[0].x - l2[0].x))/det
	ub = ((l1[1].x - l1[0].x)*(l1[0].y - l2[0].y) - (l1[1].y - l1[0].y)*(l1[0].x - l2[0].x))/det
	return {
		x: l1[0].x + ua * (l1[1].x - l1[0].x),
		y: l1[0].y + ua * (l1[1].y - l1[0].y),
		pct1: ua,
		pct2: ub,
	}
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
