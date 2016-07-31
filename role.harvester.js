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
                var sources = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_CONTAINER) && 0 < structure.store.energy;
                    }
                });
                if(sources.length){
                    if(creep.withdraw(sources[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sources[0]);
                    }
                    thirsty = false
                }
	        }
            if(thirsty){
                var targets = creep.room.find(FIND_DROPPED_RESOURCES);
                if(targets.length) {
                    creep.moveTo(targets[0]);
                    creep.pickup(targets[0]);
                }
                else{
                    var source = creep.pos.findClosestByRange(FIND_SOURCES);
                    if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                }
            }
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
                }
                else{
                    var flag = Game.flags['rest']
                    if(flag)
                        creep.moveTo(flag)
                }
            }
        }
	}
};

module.exports = roleHarvester;
