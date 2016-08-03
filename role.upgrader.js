var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.memory.upgrading && creep.carry.energy == 0) {
            creep.memory.upgrading = false;
            creep.say('harvesting');
        }
        if(!creep.memory.upgrading && creep.carry.energy == creep.carryCapacity) {
            creep.memory.upgrading = true;
            creep.say('upgrading');
        }

        if(creep.memory.upgrading) {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }
        else {
            var targets = creep.room.find(FIND_DROPPED_RESOURCES);
            if(targets.length && false) {
                creep.moveTo(targets[0]);
                creep.pickup(targets[0]);
            }
            else{
                var source = creep.pos.findClosestByRange(FIND_SOURCES, {filter: s => 0 < s.energy});
                if(source){
                    if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                }
                else{
                    // If all sources are depleted and there is excess energy in the storage, withdraw from it
                    var storage = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_STORAGE && 50000 < s.store.energy})
                    if(storage && creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
                        creep.moveTo(storage);
                    else if(0 < creep.carry.energy) // If everything fails and still has energy, pour it into the controller before die
                        creep.memory.upgrading = true
                }
            }
        }
	}
};

module.exports = roleUpgrader;
