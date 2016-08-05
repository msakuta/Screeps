
var roleAttacker = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.carry.energy === creep.carryCapacity)
            creep.memory.harvesting = undefined

        if(creep.memory.harvesting || creep.carry.energy === 0) {
            if(!creep.memory.harvesting){
                creep.memory.harvesting = true
                creep.say('attacker')
            }
            if(creep.room.name !== 'E49S13')
                creep.moveTo(new RoomPosition(25,25,'E49S13'))
            else{
                var container = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER && 0 < s.store.energy})
                if(container){
                    var r = creep.withdraw(container, RESOURCE_ENERGY)
                    if(r === ERR_NOT_IN_RANGE)
                        creep.moveTo(container)
                }
                else{
                    var source = creep.pos.findClosestByRange(FIND_SOURCES, {
                        // Skip empty sources, but if it's nearing to regenration, it's worth approaching.
                        // This way, creeps won't waste time by wandering about while waiting regeneration.
                        // The rationale behind this number is that you can reach the other side of a room
                        // approximately within 50 ticks, provided that roads are properly layed out.
                        filter: s => 0 < s.energy || s.ticksToRegeneration < 50
                    });
                    if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    }
                }
            }
            creep.memory.resting = undefined
        }
        else{
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
                    return target
                }
                return null
            }

            var target
            if(target = tryFindTarget([STRUCTURE_CONTAINER], s => s.hits < s.hitsMax * 0.8)){
                if(ERR_NOT_IN_RANGE === creep.repair(target))
                    creep.moveTo(target)
            }
            else if(creep.room.name !== 'E49S14')
                creep.moveTo(new RoomPosition(25,25,'E49S14'))
            else{

                // Precede filling tower, then extension and spawn, lastly container and storage.
                if(!tryFindTarget([STRUCTURE_TOWER], s => {
                        // Tower tend to spend tiny amount of energy from time to time for repairing
                        // roads and containers, so don't spend time for filling tiny amount of energy.
                        // Specifically, if this creep can harvest more than the energy amount it could
                        // transfer to the tower in the same duration of moving to the tower, it's not
                        // worth transferring (spending time for harvesting is more beneficial).
                        // That said, if the tower is getting short in energy, we can't help but restoring it.
                        if(s.energy < s.energyCapacity * 0.7)
                            return true
                        var fillableEnergy = Math.min(creep.carry.energy, s.energyCapacity - s.energy)
                        var workParts = creep.getActiveBodyparts(WORK)
                        var harvestsPerTick = workParts * 2
                        var totalPotentialHarvests = harvestsPerTick * creep.pos.getRangeTo(s)
                        // Debug log
                        //console.log('fillableEnergy: ' + fillableEnergy + ', workParts: ' + workParts + ', totalPotentialHarvests: ' + totalPotentialHarvests)
                        return totalPotentialHarvests < fillableEnergy}) &&
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
    }
};

module.exports = roleAttacker;
