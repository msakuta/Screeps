var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
	    if(creep.carry.energy < creep.carryCapacity) {
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
