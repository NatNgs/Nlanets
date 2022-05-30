
Array.prototype.getMax = function(comparator=null) {
	if(!this.length) return null

	let max = this[0]
	for(let i=this.length-1; i>0; i--) if(comparator && comparator(this[i], max) > 0 || this[i] > max) max = this[i]
	return max
}

Array.prototype.getMin = function(comparator=null) {
	if(!this.length) return null

	let min = this[0]
	for(let i=this.length-1; i>0; i--) if(comparator && comparator(this[i], max) < 0 || this[i] < min) min = this[i]
	return min
}

Array.prototype.diff = function(array) {
	const in1 = []
	const in2 = []
	const inBoth = []

	for(const e of this) {
		if(array.indexOf(e) >= 0) {
			inBoth.push(e)
		} else {
			in1.push(e)
		}
	}
	for(const e of array) if(this.indexOf(e) < 0) in2.push(e)
	return [in1, in2, inBoth]
}
Array.prototype.intersect = function(array) {
	const out = []
	for(const e of this) if(array.indexOf(e) >= 0 && out.indexOf(e) < 0) out.push(e)
	return out
}

Array.prototype.uniq = function(comparator=null) {
	const out = []
	for(const e1 of this) {
		let c = true
		for(const e2 of out) {
			if(comparator && comparator(e1,e2)===0 || e1===e2) {
				c = false
				break
			}
		}
		if(c) out.push(e1)
	}
	return out
}

Array.prototype.addAll = function(array) {
	for(const e of array) this.push(e)
	return this
}
Array.prototype.pushAllMissing = function(array) {
	for(const e of array) if(this.indexOf(e) < 0) this.push(e)
	return this
}

Array.prototype.occurences = function() {
	const o = {}
	for(const e of this) {
		if(!(e in o)) o[e] = 1
		else o[e]++
	}
	return o
}

Array.prototype.unorderedRm = function(value) {
	const i = this.indexOf(value)
	if (i >= 0) {
		this[i] = this[this.length-1]
		this.length --
	}
}
