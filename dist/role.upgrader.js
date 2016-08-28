var roleHarvester = require('role.harvester')

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.task !== 'harvest' && creep.carry.energy === 0) {
            creep.memory.task = 'harvest';
            creep.memory.spawn = undefined; // Forget about previous spawn in order to opitmize efficiency
            creep.say('harvesting');
        }
        if(creep.memory.task !== 'upgrade' && creep.carry.energy === creep.carryCapacity) {
            creep.memory.task = 'upgrade';
            creep.memory.target = undefined
            creep.say('upgrading');
        }

        if(creep.memory.task === 'upgrade') {
            if(creep.room.controller && creep.room.controller.my){
                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            }
            else if(creep.memory.spawn){
                creep.moveTo(Game.getObjectById(creep.memory.spawn))
            }
            else{
                let bestSpawn = null
                let leastControllerCount = 10
                for(let s in Game.spawns){
                    let spawn = Game.spawns[s]
                    let controllerCount = _.filter(Game.creeps, c => c.room === spawn.room && c.memory.role === 'upgrader').length
                    console.log('upg: ' + spawn.name + ' ' + controllerCount)
                    if(controllerCount < leastControllerCount){
                        leastControllerCount = controllerCount
                        bestSpawn = spawn
                    }
                }
                if(leastControllerCount){
                    creep.moveTo(bestSpawn)
                    creep.memory.spawn = bestSpawn.id
                }
            }

            // Try to repair damaged road on the way, in order to reduce necessity
            // to send builders to remote locations or use inefficient turrets.
            // It won't slow this creep down since repairing and moving can be
            // performed simultaneously. But it will take precedence if this creep
            // is trying to do upgrade.
            let damagedRoads = creep.pos.findInRange(FIND_STRUCTURES, 3, {filter: s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax})
            if(0 < damagedRoads.length){
                creep.repair(damagedRoads[0])
            }
        }
        else{
            var targets = creep.room.find(FIND_DROPPED_RESOURCES);
            if(targets.length && false) {
                creep.moveTo(targets[0]);
                creep.pickup(targets[0]);
                creep.memory.target = undefined
            }
            else if(creep.memory.target){
                var source = Game.getObjectById(creep.memory.target)
                if(!source || source.energy === 0)
                    creep.memory.target = undefined
                else if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source);
                }
            }
            else{
                let targetFound = false
                if(creep.room.energyAvailable === creep.room.energyCapacityAvailable){
                    // If the room's energy demand is satisfied (or there is no spawn in the room),
                    // try to withdraw energy from storage because it would be faster than harvesting
                    // from a source.  Chances are a digger is digging and dumping onto the container.
/*                    let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && 0 < s.store.energy
                            || s.structureType === STRUCTURE_LINK && 0 < s.energy
                    })
                    if(target){
                        if(creep.withdraw(target) === ERR_NOT_IN_RANGE){
                            creep.moveTo(target)
                        }
                        targetFound = true
                    }*/
                }
                if(!targetFound){
                    var source = creep.pos.findClosestByRange(FIND_SOURCES, {filter: roleHarvester.sourcePredicate});
                    if(source){
                        if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(source);
                        }
                        creep.memory.target = source.id
    /*                    if(!srouce.harvesters)
                            source.harvesters = [creep]
                        else{
                            source.harvesters.push(creep)
                            source.harvesters.sort((a,b) => a.getRangeTo(source) < b.getRangeTo(source))*/
    //                        if(2 < source.harvesters.length)
    //                            source.harvesters.splice(2, source.harvesters.length - 2)
    //                    }
                    }
                    else if(Game.flags.extra !== undefined){
                        creep.moveTo(Game.flags.extra)
                        creep.memory.target = undefined
                    }
                }
            }

            if(!creep.memory.target){
                // If all sources are depleted and there is excess energy in the storage, withdraw from it
                var storage = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_STORAGE && 50000 < s.store.energy})
                if(storage && creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
                    creep.moveTo(storage);
                else if(0 < creep.carry.energy){ // If everything fails and still has energy, pour it into the controller before die
                    creep.memory.task = 'upgrade'
                }
                else{
                    // If this creep cannot allot the right to harvest a source, get out of the way
                    // for other creeps.
                    var source = creep.pos.findClosestByRange(FIND_SOURCES)
                    var sourceRange = creep.pos.getRangeTo(source)
                    if(sourceRange <= 2){
                        let awayPath = PathFinder.search(creep.pos, {pos: source.pos, range: 3}, {flee: true}).path
                        //console.log(awayPath)
                        if(awayPath.length)
                            creep.moveTo(awayPath[awayPath.length-1])
                    }
                    else if(4 < sourceRange){
                        creep.moveTo(source)
                    }
                }
                creep.memory.target = undefined
            }
        }
	}
};

module.exports = roleUpgrader;
