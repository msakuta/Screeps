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
                if(target) {
                    creep.moveTo(target);
                    creep.pickup(target);
                }
                else{
                    var source = creep.pos.findClosestByRange(FIND_SOURCES);
                    if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                }
            }
            creep.memory.resting = undefined
        }
        else {
            var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                    }
            });
            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
                creep.memory.resting = undefined
            }
            else{
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_CONTAINER) && structure.store.energy < structure.storeCapacity;
                    }
                });
                if(targets.length > 0) {
                    if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0]);
                    }
                    creep.memory.resting = undefined
                }
                else{
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
	}
};

module.exports = roleHarvester;
