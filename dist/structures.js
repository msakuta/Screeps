var roleBuilder = require('role.builder')
var stats = require('stats')

/** Process structures */
module.exports = function(){
    // Control turrets
    for(var name in Game.rooms){
        var room = Game.rooms[name]
        var towers = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}})
        for(var j = 0; j < towers.length; j++) {
            var tower = towers[j]
            var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter: c => !c.owner || !(c.owner.username in Memory.allies)});
            if(closestHostile) {
                tower.attack(closestHostile);
            }
            else if(tower.energyCapacity / 2 < tower.energy){
                var damagedStructures = roleBuilder.findDamagedStructures(tower.room)
                if(0 < damagedStructures.length) {
                    damagedStructures.sort((a,b) => a.hits - b.hits)
                    tower.repair(damagedStructures[0]);
                }
            }

        }
    }

    // Control links
    for(var name in Game.rooms){
        var room = Game.rooms[name]
        if(room.storage){
            let links = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_LINK}})
            for(var j = 0; j < links.length; j++) {
                let link = links[j]
                let range = link.pos.getRangeTo(room.storage)
                link.range = range
            }

            links.sort((a,b) => a.range - b.range)

            if(2 <= links.length){
                // Cache sink and source flags to use for harvesters
                links[0].sink = true
                for(let j = 1; j < links.length; j++){
                    // We need at least 100 space in order to transport to the sink
                    // because it would be so inefficient unless we do.
                    if(links[0].energy + Math.min(links[j].energy, 100) < links[0].energyCapacity)
                        links[j].transferEnergy(links[0])
                    links[j].source = true
                }
                //console.log('links sink: ' + links[0] + ', source: ' + links[1])
            }
            room.links = links
        }
    }

    // Process terminals and labs
    let terminals = []
    let srcTerminal = null
    let destTerminal = null
    for(let name in Game.rooms){
        let room = Game.rooms[name]
        if(!room.controller || !room.controller.my)
            continue
        let labs = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LAB})
        // Always labs[0] and labs[1] are inputs and labs[2] is the output.
        if(3 <= labs.length && 0 < labs[0].mineralAmount && 0 < labs[1].mineralAmount && labs[2].mineralAmount < labs[2].mineralCapacity){
            labs[2].runReaction(labs[0], labs[1])
        }

        // Determine source and destination terminals
        if(room.terminal && room.terminal.my){
            terminals.push(room.terminal)
            if(0 < labs.length){
                destTerminal = room.terminal
            }
            else if(0 < _.sum(room.terminal.store) - room.terminal.store.energy)
                srcTerminal = room.terminal
        }
    }

    // If both source and destination are prepared, send minerals
    if(srcTerminal && destTerminal){
        for(let resource in srcTerminal.store){
            // You can't send resources with amount less than 100
            if(resource === RESOURCE_ENERGY || srcTerminal.store[resource] < 100)
                continue
            let res = srcTerminal.send(resource, srcTerminal.store[resource], destTerminal.room.name)
            if(res < 0)
                console.log('terminal send failed! ' + resource + ' ' + srcTerminal.store[resource] + ' ' + res)
        }
    }


    // Reset spawn demands in case garbage remains in the VM
    for(let name in Game.spawns){
        let spawn = Game.spawns[name]
        spawn.demands = {}
        spawn.issued = false
    }

    // Level energy storage among rooms with terminals
    terminals.sort((a,b) => stats.totalEnergy(b.room)[2] < stats.totalEnergy(a.room)[2])
    if(2 <= terminals.length){
        let dest = terminals[0]
        let src = terminals[terminals.length-1]
        let amount = Math.min(dest.storeCapacity - _.sum(dest.store), (stats.totalEnergy(src.room)[2] - stats.totalEnergy(terminals[0].room)[2]) / 2)
        // Calculate transaction cost and check if there is sufficient energy in the terminal
        let cost = Game.market.calcTransactionCost(amount, src.room.name, dest.room.name)

        // Write debug string to memory instead of console to avoid cluttering
        if(src.room.memory.debug)
            src.room.memory.sendDemand = dest.room.name + ' for ' + amount + ' with cost ' + cost + ' at source ' + src.store.energy

        // If sending would cause deficit of energy, adjust the amount so that we won't have a problem.
        // Cost also depends on amount, so we need to solve the equation
        //   amount + cost(amount) === storedEnergy
        // where cost is a function of the form
        //   cost(amount) = Math.ceil(amount * (Math.log((distance + 9) * 0.1) + 0.1)).
        // (This formula is obtained from Game.market.calcTransactionCost definition and might change in future.)
        // But obtaining the solution of the equation analytically is not straightforward because
        // it's nonlinear (steppy function).
        // So we scan amount in a fixed interval to find the (approximate) solution.
        // Binary search could be better. Newtonian method could be worse since
        // derivative is not continuous (thanks to Math.ceil).
        while(src.store.energy < amount + cost && 10000 < amount){
            amount -= 1000
            cost = Game.market.calcTransactionCost(amount, src.room.name, dest.room.name)
        }

        if(src.room.memory.debug)
            src.room.memory.sendDemand += '  after cost adjust: ' + amount + ' cost ' + cost

        if(10000 < amount){
            let r = terminals[terminals.length-1].send(RESOURCE_ENERGY, amount, terminals[0].room.name)
            console.log(terminals[terminals.length-1].room + " sends energy to " + terminals[0].room +
                " for " + amount + " energy, with cost " + Game.market.calcTransactionCost(amount, src.room.name, dest.room.name) + " result: " + r)
        }
    }
}
