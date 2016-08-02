var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        function totalEnergy(){
            var energy = 0, energyCapacity = 0
            energy += Game.spawns.Spawn1.energy
            energyCapacity += Game.spawns.Spawn1.energyCapacity
            var exts = creep.room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType === STRUCTURE_EXTENSION})
            for(var i = 0; i < exts.length; i++){
                energy += exts[i].energy;
                energyCapacity += exts[i].energyCapacity
            }
            return [energy, energyCapacity]
        }

        if(creep.carry.energy === creep.carryCapacity)
            creep.memory.harvesting = undefined

        if(creep.memory.harvesting || creep.carry.energy === 0) {
            if(!creep.memory.harvesting){
                creep.memory.harvesting = true
                creep.say('harvester')
            }
            var energies = totalEnergy()
            var thirsty = true
            if(energies[0] < energies[1]){
                var source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType === STRUCTURE_CONTAINER) && 0 < structure.store.energy;
                    }
                });
                if(source){
                    if(creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                    thirsty = false
                }
	        }
            if(thirsty){
                var target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if(target && false) {
                    var path = creep.pos.findPathTo(target);
                    if(path && path.length){
                        creep.moveTo(path[0].direction)
                        creep.pickup(target);
                    }
                }
                else{
                    var source = creep.pos.findClosestByRange(FIND_SOURCES, {filter: s => 0 < s.energy});
                    if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                }
            }
            creep.memory.resting = undefined
        }
        else {
            function tryFindTarget(types, isFilled){
                var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => {
                        for(var i = 0; i < types.length; i++){
                            if(types[i] === s.structureType && isFilled(s))
                                return true
                        }
                        return false
                    }
                })
                if(target){
                    if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target);
                    }
                    creep.memory.resting = undefined
                    //creep.say('fill ' + target.structureType)
                    return true
                }
                return false
            }
            
            // Precede filling tower, then extension and spawn, lastly container and storage.
            // Also, tower tend to spend tiny amount of energy from time to time for repairing
            // roads and containers, so don't spend time for filling tiny amount of energy.
            if(!tryFindTarget([STRUCTURE_TOWER], s => s.energy + creep.carry.energy <= s.energyCapacity) &&
                !tryFindTarget([STRUCTURE_EXTENSION, STRUCTURE_SPAWN], s => s.energy < s.energyCapacity) &&
                !tryFindTarget([STRUCTURE_CONTAINER, STRUCTURE_STORAGE], s => s.store.energy < s.storeCapacity))
            {
                var flag = Game.flags['rest']
                if(flag && !flag.pos.isNearTo(creep.pos))
                    creep.moveTo(flag)
                else if(!creep.memory.resting){
                    creep.say('at flag')
                    creep.memory.resting = true
                }
            }
        }
    }
};

module.exports = roleHarvester;
