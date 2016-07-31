
function builderFilter(x){
    var structHits = x.hitsMax
    if(x.structureType === STRUCTURE_ROAD)
        structHits = 3000
    else if(x.structureType === STRUCTURE_WALL)
        structHits = 10000
    return x.hits < x.hitsMax && x.hits < structHits
}

var roleBuilder = {

    builderFilter: builderFilter,

    /** @param {Creep} creep **/
    run: function(creep) {

	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.say('harvesting');
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity){
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
	        var targets2 = creep.room.find(FIND_STRUCTURES, {filter: builderFilter});
            if(targets.length || targets2.length) {
                creep.memory.building = true;
                creep.memory.resting = false;
                creep.say('building');
            }
	    }

	    if(creep.memory.building) {
	        var targets = creep.room.find(FIND_STRUCTURES, {filter: builderFilter});
            if(targets.length) {
                if(creep.repair(targets[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
            }
            else{
    	        var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
                if(targets.length) {
                    if(creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0]);
                    }
                }
                else
                    creep.memory.building = false;
            }
	    }
	    else if(creep.carry.energy < creep.carryCapacity){
	        var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0]);
            }
        }
        else{
            var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity ||
                                structure.structureType === STRUCTURE_CONTAINER && structure.store.energy < structure.storeCapacity;
                    }
            });
            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
                creep.memory.resting = undefined;
            }
            else if(!creep.memory.resting){
                creep.say('resting')
                var flag = Game.flags['rest']
                if(flag){
                    creep.moveTo(flag)
                    creep.memory.resting = true
                }
            }
            else{
                var flag = Game.flags['rest']
                if(flag)
                    creep.moveTo(flag)
            }
        }
	}
};

module.exports = roleBuilder;
