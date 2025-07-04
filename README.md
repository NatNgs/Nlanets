# Nlanets

## Features

### Game Menu

Instead of default game ready to play, add a menu to configure all settings

### Looping map

No top/bottom or left/right of the map: Map loops such as left = right and top = bottom

(and ship will from la planet of the left to a planet of the right by going left toward where the map loops)

only display planets once in viewport (depending on where viewport is centered, display the nearest location of every planet to the viewport center)

## TODO

### End of game screen

- Show a message when game has ended (all planets conqueered and no enemy ship still flying)
- Display game statistics at the end (graph of planet owned, units alive, units flying, ...)

### Bug: AI does not own the planet it was given at game start

Unknown bug, to find and fix, appears about once every 5/6 games randomly

### Choose how many ships to send

Instead of fixed 50% ship to be sent, on click on a planet, display the amount to be sent. With mouse scroll, make this amount increase or decrease. Then on click on target, this amount is sent.

- On scroll-up: increase amount to be sent by 10% planet population (rounded down - min=1)
- On scroll-down: decrease amount by 10% planet population (rounded down - min=1)
- If Shift+scroll, increase/decrease by 25% planet pop.
- If Ctrl+scroll, increase/decrease by one unit

### Light speed communication

Instead of getting instantaneous info from enemy planets & ship, Info is sent like ships toward nearest planet. Info is shown only when info arrives to the planet

Comm speed could be modified from same as ship speed, to infinity (= no light speed comm enabled)

- Hardcore mode: Each team have a main base/main unit. This unit may be moved from planet to planet like ships.
	- All communications should reach the main unit to appear on the game, even ally information
	- When ordering to send a ship from a distant planet, comm is sent from main unit to this planet, and only then the ships are sent.
	- Display "estimated current value" on every planet (number of people according to what info is yet known - not accounting for yet unseen attacks)
	- Display when an owned planet is conquered only after message has been received

Still display current location of self ships (but we will receive their radar & combat info only later)

### Multiplayer mode

- Create server
- Add field on client side to connect to server by IP
- Time increases only when all players are ready for next turn (or auto turn enabled)

### Record/Replay mode

- Record all players actions during a game whith record enabled
- At the end, allow player to download recorded data.
- Create a replay mode, when loading recorded data, will replay the exact game. Options to display all info (god mode), or watch what a chosen player sees (spectate) at any time

### Show "seen enemy ships" after loosing radar on them

Currently, when we find an enemy ship (for example by self ship passing by it), if the enemy ship goes out of radar, it simply disapear.

Show them as grayed out for a single turn, at the exact last location it was last seen, maybe with a '?' mark near its arrow to indicate we have lost it.
