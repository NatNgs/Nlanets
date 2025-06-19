var SimpleAI = (function () {
	class SimpleAI extends AbstractPlayer {
		/* Extended properties, see AbstractPlayer
		 * this.name
		 * this.color
		 * this.game
		 */

		/**
		 * @param {string} name Player's name
		 * @param {number} color (0 to 360, Color hue value)
		 * @param {GameEngine} game The game this player is playing
		 */
		constructor(name, color, game) {
			super('SimpleAI ' + name, color, game)

			// Do not act until this turn happend
			this.waitUntilTurn = 0

			// Attacks will get increasingly larger over time
			this.minAtkShipSize = 5

			/* planet data:
				turnData = {
					availablePop: p.population,
					isBeingAttacked: [{quantity: 69, turn: 42.21}],
					isRecievingReinforcments: [],
				}
			*/
			this.planets = {}

			/* ship data:
				crewSize: 4
				destination: { x: 22.23280084046579, y: 21.268758867262775 }
				id: 2
				owner: { name: "Human", color: 0 }
				planetDestination: "Gω"
				planetOrigin: "Rn"
				turnDestination: 19.624537686960768
				updated: 11.618300000000344
				x: 16.673254785062284
				y: 15.30990435784208

				OR

				firstKnownLocation: { x: 15.389202124153627, y: 9.133834441269737, turn: 11.64861000000033 }
				id: 6
				speed: { x: -0.9687481464326305, y: -0.39168788189574244 }
				turn: 11.775880000000335
				updated: 11.775880000000335
				x: 15.265909547557142
				y: 9.083984324540864
			*/
			this.myShips = {}
			this.notMyShips = {}
		}



		async update(data) {
			// Update current turn number
			this.turn = data.turn

			// Update planets data
			for(const planetName in data.planets) {
				const dta = data.planets[planetName]
				if(!this.planets[planetName] || 'population' in dta) {
					if(!dta.owner && dta.population) dta.owner = '__INHABITED__'
					dta.updated = data.turn
					this.planets[planetName] = dta
				} else if(!dta.owner && this.planets[planetName].owner?.name === this.name) {
					this.planets[planetName].owner = null
				}
			}

			// Remove from myShips, all ships that arrived
			for(const shipName of Object.keys(this.myShips)) {
				if(this.myShips[shipName].turnDestination < this.turn) {
					delete this.myShips[shipName]
				}
			}
			// Remove from notMyShips all ships with unkonwn destination or arrived
			for(const shipName of Object.keys(this.notMyShips)) {
				if(!this.notMyShips[shipName].turnDestination || this.notMyShips[shipName].turnDestination < this.turn) {
					delete this.notMyShips[shipName]
				}
			}

			// Update ship data
			for(const shipName in data.ships) {
				const dta = data.ships[shipName]
				dta.updated = data.turn

				if(dta.owner && dta.owner.name === this.name) {
					this.myShips[shipName] = dta
				} else {
					this.notMyShips[shipName] = dta
				}
			}

			// Do actions (if not waiting & if not currently doing actions)
			if(!this.isActing && this.turn >= this.waitUntilTurn) {
				this.isActing = true
				await this.act()
				this.isActing = false
				this.waitUntilTurn = this.turn + Math.random() + 0.25 // wait between 0.25 and 1.25 turns until next actions
				this.game.advanceToTurn(this.waitUntilTurn)
			}
		}


		async act() {
			// Sort planets
			const myPlanets = {}
			const notMyPlanets = {}
			for(const p of Object.values(this.planets)) {
				if(p.owner && p.owner.name === this.name) {
					myPlanets[p.name] = p
					p.turnData = {
						availablePop: p.population,
					}
				} else {
					notMyPlanets[p.name] = p
					p.turnData = {
						needScout : !p.population,
						estimatedPop : (p.population || 0) * (5*(this.turn - p.updated))
					}
				}
			}

			// Compute attacks being received
			for(const shipName in this.notMyShips) {
				const enemyShip = this.notMyShips[shipName]
				if(enemyShip.planetDestination) {
					if(enemyShip.planetDestination in myPlanets) {
						this.planets[enemyShip.planetDestination].turnData.availablePop -= enemyShip.crewSize
					} else if(!enemyShip.owner || !this.planets[enemyShip.planetDestination].owner || enemyShip.owner === this.planets[enemyShip.planetDestination].owner) {
						// Support from enemy to enemy planet (if ship or planet owner not known, suppose it's support)
						this.planets[enemyShip.planetDestination].turnData.estimatedPop += enemyShip.crewSize
					} else {
						// Attack from an enemy to another planet owned by another enemy
						this.planets[enemyShip.planetDestination].turnData.estimatedPop -= enemyShip.crewSize
					}
				}
			}
			// Compute attacks being sent
			for(const shipName in this.myShips) {
				const myShip = this.myShips[shipName]
				if(myShip.planetDestination in myPlanets) {
					this.planets[myShip.planetDestination].turnData.availablePop += myShip.crewSize
				} else {
					this.planets[myShip.planetDestination].turnData.estimatedPop -= myShip.crewSize
				}
			}

			// SUPPORT //
			const actionsToDo = {} // {<origin.name>: {origin: <planet>, target: <planet>, quantity: [<min>, <max>]}
			const potentialSupports = await this.prepareSupport(myPlanets)
			for(const supp of potentialSupports) {
				actionsToDo[supp.origin.name] = supp
			}

			// ATTACKS //
			const potentialAttacks = await this.prepareAttack(myPlanets, notMyPlanets, actionsToDo)
			if(potentialAttacks.length) {
				for(const atk of potentialAttacks) {
					actionsToDo[atk.origin.name] = atk
				}
				this.minAtkShipSize ++
			}

			// SCOUT //
			if(Object.keys(actionsToDo).length === 0) {
				// Only send scouts if nothing else to do
				const potentialScouts = await this.prepareScout(myPlanets, notMyPlanets)
				for(const sct of potentialScouts) {
					actionsToDo[sct.origin.name] = sct
				}
			}

			// SENDING SHIPS //
			for(const originName in actionsToDo) {
				const action = actionsToDo[originName]
				const amount = Math.max(1, (Math.random()*(action.quantity[1] - action.quantity[0]) + action.quantity[0])|0)

				//console.debug(this.name, potentialSupports.length?'Supporting':(potentialAttacks.length?'Attacking':'Scouting'), action.origin.name, '->', action.target.name, amount)
				this.game.sendShip(action.origin.name, action.target.name, amount)
			}
		}

		async prepareSupport(myPlanets) {
			const minUnitsStayHome = this.minAtkShipSize
			const potentialSupports = [] // {origin: <planet>, target: <planet>, quantity: [<min>, <max>], percentCompletionSupport: <float>, distance: <float>}
			for(const originName in myPlanets) {
				const origin = myPlanets[originName]
				if(origin.turnData.availablePop < this.minAtkShipSize+minUnitsStayHome) continue // Not enough population to send an attack

				// Compute support
				for(const targetName in myPlanets) {
					const target = myPlanets[targetName]
					if(target.turnData.availablePop > minUnitsStayHome) continue // Target does not need support

					const supportRequested = (minUnitsStayHome/2-target.turnData.availablePop)|0
					const minQuantity = Math.min(origin.turnData.availablePop - minUnitsStayHome, supportRequested)
					const maxQuantity = Math.min(origin.turnData.availablePop, origin.population) - minUnitsStayHome
					const distance = this.game.getPlanetDistance(target.name, origin.name)

					if(minQuantity < distance) continue // Only big ships to be sent far away
					potentialSupports.push({origin, target, distance, quantity: [minQuantity, maxQuantity], percentCompletionSupport: minQuantity / supportRequested})
				}
			}

			const sendingSupports = []
			if(potentialSupports.length) {
				// Sort potential supports by distance (min first)
				potentialSupports.sort((a,b) => a.distance - b.distance)

				// Keep fastest support first, then exclude all other from origin and to target; then continue again until no more potentialSupports remains
				const excludedOrigins = {}
				const excludedTargets = {}
				for(const support of potentialSupports) {
					if(support.origin.name in excludedOrigins) continue
					if(support.target.name in excludedTargets) continue
					excludedOrigins[support.origin.name] = support.origin
					excludedTargets[support.target.name] = support.target

					sendingSupports.push(support)
				}
			}
			return sendingSupports
		}
		async prepareAttack(myPlanets, notMyPlanets, excludedOrigins) {
			const minUnitsStayHome = this.minAtkShipSize
			const potentialAttacks = [] // {origin: <planet>, target: <planet>, quantity: [<min>, <max>], weight: <data>, distance: <float>}

			for(const originName in myPlanets) {
				if(originName in excludedOrigins) continue // this planet is already sending support for this turn

				const origin = myPlanets[originName]
				const maxQuantity = Math.min(origin.turnData.availablePop, origin.population) - minUnitsStayHome
				if(maxQuantity < this.minAtkShipSize) continue // Not enough population to send an attack

				// Compute attacks
				for(const targetName in notMyPlanets) {
					const target = notMyPlanets[targetName]

					const distance = this.game.getPlanetDistance(target.name, origin.name)
					if(!target.population || target.updated < this.turn - 3*distance) continue // do not attack unknown targets

					const minQuantity = Math.max(target.turnData.estimatedPop, this.minAtkShipSize) + distance // min quantity increases with distance

					if(maxQuantity > minQuantity) {
						// Available to send Attack
						const estimatedBattleOutcome = maxQuantity - target.turnData.estimatedPop
						if(estimatedBattleOutcome <= 0) {
							console.debug(this.turn.toFixed(2), this.name, 'Attack', origin.name, '->', target.name, 'is not strong enough (estimatedBattleOutcome =', estimatedBattleOutcome, ')')
							continue // not strong enough
						}

						potentialAttacks.push({origin, target, distance, estimatedBattleOutcome, quantity: [minQuantity, maxQuantity]})
					}
				}
			}

			if(!potentialAttacks.length) {
				return []
			}

			// Sort by: estimatedBattleOutcome/distance (largest first)
			potentialAttacks.sort((a, b) => b.estimatedBattleOutcome/b.distance - a.estimatedBattleOutcome/a.distance)

			// Keep all attacks having the same target as preferred attack, and arriving before or 1 turn max after it
			return potentialAttacks.filter(pa => pa.target === potentialAttacks[0].target && pa.distance < potentialAttacks[0].distance+1)
		}

		async prepareScout(myPlanets, notMyPlanets) {
			const minUnitsStayHome = this.minAtkShipSize*2
			const potentialScouts = [] // {origin: <planet>, target: <planet>, quantity: [<min>, <max>], weight: <data>, distance: <float>}

			for(const targetName in notMyPlanets) {
				const target = notMyPlanets[targetName]
				const lastUpdated = this.turn - target.updated
				if(this.turn > 10 && lastUpdated < 10) continue // Scouted recently, no need to scout again

				// skip if any of my ships have this planet as target
				if(Object.values(this.myShips).some(s => s.planetDestination === targetName)) continue

				for(const originName in myPlanets) {
					const origin = myPlanets[originName]
					if(Math.min(origin.turnData.availablePop, origin.population) < minUnitsStayHome) continue // Not enough population to send a scout

					const distance = this.game.getPlanetDistance(target.name, origin.name)

					let maxQuantity = Math.sqrt(origin.turnData.availablePop - minUnitsStayHome)
					potentialScouts.push({origin, target, w:lastUpdated+distance, quantity: [1, maxQuantity]})
				}
			}

			if(!potentialScouts.length) {
				return []
			}

			// Sort by: weight (largest first)
			potentialScouts.sort((a, b) => b.w - a.w)

			// pick first, then exclude all other from same origin and to same target; then continue again until no more potential scouts remains
			const sendingScouts = []
			/*const excludedOrigins = {}
			const excludedTargets = {}
			for(const scout of potentialScouts) {
				if(scout.origin.name in excludedOrigins) continue
				if(scout.target.name in excludedTargets) continue
				excludedOrigins[scout.origin.name] = scout.origin
				excludedTargets[scout.target.name] = scout.target

				sendingScouts.push(scout)
			}*/
			sendingScouts.push(potentialScouts[0])
			return sendingScouts
		}

	}

	return SimpleAI
})()
