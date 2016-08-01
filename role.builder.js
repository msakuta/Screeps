var roleUpgrader = require('role.upgrader')

function builderFilter(x){
    var structHits = x.hitsMax
    if(x.structureType === STRUCTURE_ROAD)
        structHits = 3000
    else if(x.structureType === STRUCTURE_WALL){
        if(41 <= x.pos.x)
            return false
        structHits = 20000
    }
    return x.hits < x.hitsMax && x.hits < structHits
}


var roleBuilder = {

    builderFilter: builderFilter,

    /** @param {Creep} creep **/
    run: function(creep) {

	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.memory.target = undefined
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
            var target
            if(creep.memory.target && (target = Game.getObjectById(creep.memory.target))){
                //console.log('builder target: '+ target.id + ', ' + (target instanceof Structure))
                if(target instanceof Structure){
                    if(target.hits === target.hitsMax){
                        creep.memory.target = undefined
                    }
                    else if(creep.repair(target) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target);
                    }
                }
                else if(target instanceof ConstructionSite){
                    if(creep.build(target) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target);
                    }
                }
                else
                    creep.memory.target = undefined;
            }
            else{
    	        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}});
                if(target && false){
                    creep.memory.target = target.id
                }
                else{
        	        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {filter: builderFilter});
                    if(target){
                        creep.memory.target = target.id
                    }
                    else{
            	        var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
                        if(targets.length) {
                            creep.memory.target = targets[0].id
                        }
                    }
                }
                if(!creep.memory.target){
                    creep.memory.building = false;
                    creep.memory.target = undefined
                }
            }
	    }
	    else if(creep.carry.energy < creep.carryCapacity){
            var source = creep.pos.findClosestByRange(FIND_SOURCES);
            if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source);
            }
	    }
        else{
            var targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ||
                            structure.structureType == STRUCTURE_TOWER)
                            && structure.energy < structure.energyCapacity ||
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
                roleUpgrader.run(creep)
                var flag = Game.flags['rest']
                if(flag)
                    creep.moveTo(flag)
            }
        }
	}
};

module.exports = roleBuilder;
